import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("health route", () => {
  it("returns ok status", async () => {
    const response = await GET();
    const payload = await response.json();

    expect(payload.data.status).toBe("ok");
  });
});
