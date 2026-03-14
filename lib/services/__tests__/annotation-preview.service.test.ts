import { describe, it, expect, vi } from "vitest";
import { createAnnotationPreview } from "@/lib/services/annotation-preview.service";

describe("annotation-preview.service", () => {
  it("uploads png and returns url", async () => {
    const prisma = {
      assetVersion: {
        findUnique: vi.fn(async () => ({ project: { tenantId: "tenant-1" } })),
      },
    };
    const putPublicObject = vi.fn(async () => ({ url: "https://bucket.s3.eu-central-1.amazonaws.com/annotations/test.png" }));

    const result = await createAnnotationPreview(
      {
        assetVersionId: "version-1",
        pngBase64: Buffer.from("png").toString("base64"),
      },
      {
        prisma,
        putPublicObject,
        bucket: "bucket",
        region: "eu-central-1",
      },
    );

    expect(result.url).toContain("https://bucket");
    expect(prisma.assetVersion.findUnique).toHaveBeenCalledWith({
      where: { id: "version-1" },
      select: { project: { select: { tenantId: true } } },
    });
    expect(putPublicObject).toHaveBeenCalled();
  });

  it("throws when asset version missing", async () => {
    const prisma = {
      assetVersion: {
        findUnique: vi.fn(async () => null),
      },
    };

    await expect(
      createAnnotationPreview(
        { assetVersionId: "missing", pngBase64: "" },
        { prisma, putPublicObject: vi.fn(), bucket: "bucket", region: "eu-central-1" },
      ),
    ).rejects.toThrow("Asset version not found");
  });
});
