import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra a API REAL do dev-env (D:\dev\motoka\dev-env, API em http://localhost:8000), com o
 * `out/` servido pelo `wrangler dev` na **3001**: é a origem que a API de dev aceita hoje em
 * `WEB_AUTH_ORIGINS`/`CORS_ORIGINS` (a 8787 é o hand-off A-1). Não roda no CI; precisa do dev-env no
 * ar e das contas de teste (README do painel).
 */
export default defineConfig({
  testDir: "./test/e2e-devenv",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 45_000,
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npx wrangler dev --port 3001 --show-interactive-dev-session=false",
    url: "http://localhost:3001/entrar/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
