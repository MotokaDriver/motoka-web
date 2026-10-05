import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import tseslint from "typescript-eslint";

// Segurança por lint (DN-13). As regras abaixo valem para todo o código do app; os testes e os
// scripts de build têm exceções pontuais.
const forbidden = {
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-script-url": "error",
  "react/no-danger": "error",
  "react/jsx-no-target-blank": ["error", { allowReferrer: false, enforceDynamicLinks: "always" }],
  "no-restricted-syntax": [
    "error",
    {
      selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
      message: "dangerouslySetInnerHTML é proibido no painel (§6.2).",
    },
    {
      selector: "CallExpression[callee.object.name='window'][callee.property.name='open']",
      message: "Use <a target=\"_blank\" rel=\"noopener noreferrer\"> em vez de window.open.",
    },
    {
      selector: "CallExpression[callee.name='open']",
      message: "Use <a target=\"_blank\" rel=\"noopener noreferrer\"> em vez de open().",
    },
  ],
  "no-restricted-imports": [
    "error",
    {
      paths: [{ name: "zod", message: "Importe de @/lib/zod (zod/mini, jitless, CSP sem unsafe-eval)." }],
      patterns: [{ group: ["zod/*"], message: "Importe de @/lib/zod (zod/mini, jitless, CSP sem unsafe-eval)." }],
    },
  ],
  "no-restricted-globals": [
    "error",
    { name: "localStorage", message: "localStorage só em src/lib/prefs (DN-13)." },
    { name: "sessionStorage", message: "sessionStorage só em src/lib/prefs (DN-13)." },
  ],
  "no-restricted-properties": [
    "error",
    { object: "window", property: "localStorage", message: "localStorage só em src/lib/prefs (DN-13)." },
    { object: "window", property: "sessionStorage", message: "sessionStorage só em src/lib/prefs (DN-13)." },
  ],
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // O eslint-config-next já registra os plugins @typescript-eslint e jsx-a11y: daqui só as regras.
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: Object.assign({}, ...tseslint.configs.strict.map((config) => config.rules ?? {})),
  },
  { rules: jsxA11y.flatConfigs.recommended.rules },
  {
    files: ["**/*.{ts,tsx,mts}"],
    rules: {
      ...forbidden,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // Páginas sem framework e o theme-init: JS de navegador antigo, catch com variável.
    files: ["public/**/*.js", "static-pages/**/*.js"],
    rules: { "@typescript-eslint/no-unused-vars": ["error", { caughtErrors: "none" }] },
  },
  {
    files: ["src/lib/zod.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    // O único lugar com storage do navegador.
    files: ["src/lib/prefs/**"],
    rules: { "no-restricted-globals": "off", "no-restricted-properties": "off" },
  },
  {
    files: ["test/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      // Os testes usam `javascript:` como entrada hostil.
      "no-script-url": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "node_modules/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    ".wrangler/**",
    "src/icons/registry.ts",
  ]),
]);
