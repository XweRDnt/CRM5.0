import { describe, expect, it } from "vitest";
import { getVersionLabel } from "@/lib/utils/version-label";

describe("getVersionLabel", () => {
  it("returns custom title when user renamed the version", () => {
    expect(getVersionLabel({ title: "Client Cut Final", versionNumber: 3 })).toBe("Client Cut Final");
  });

  it("falls back to generated label when title is empty", () => {
    expect(getVersionLabel({ title: "   ", versionNumber: 3 })).toBe("Версия 3");
  });
});
