import { describe, it, expect, vi } from "vitest";
import { putPublicObject } from "@/lib/services/s3.service";

describe("s3.service", () => {
  it("builds a public url for uploaded preview", async () => {
    const client = { send: vi.fn(async () => ({})) };
    const result = await putPublicObject({
      client,
      bucket: "test-bucket",
      key: "annotations/test.png",
      body: Buffer.from("png"),
      contentType: "image/png",
      region: "eu-central-1",
    });
    expect(result.url).toContain("test-bucket");
  });
});
