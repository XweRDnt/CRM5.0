import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/utils/db";
import { putPublicObject } from "@/lib/services/s3.service";

type AnnotationPreviewInput = {
  assetVersionId: string;
  pngBase64: string;
};

type PrismaLike = {
  assetVersion: {
    findUnique: (args: {
      where: { id: string };
      select: { project: { select: { tenantId: true } } };
    }) => Promise<{ project: { tenantId: string } } | null>;
  };
};

type AnnotationPreviewDeps = {
  prisma: PrismaLike;
  putPublicObject: typeof putPublicObject;
  bucket: string;
  region: string;
};

type AnnotationPreviewResult = {
  url: string;
};

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for annotation preview uploads`);
  }
  return value;
};

const stripDataUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith("data:image/png;base64,")) {
    return trimmed.replace(/^data:image\/png;base64,/, "");
  }
  return trimmed;
};

const buildKey = (tenantId: string): string => `annotations/${tenantId}/${randomUUID()}.png`;

export const createAnnotationPreview = async (
  input: AnnotationPreviewInput,
  deps: AnnotationPreviewDeps = {
    prisma,
    putPublicObject,
    bucket: requireEnv("AWS_S3_BUCKET"),
    region: requireEnv("AWS_REGION"),
  },
): Promise<AnnotationPreviewResult> => {
  const version = await deps.prisma.assetVersion.findUnique({
    where: { id: input.assetVersionId },
    select: { project: { select: { tenantId: true } } },
  });

  if (!version) {
    throw new Error("Asset version not found");
  }

  const base64 = stripDataUrl(input.pngBase64);
  if (!base64) {
    throw new Error("Preview payload is empty");
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new Error("Preview payload is empty");
  }

  const key = buildKey(version.project.tenantId);
  const result = await deps.putPublicObject({
    bucket: deps.bucket,
    key,
    body: buffer,
    contentType: "image/png",
    region: deps.region,
  });

  return { url: result.url };
};
