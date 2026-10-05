import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // painel/ é outro app Next, com lint próprio (painel/eslint.config.mjs).
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "painel/**"]),
]);
