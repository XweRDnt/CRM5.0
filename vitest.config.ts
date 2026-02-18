import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
    include: [
      "tests/**/*.test.ts",
      "lib/**/__tests__/**/*.test.ts",
      "components/**/__tests__/**/*.test.ts",
      "components/**/__tests__/**/*.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
