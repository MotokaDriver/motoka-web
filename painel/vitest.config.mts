import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/unit/**/*.test.{ts,tsx}"],
    env: { NEXT_PUBLIC_API_URL: "http://api.test", NEXT_PUBLIC_APP_ENV: "e2e" },
  },
});
