import crypto from "node:crypto";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/utils/db";
import type { GetUploadUrlInput, ServiceContext, UploadUrlResponse } from "@/types";

const UPLOAD_URL_EXPIRATION_SECONDS = 3600;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/avi"];

type UploadContextInput = {
  tenantId: string;
};

export class StorageService {
  private s3Client: S3Client;
  private bucket: string;
  private region: string;

  constructor(private prismaClient: PrismaClient = prisma as PrismaClient) {
    this.region = process.env.AWS_REGION || "us-east-1";
    this.bucket = process.env.AWS_S3_BUCKET || "";

    if (!this.bucket) {
      throw new Error("AWS_S3_BUCKET environment variable is required");
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  async getUploadUrl(input: GetUploadUrlInput): Promise<UploadUrlResponse>;
  async getUploadUrl(context: UploadContextInput, input: Omit<GetUploadUrlInput, "tenantId">): Promise<UploadUrlResponse>;
  async getUploadUrl(
    inputOrContext: GetUploadUrlInput | UploadContextInput,
    maybeInput?: Omit<GetUploadUrlInput, "tenantId">,
  ): Promise<UploadUrlResponse> {
    const input = this.resolveUploadInput(inputOrContext, maybeInput);
    this.validateUploadInput(input);

    const { tenantId, projectId, fileName, fileType, fileSize } = input;

    const tenant = await this.prismaClient.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new Error("Tenant not found");
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

    const fileExtension = path.extname(fileName);
    const versionId = crypto.randomUUID();
    const fileKey = `tenants/${tenantId}/projects/${projectId}/versions/${versionId}${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: fileType,
      ContentLength: fileSize,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: UPLOAD_URL_EXPIRATION_SECONDS,
    });

    return {
      uploadUrl,
      fileKey,
      fileUrl: `https://${this.bucket}.s3.${this.region}.amazonaws.com/${fileKey}`,
      expiresIn: UPLOAD_URL_EXPIRATION_SECONDS,
    };
  }

  async confirmUpload(fileKey: string, tenantId: string): Promise<void> {
    if (!fileKey.startsWith(`tenants/${tenantId}/`)) {
      throw new Error("File key does not belong to this tenant");
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
      });
      await this.s3Client.send(command);
    } catch (error) {
      if (typeof error === "object" && error !== null && ("name" in error || "$metadata" in error)) {
        const awsError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (awsError.name === "NotFound" || awsError.$metadata?.httpStatusCode === 404) {
          throw new Error("File not found in storage");
        }
      }
      throw error;
    }
  }

  async getDownloadUrl(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
  async deleteObject(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
  async moveObject(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
  async validateUploadMetadata(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
  async generatePublicThumbnailUrl(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
  async copyObject(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }
  async healthCheckStorage(_context: ServiceContext, _input?: unknown): Promise<unknown> {
    throw new Error("Not implemented");
  }

  private resolveUploadInput(
    inputOrContext: GetUploadUrlInput | UploadContextInput,
    maybeInput?: Omit<GetUploadUrlInput, "tenantId">,
  ): GetUploadUrlInput {
    if (!maybeInput) {
      return inputOrContext as GetUploadUrlInput;
    }

    return {
      ...maybeInput,
      tenantId: (inputOrContext as UploadContextInput).tenantId,
    };
  }

  private validateUploadInput(input: GetUploadUrlInput): void {
    const fileName = input.fileName?.trim();
    if (!fileName || fileName.length > 255) {
      throw new Error("Invalid file name");
    }

    if (!ALLOWED_VIDEO_TYPES.includes(input.fileType)) {
      throw new Error(`File type ${input.fileType} not supported. Allowed: ${ALLOWED_VIDEO_TYPES.join(", ")}`);
    }

    if (input.fileSize > MAX_FILE_SIZE_BYTES) {
      throw new Error("File size exceeds maximum of 5GB");
    }
  }
}

export const storageService = new StorageService();
