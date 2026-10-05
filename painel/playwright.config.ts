import { defineConfig, devices } from "@playwright/test";

/**
 * E2E com a API mockada (servidor HTTP na 8790, test/e2e/mockApi.ts) contra o `out/` servido pelo `wrangler dev` na 8787, que
 * aplica os `_headers` e o `_redirects` de verdade (DN-12, DN-18). Rode `yarn build` antes, com
 * `NEXT_PUBLIC_APP_ENV=e2e` (ou `prod` para conferir a variante de headers de prod).
 *
 * O E2E contra o dev-env real (API na 8000) é outro arquivo: `playwright.devenv.config.ts`.
 */
export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:8787",
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      // WebKit só no smoke das páginas sem sessão (o Safari não guarda cookie Secure em localhost).
      name: "webkit-smoke",
      use: { ...devices["Desktop Safari"] },
      grep: /@smoke/,
    },
  ],
  webServer: {
    command: "npx wrangler dev --port 8787 --show-interactive-dev-session=false",
    url: "http://localhost:8787/entrar/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
