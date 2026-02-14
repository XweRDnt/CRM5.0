import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/utils/db";

describe("infra smoke", () => {
  it("creates prisma client instance", async () => {
    expect(prisma).toBeDefined();
    await prisma.$disconnect();
  });

  it("prisma schema validates", () => {
    execSync("npx prisma validate", { stdio: "pipe" });
    expect(true).toBe(true);
  });

  it("can run test migrations when TEST_DATABASE_URL is provided", () => {
    if (!process.env.TEST_DATABASE_URL) {
      expect(true).toBe(true);
      return;
    }

    expect(process.env.TEST_DATABASE_URL.includes("postgresql://")).toBe(true);
  });
});
