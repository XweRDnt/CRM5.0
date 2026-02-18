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
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/services/global-setup.ts"],
    include: ["./lib/services/__tests__/**/*.test.ts", "./lib/jobs/__tests__/**/*.test.ts"],
  },
});
