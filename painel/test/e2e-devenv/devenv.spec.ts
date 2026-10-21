import type { Page } from "@playwright/test";
import { expect, newTab, test } from "../e2e/guard";

/**
 * Smoke contra a API REAL do dev-env (API em http://localhost:8000, painel na 3001). Contas do
 * seed: estabelecimento 11222333000181 / NovaSenha@1, motoboy 52998224725 / Teste@123.
 * O build precisa ter `NEXT_PUBLIC_API_URL=http://localhost:8000`.
 */
const API = "http://localhost:8000";
const REFRESH = `${API}/v1/web/auth/refresh`;
const TOKEN = `${API}/v1/web/auth/token`;
const STORE = { doc: "11222333000181", password: "NovaSenha@1", name: "Padaria Teste LTDA" };
const DRIVER = { doc: "52998224725", password: "Teste@123" };

const alertOf = (page: Page) => page.locator("main [role=alert]");

async function login(page: Page, doc: string, password: string) {
  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill(doc);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function expectShell(page: Page, path = "/ao-vivo/") {
  await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
  await expect(page.getByText(STORE.name).first()).toBeVisible();
}

test.beforeEach(({ guard }) => {
  guard.expectResponse(REFRESH, 401); // primeira visita, sem cookie
});

test("login real → F5 restaura → sair", async ({ page, context }) => {
  await login(page, STORE.doc, STORE.password);
  await expectShell(page);

  const cookie = (await context.cookies()).find((c) => c.name === "mk_rt");
  expect(cookie, "cookie de refresh").toBeTruthy();
  expect(cookie!.path).toBe("/v1/web/auth");
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.secure).toBe(true);
  expect(cookie!.sameSite).toBe("Strict");

  const stored = await page.evaluate(() => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    cookie: document.cookie,
  }));
  expect(stored.local).not.toContain("eyJ");
  expect(stored.session).not.toContain("eyJ");
  expect(stored.cookie).toBe("");

  await page.reload();
  await expectShell(page);
  await expect(page.getByLabel("Senha")).toHaveCount(0);

  await page.getByRole("link", { name: "Conta" }).first().click();
  await expect(page.getByText("11.222.333/0001-81")).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar\/$/);
  expect((await context.cookies()).find((c) => c.name === "mk_rt")).toBeUndefined();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Painel do estabelecimento" })).toBeVisible();
});

test("motoboy é recusado com o texto do catálogo", async ({ page, guard }) => {
  guard.expectResponse(TOKEN, 400);
  await login(page, DRIVER.doc, DRIVER.password);
  await expect(alertOf(page)).toHaveText("O painel é só para estabelecimentos.");
  await expect(page).toHaveURL(/\/entrar\/$/);
});

test("?de= hostil cai no Mapa ao vivo; ?de= válido volta para a rota", async ({ page }) => {
  await page.goto("/equipe/?semana=2026-10-05");
  await expect(page).toHaveURL(/\/entrar\/\?de=%2Fequipe%2F%3Fsemana%3D2026-10-05$/);
  await page.getByLabel("CPF/CNPJ ou e-mail").fill(STORE.doc);
  await page.getByLabel("Senha", { exact: true }).fill(STORE.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expectShell(page, "/equipe/?semana=2026-10-05".replace("?", "\\?"));

  for (const hostile of ["//evil.com", "/\\evil.com", "https://evil.com", "%2F%2Fevil.com", "/equipe/%0d%0a", "/nao-existe/"]) {
    await page.goto(`/entrar/?de=${encodeURIComponent(hostile)}`);
    await expect(page).toHaveURL(/\/ao-vivo\/$/);
  }
});

test("duas abas no mesmo context: F5 juntos sem REUSED, e sair numa leva a outra ao login", async ({ page, context }) => {
  await login(page, STORE.doc, STORE.password);
  await expectShell(page);
  const other = await newTab(context);
  await other.goto("/equipe/");
  await expectShell(other, "/equipe/");

  const refreshes: number[] = [];
  context.on("response", (response) => {
    if (response.url() === REFRESH) refreshes.push(response.status());
  });
  await Promise.all([page.reload(), other.reload()]);
  await expectShell(page);
  await expectShell(other, "/equipe/");
  expect(refreshes).toEqual([200, 200]);

  await page.getByRole("link", { name: "Conta" }).first().click();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar\/$/);
  await expect(other).toHaveURL(/\/entrar\/(\?de=%2Fequipe%2F)?$/);
});
