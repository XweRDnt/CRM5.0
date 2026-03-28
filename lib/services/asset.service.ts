import { Prisma, VersionStatus, VideoProcessingStatus, VideoProvider, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import { getKinescopeService } from "@/lib/services/kinescope.service";
import type { AssetVersionResponse, CreateVersionInput, ServiceContext } from "@/types";

type VersionListContext = {
  tenantId: string;
};

export type ProjectVersionMeta = {
  usedVersionNumbers: number[];
  nextVersionNumber: number;
};

export class VersionConflictError extends Error {
  constructor(public suggestedVersionNo: number) {
    super("Version already exists");
    this.name = "VersionConflictError";
  }
}

type AssetVersionWithUploader = {
  id: string;
  projectId: string;
  versionNo: number;
  title: string | null;
  fileUrl: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  durationSec: number | null;
  videoProvider: VideoProvider;
  kinescopeVideoId: string | null;
  kinescopeAssetId: string | null;
  kinescopeProjectId: string | null;
  streamUrl: string | null;
  processingStatus: VideoProcessingStatus;
  processingError: string | null;
  notes: string | null;
  changeLog: string | null;
  status: VersionStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

const ALLOWED_VERSION_STATUS_TRANSITIONS: Record<VersionStatus, VersionStatus[]> = {
  DRAFT: [VersionStatus.IN_REVIEW],
  IN_REVIEW: [VersionStatus.CHANGES_REQUESTED, VersionStatus.APPROVED],
  CHANGES_REQUESTED: [VersionStatus.IN_REVIEW],
  APPROVED: [VersionStatus.FINAL],
  FINAL: [],
};

export class AssetService {
  constructor(private prismaClient: PrismaClient = prisma as PrismaClient) {}

  async createVersion(input: CreateVersionInput): Promise<AssetVersionResponse> {
    const {
      projectId,
      tenantId,
      versionNo: requestedVersionNo,
      title,
      fileKey,
      fileName,
      fileSize,
      durationSec,
      uploadedByUserId,
      notes,
      kinescopeVideoId,
      kinescopeAssetId,
      kinescopeProjectId,
      streamUrl,
      processingStatus = VideoProcessingStatus.READY,
      processingError,
    } = input;

    if (!fileName) {
      throw new Error("File name is required");
    }

    if (!kinescopeVideoId) {
      throw new Error("kinescopeVideoId is required");
    }

    if (fileSize <= 0) {
      throw new Error("File size must be greater than 0");
    }

    const project = await this.prismaClient.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      select: { id: true },
    });
    if (!project) {
      throw new Error("Project not found in this tenant");
    }

    const user = await this.prismaClient.user.findFirst({
      where: {
        id: uploadedByUserId,
        tenantId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });
    if (!user) {
      throw new Error("User not found in this tenant");
    }

    let versionNo = requestedVersionNo;
    if (versionNo === undefined) {
      versionNo = await this.getNextVersionNumber(projectId);
    }

    if (versionNo <= 0) {
      throw new Error("Version number must be greater than 0");
    }

    const resolvedTitle = title?.trim() || `Версия ${versionNo}`;

    const existingVersion = await this.prismaClient.assetVersion.findFirst({
      where: {
        projectId,
        versionNo,
      },
      select: { id: true },
    });

    if (existingVersion) {
      throw new VersionConflictError(await this.getNextVersionNumber(projectId));
    }

    const uploadSession = await this.prismaClient.videoUploadSession.findFirst({
      where: {
        tenantId,
        projectId,
        kinescopeVideoId,
      },
      select: { id: true, streamUrl: true, durationSec: true, status: true, errorMessage: true },
    });

    if (!uploadSession) {
      throw new Error("Kinescope upload session not found in this tenant/project");
    }

    const resolvedFileKey = fileKey ?? `kinescope/${tenantId}/${projectId}/${kinescopeVideoId}`;
    const resolvedFileUrl = streamUrl ?? `https://kinescope.io/${kinescopeVideoId}`;

    let version: AssetVersionWithUploader;
    try {
      version = await this.prismaClient.assetVersion.create({
        data: {
          projectId,
          versionNo,
          title: resolvedTitle,
          fileUrl: resolvedFileUrl,
          fileKey: resolvedFileKey,
          fileName,
          fileSize,
          durationSec: durationSec ?? null,
          uploadedByUserId,
          uploadedByLegacy: uploadedByUserId,
          notes: notes ?? null,
          videoProvider: VideoProvider.KINESCOPE,
          kinescopeVideoId: kinescopeVideoId ?? null,
          kinescopeAssetId: kinescopeAssetId ?? null,
          kinescopeProjectId: kinescopeProjectId ?? null,
          streamUrl: streamUrl ?? null,
          processingStatus,
          processingError: processingError ?? null,
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new VersionConflictError(await this.getNextVersionNumber(projectId));
      }
      throw error;
    }

    return this.mapAssetVersionResponse(version);
  }

  async listVersionsByProject(projectId: string, tenantId: string): Promise<AssetVersionResponse[]>;
  async listVersionsByProject(context: VersionListContext, input: { projectId: string }): Promise<AssetVersionResponse[]>;
  async listVersionsByProject(
    projectIdOrContext: string | VersionListContext,
    tenantIdOrInput: string | { projectId: string },
  ): Promise<AssetVersionResponse[]> {
    const { projectId, tenantId } = this.resolveProjectListInput(projectIdOrContext, tenantIdOrInput);

    const project = await this.prismaClient.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      select: { id: true },
    });
    if (!project) {
      throw new Error("Project not found in this tenant");
    }

    const versions = await this.prismaClient.assetVersion.findMany({
      where: { projectId },
      orderBy: { versionNo: "desc" },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (versions.length === 0) {
      return [];
    }

    return versions.map((version) => this.mapAssetVersionResponse(version));
  }

  async getLatestVersionByProject(projectId: string, tenantId: string): Promise<AssetVersionResponse | null> {
    const project = await this.prismaClient.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      select: { id: true },
    });
    if (!project) {
      throw new Error("Project not found in this tenant");
    }

    const latestVersion = await this.prismaClient.assetVersion.findFirst({
      where: { projectId },
      orderBy: { versionNo: "desc" },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return latestVersion ? this.mapAssetVersionResponse(latestVersion) : null;
  }

  async getVersionMeta(projectId: string, tenantId: string): Promise<ProjectVersionMeta> {
    const project = await this.prismaClient.project.findFirst({
      where: {
        id: projectId,
        tenantId,
      },
      select: { id: true },
    });

    if (!project) {
      throw new Error("Project not found in this tenant");
    }

    return this.buildVersionMeta(projectId);
  }

  async getVersionById(versionId: string, tenantId: string): Promise<AssetVersionResponse> {
    const version = await this.prismaClient.assetVersion.findFirst({
      where: {
        id: versionId,
        project: {
          tenantId,
        },
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!version) {
      throw new Error("Asset version not found");
    }

    return this.mapAssetVersionResponse(version);
  }

  async updateVersionStatus(input: {
    projectId: string;
    versionId: string;
    tenantId: string;
    status: VersionStatus;
  }): Promise<AssetVersionResponse> {
    const version = await this.prismaClient.assetVersion.findFirst({
      where: {
        id: input.versionId,
        projectId: input.projectId,
        project: {
          tenantId: input.tenantId,
        },
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!version) {
      throw new Error("Asset version not found");
    }

    if (version.status === input.status) {
      return this.mapAssetVersionResponse(version);
    }

    const allowedTransitions = ALLOWED_VERSION_STATUS_TRANSITIONS[version.status];
    if (!allowedTransitions.includes(input.status)) {
      throw new Error(`Invalid status transition from ${version.status} to ${input.status}`);
    }

    const updated = await this.prismaClient.assetVersion.update({
      where: {
        id: version.id,
      },
      data: {
        status: input.status,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapAssetVersionResponse(updated);
  }

  async approveVersion(input: {
    projectId: string;
    versionId: string;
    tenantId: string;
    approvedBy: string;
  }): Promise<AssetVersionResponse> {
    const version = await this.prismaClient.assetVersion.findFirst({
      where: {
        id: input.versionId,
        projectId: input.projectId,
        project: {
          tenantId: input.tenantId,
        },
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!version) {
      throw new Error("Asset version not found");
    }

    if (version.status === VersionStatus.APPROVED) {
      return this.mapAssetVersionResponse(version);
    }

    if (version.status === VersionStatus.FINAL) {
      throw new Error(`Invalid status transition from ${version.status} to ${VersionStatus.APPROVED}`);
    }

    const updated = await this.prismaClient.assetVersion.update({
      where: {
        id: version.id,
      },
      data: {
        status: VersionStatus.APPROVED,
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return this.mapAssetVersionResponse(updated);
  }

  async deleteVersion(context: ServiceContext, input: { projectId: string; versionId: string }): Promise<void> {
    const { tenantId } = context;
    const { projectId, versionId } = input;

    if (!tenantId) {
      throw new Error("Tenant id is required");
    }

    const version = await this.prismaClient.assetVersion.findFirst({
      where: {
        id: versionId,
        projectId,
        project: {
          tenantId,
        },
      },
      select: { id: true, kinescopeVideoId: true },
    });

    if (!version) {
      throw new Error("Asset version not found");
    }

    if (version.kinescopeVideoId) {
      await getKinescopeService().deleteVideo(version.kinescopeVideoId);
    }

    await this.prismaClient.assetVersion.delete({
      where: { id: versionId },
    });
  }
  async generateThumbnail(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
  async setVersionReady(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
  async getLatestVersion(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
  async createClientPortalLink(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  private resolveProjectListInput(
    projectIdOrContext: string | VersionListContext,
    tenantIdOrInput: string | { projectId: string },
  ): { projectId: string; tenantId: string } {
    if (typeof projectIdOrContext === "string" && typeof tenantIdOrInput === "string") {
      return {
        projectId: projectIdOrContext,
        tenantId: tenantIdOrInput,
      };
    }

    return {
      projectId: (tenantIdOrInput as { projectId: string }).projectId,
      tenantId: (projectIdOrContext as VersionListContext).tenantId,
    };
  }

  private async buildVersionMeta(projectId: string): Promise<ProjectVersionMeta> {
    const versions = await this.prismaClient.assetVersion.findMany({
      where: { projectId },
      orderBy: { versionNo: "asc" },
      select: { versionNo: true },
    });
    const usedVersionNumbers = versions.map((version) => version.versionNo);
    const nextVersionNumber = usedVersionNumbers.length > 0 ? usedVersionNumbers[usedVersionNumbers.length - 1] + 1 : 1;
    return {
      usedVersionNumbers,
      nextVersionNumber,
    };
  }

  private async getNextVersionNumber(projectId: string): Promise<number> {
    const lastVersion = await this.prismaClient.assetVersion.findFirst({
      where: { projectId },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    return (lastVersion?.versionNo ?? 0) + 1;
  }

  private mapAssetVersionResponse(version: AssetVersionWithUploader): AssetVersionResponse {
    return {
      id: version.id,
      projectId: version.projectId,
      versionNumber: version.versionNo,
      title: version.title ?? `Версия ${version.versionNo}`,
      fileUrl: version.fileUrl,
      fileName: version.fileName,
      fileSize: version.fileSize,
      durationSec: version.durationSec,
      videoProvider: version.videoProvider,
      kinescopeVideoId: version.kinescopeVideoId,
      kinescopeAssetId: version.kinescopeAssetId,
      kinescopeProjectId: version.kinescopeProjectId,
      streamUrl: version.streamUrl,
      processingStatus: version.processingStatus,
      processingError: version.processingError,
      uploadedBy: {
        id: version.uploadedBy.id,
        name: `${version.uploadedBy.firstName} ${version.uploadedBy.lastName}`.trim(),
      },
      notes: version.notes,
      changeLog: version.changeLog,
      status: version.status,
      approvedBy: version.approvedBy,
      approvedAt: version.approvedAt,
      createdAt: version.createdAt,
    };
  }
}

export const assetService = new AssetService();
