import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: true,
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/api/global-setup.ts"],
    include: ["./tests/api/**/*.test.ts"],
  },
});
