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
    // MAP_STYLE vazio: o CI define a URL do mock no job inteiro (para o build e2e), e o teste
    // de "Mapa não configurado" não pode depender do ambiente de quem roda.
    env: { NEXT_PUBLIC_API_URL: "http://api.test", NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_MAP_STYLE_URL: "" },
  },
});
