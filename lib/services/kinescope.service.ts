import crypto from "node:crypto";
import { VideoProcessingStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import type { ConfirmUploadResponse, UploadUrlResponse } from "@/types";

type ServiceContext = {
  tenantId: string;
};

type CreateUploadSessionInput = {
  projectId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

type KinescopeUploadApiResponse = {
  id?: string;
  video_id?: string;
  file_request_id?: string;
  url?: string;
  upload_url?: string;
  link?: string;
  data?: {
    id?: string;
    video_id?: string;
    file_request_id?: string;
    url?: string;
    upload_url?: string;
    link?: string;
  };
  expires_in?: number;
  expires_at?: string;
  upload?: {
    url?: string;
    method?: "PUT" | "POST";
    headers?: Record<string, string>;
    fields?: Record<string, string>;
  };
};

type KinescopeVideoApiResponse = {
  id?: string;
  status?: string;
  state?: string;
  duration?: number;
  duration_sec?: number;
  error?: string;
  playback?: {
    url?: string;
  };
  player?: {
    url?: string;
  };
};

type WebhookVideoPayload = {
  id?: string;
  video_id?: string;
  status?: string;
  state?: string;
  duration?: number;
  duration_sec?: number;
  error?: string;
  playback_url?: string;
  player_url?: string;
};

type KinescopeUploadingLocation = {
  id: string;
  title: string;
  isDefault: boolean;
};

const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/avi"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024;
const DEFAULT_EXPIRES_IN = 3600;

function resolveStatus(rawStatus: string | undefined): VideoProcessingStatus {
  const status = (rawStatus ?? "").toLowerCase();
  if (status.includes("ready") || status.includes("done") || status.includes("complete")) {
    return VideoProcessingStatus.READY;
  }
  if (status.includes("fail") || status.includes("error")) {
    return VideoProcessingStatus.FAILED;
  }
  if (status.includes("upload")) {
    return VideoProcessingStatus.UPLOADING;
  }
  return VideoProcessingStatus.PROCESSING;
}

function toDuration(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.floor(value);
}

export class KinescopeService {
  private readonly apiToken: string;
  private readonly projectId: string;
  private readonly uploadingLocationId: string;
  private readonly baseUrl: string;
  private readonly webhookSecret: string;

  constructor(private prismaClient: PrismaClient = prisma as PrismaClient) {
    this.apiToken = process.env.KINESCOPE_API_TOKEN ?? "";
    this.projectId = process.env.KINESCOPE_PROJECT_ID ?? "";
    this.uploadingLocationId = process.env.KINESCOPE_UPLOADING_LOCATION_ID ?? "";
    this.baseUrl = (process.env.KINESCOPE_BASE_URL ?? "https://api.kinescope.io/v1").replace(/\/+$/, "");
    this.webhookSecret = process.env.KINESCOPE_WEBHOOK_SECRET ?? "";
  }

  async createUploadSession(context: ServiceContext, input: CreateUploadSessionInput): Promise<UploadUrlResponse> {
    this.ensureApiTokenConfigured();
    this.validateUploadInput(input);

    await this.assertProjectInTenant(context.tenantId, input.projectId);

    const resolvedUploadingLocationId = await this.resolveUploadingLocationId();
    if (!resolvedUploadingLocationId) {
      throw new Error(
        "Kinescope uploading location is not configured. Set KINESCOPE_UPLOADING_LOCATION_ID or ensure locations are available via API.",
      );
    }

    const response = await this.request<KinescopeUploadApiResponse>("/file-requests", {
      method: "POST",
      body: JSON.stringify({
        title: input.fileName,
        name: input.fileName,
        uploading_location_id: resolvedUploadingLocationId,
        type: "one-time",
        auto_start: false,
        save_stream: true,
      }),
    });

    const uploadUrl =
      response.upload?.url ??
      response.upload_url ??
      response.url ??
      response.link ??
      response.data?.upload_url ??
      response.data?.url ??
      response.data?.link;
    const kinescopeVideoId =
      response.video_id ??
      response.file_request_id ??
      response.id ??
      response.data?.video_id ??
      response.data?.file_request_id ??
      response.data?.id;
    if (!uploadUrl || !kinescopeVideoId) {
      throw new Error("Kinescope upload session response is invalid");
    }

    const expiresIn = response.expires_in ?? DEFAULT_EXPIRES_IN;
    const expiresAt = response.expires_at ?? new Date(Date.now() + expiresIn * 1000).toISOString();

    await this.prismaClient.videoUploadSession.upsert({
      where: { kinescopeVideoId },
      update: {
        tenantId: context.tenantId,
        projectId: input.projectId,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        status: VideoProcessingStatus.UPLOADING,
        errorMessage: null,
      },
      create: {
        tenantId: context.tenantId,
        projectId: input.projectId,
        kinescopeVideoId,
        fileName: input.fileName,
        fileType: input.fileType,
        fileSize: input.fileSize,
        status: VideoProcessingStatus.UPLOADING,
      },
    });

    return {
      uploadUrl,
      uploadMethod: response.upload?.method ?? "POST",
      uploadHeaders: response.upload?.headers,
      uploadFields: response.upload?.fields,
      kinescopeVideoId,
      expiresAt,
      expiresIn,
    };
  }

  async confirmUpload(context: ServiceContext, input: { projectId: string; kinescopeVideoId: string }): Promise<ConfirmUploadResponse> {
    this.ensureConfigured();
    await this.assertProjectInTenant(context.tenantId, input.projectId);

    const session = await this.prismaClient.videoUploadSession.findFirst({
      where: {
        tenantId: context.tenantId,
        projectId: input.projectId,
        kinescopeVideoId: input.kinescopeVideoId,
      },
      select: { id: true },
    });

    if (!session) {
      throw new Error("Kinescope upload session not found for this tenant/project");
    }

    let resolvedVideoId = input.kinescopeVideoId;
    let processingStatus: VideoProcessingStatus = VideoProcessingStatus.PROCESSING;
    let streamUrl: string | null = null;
    let durationSec: number | null = null;
    let processingError: string | null = null;

    try {
      const video = await this.request<KinescopeVideoApiResponse>(`/videos/${input.kinescopeVideoId}`, {
        method: "GET",
      });

      processingStatus = resolveStatus(video.status ?? video.state);
      streamUrl = video.playback?.url ?? video.player?.url ?? this.buildEmbedUrl(input.kinescopeVideoId);
      durationSec = toDuration(video.duration_sec ?? video.duration);
      processingError = video.error ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const canFallbackToFileRequest =
        message.includes("invalid uuid format") || message.includes("(404)") || message.includes("not found");

      if (!canFallbackToFileRequest) {
        throw error;
      }

      const fileRequest = await this.request<Record<string, unknown>>(`/file-requests/${input.kinescopeVideoId}`, {
        method: "GET",
      });

      const rawStatus =
        (fileRequest.status as string | undefined) ??
        (fileRequest.state as string | undefined) ??
        (((fileRequest.video as Record<string, unknown> | undefined)?.status as string | undefined) ?? undefined);
      processingStatus = resolveStatus(rawStatus);

      const discoveredVideoId =
        (fileRequest.video_id as string | undefined) ??
        ((fileRequest.video as Record<string, unknown> | undefined)?.id as string | undefined) ??
        ((fileRequest.data as Record<string, unknown> | undefined)?.video_id as string | undefined);

      if (discoveredVideoId) {
        resolvedVideoId = discoveredVideoId;
        streamUrl = this.buildEmbedUrl(discoveredVideoId);
      } else {
        streamUrl = this.buildEmbedUrl(input.kinescopeVideoId);
      }
    }

    await this.prismaClient.videoUploadSession.update({
      where: { kinescopeVideoId: input.kinescopeVideoId },
      data: {
        kinescopeVideoId: resolvedVideoId,
        status: processingStatus,
        streamUrl,
        durationSec,
        errorMessage: processingError,
      },
    });

    return {
      kinescopeVideoId: resolvedVideoId,
      processingStatus,
      streamUrl,
      durationSec,
      processingError,
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!this.webhookSecret) {
      return true;
    }
    if (!signatureHeader) {
      return false;
    }

    const expected = crypto.createHmac("sha256", this.webhookSecret).update(rawBody).digest("hex");
    const normalized = signatureHeader.replace(/^sha256=/i, "");
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(normalized);
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  }

  async syncWebhookEvent(payload: { type?: string; event?: string; video?: WebhookVideoPayload; data?: WebhookVideoPayload }): Promise<void> {
    const eventType = payload.type ?? payload.event ?? "";
    const videoPayload = payload.video ?? payload.data;
    const videoId = videoPayload?.id ?? videoPayload?.video_id;
    if (!videoId) {
      return;
    }

    const statusFromEvent = eventType.toLowerCase();
    const status = resolveStatus(videoPayload?.status ?? videoPayload?.state ?? statusFromEvent);
    const streamUrl = videoPayload?.playback_url ?? videoPayload?.player_url ?? this.buildEmbedUrl(videoId);
    const durationSec = toDuration(videoPayload?.duration_sec ?? videoPayload?.duration);
    const processingError = videoPayload?.error ?? (status === VideoProcessingStatus.FAILED ? "Kinescope processing failed" : null);

    await this.prismaClient.videoUploadSession.updateMany({
      where: { kinescopeVideoId: videoId },
      data: {
        status,
        streamUrl,
        durationSec,
        errorMessage: processingError,
      },
    });

    await this.prismaClient.assetVersion.updateMany({
      where: { kinescopeVideoId: videoId },
      data: {
        processingStatus: status,
        streamUrl,
        processingError,
        durationSec: durationSec ?? undefined,
        fileUrl: streamUrl,
      },
    });
  }

  async listUploadingLocations(): Promise<KinescopeUploadingLocation[]> {
    this.ensureApiTokenConfigured();
    const candidates = ["/uploading-locations", "/uploading_locations", "/locations"];
    let lastError: unknown;

    for (const path of candidates) {
      try {
        const payload = await this.request<{
          data?: Array<{ id?: string; title?: string; name?: string; is_default?: boolean }>;
          items?: Array<{ id?: string; title?: string; name?: string; is_default?: boolean }>;
        }>(path, {
          method: "GET",
        });

        const items = payload.data ?? payload.items ?? [];
        const normalized = items
          .filter((item) => Boolean(item.id))
          .map((item) => ({
            id: item.id as string,
            title: item.title ?? item.name ?? "Untitled location",
            isDefault: Boolean(item.is_default),
          }));

        if (normalized.length > 0) {
          return normalized;
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Kinescope uploading locations endpoint is not available");
  }

  buildEmbedUrl(videoId: string): string {
    const host = process.env.KINESCOPE_PLAYER_BASE_URL ?? "https://kinescope.io";
    return `${host.replace(/\/+$/, "")}/${videoId}`;
  }

  private async assertProjectInTenant(tenantId: string, projectId: string): Promise<void> {
    const project = await this.prismaClient.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });
    if (!project) {
      throw new Error("Project not found in this tenant");
    }
  }

  private validateUploadInput(input: CreateUploadSessionInput): void {
    if (!input.fileName.trim() || input.fileName.length > 255) {
      throw new Error("Invalid file name");
    }
    if (!ALLOWED_VIDEO_TYPES.includes(input.fileType)) {
      throw new Error(`File type ${input.fileType} not supported. Allowed: ${ALLOWED_VIDEO_TYPES.join(", ")}`);
    }
    if (input.fileSize <= 0 || input.fileSize > MAX_FILE_SIZE_BYTES) {
      throw new Error("File size exceeds maximum of 5GB");
    }
  }

  private ensureConfigured(): void {
    this.ensureApiTokenConfigured();
  }

  private ensureApiTokenConfigured(): void {
    if (!this.apiToken) {
      throw new Error("Kinescope is not configured: KINESCOPE_API_TOKEN is required");
    }
  }

  private async resolveUploadingLocationId(): Promise<string | null> {
    const configured = this.uploadingLocationId.trim();
    if (configured) {
      return configured;
    }

    const discovered = await this.tryDiscoverUploadingLocationId();
    return discovered;
  }

  private async tryDiscoverUploadingLocationId(): Promise<string | null> {
    const locations = await this.listUploadingLocations().catch(() => []);
    if (locations.length > 0) {
      const preferred = locations.find((item) => item.isDefault) ?? locations[0];
      return preferred.id;
    }

    const projectId = this.projectId.trim();
    if (projectId) {
      try {
        const project = await this.request<{
          uploading_location_id?: string;
          data?: { uploading_location_id?: string };
        }>(`/projects/${projectId}`, {
          method: "GET",
        });
        return project.uploading_location_id ?? project.data?.uploading_location_id ?? null;
      } catch {
        // continue to token-scope discovery
      }
    }

    const tokenScopedEntityId = await this.tryResolveUploadingLocationFromTokenScope();
    if (tokenScopedEntityId) {
      return tokenScopedEntityId;
    }

    return null;
  }

  private async tryResolveUploadingLocationFromTokenScope(): Promise<string | null> {
    const probePaths = ["/tokens/current", "/auth/tokens/current", "/tokens/me"];
    for (const path of probePaths) {
      try {
        const tokenInfo = await this.request<{
          data?: {
            scope?: {
              upload?: {
                entities?: Array<{ id?: string }>;
              };
            };
          };
          scope?: {
            upload?: {
              entities?: Array<{ id?: string }>;
            };
          };
        }>(path, { method: "GET" });

        const entities =
          tokenInfo.data?.scope?.upload?.entities ??
          tokenInfo.scope?.upload?.entities ??
          [];
        const entityId = entities.find((entity) => Boolean(entity.id))?.id;
        if (entityId) {
          return entityId;
        }
      } catch {
        // try next path
      }
    }

    return null;
  }

  private resolveOptionalUuid(value: string): string | null {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidPattern.test(normalized) ? normalized : null;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiToken}`,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Kinescope API request failed (${response.status}): ${body || response.statusText}`);
    }

    return (await response.json()) as T;
  }
}

let kinescopeServiceInstance: KinescopeService | undefined;

export function getKinescopeService(): KinescopeService {
  if (!kinescopeServiceInstance) {
    kinescopeServiceInstance = new KinescopeService();
  }
  return kinescopeServiceInstance;
}
