import { prisma } from "@/lib/utils/db";

type CreateTestAssetVersionOptions = {
  fileName?: string;
  versionNo?: number;
};

export async function createTestAssetVersion(
  projectId: string,
  uploadedByUserId: string,
  options: CreateTestAssetVersionOptions = {},
) {
  const { fileName = "test-video.mp4", versionNo = 1 } = options;

  return prisma.assetVersion.create({
    data: {
      projectId,
      versionNo,
      fileUrl: `https://s3.amazonaws.com/test/${fileName}`,
      fileKey: `test/projects/${projectId}/versions/${fileName}`,
      fileName,
      fileSize: 10000000,
      durationSec: 120,
      uploadedByUserId,
      uploadedByLegacy: uploadedByUserId,
    },
  });
}
