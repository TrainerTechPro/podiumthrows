import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` throws on import outside an RSC context. Vitest
      // runs in node, so any test touching a server-only-marked file
      // would crash. The marker enforces a bundler boundary, not a
      // runtime check — tests can safely no-op it.
      "server-only": path.resolve(__dirname, "./src/__tests__/server-only-mock.ts"),
    },
  },
});
