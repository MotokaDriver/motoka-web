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
    // Chave do mapa vazia: o CI define a chave falsa no job inteiro (para o build e2e), e o teste
    // de "Mapa não configurado" não pode depender do ambiente de quem roda.
    env: { NEXT_PUBLIC_API_URL: "http://api.test", NEXT_PUBLIC_APP_ENV: "e2e", NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "", NEXT_PUBLIC_GOOGLE_TILES_URL: "" },
  },
});
