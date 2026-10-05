import type { Page } from "@playwright/test";
import { expect, newTab, test } from "./guard";
import { API, COOKIE, type MockApi, type StoreDoc } from "./mockApi";

const REFRESH = `${API}/v1/web/auth/refresh`;
const CAPABILITIES = `${API}/v1/web/capabilities`;

/** Os alertas do painel; o Next tem um anunciador de rota com role=alert fora do <main>. */
const alertOf = (page: Page) => page.locator("main [role=alert]");

async function login(page: Page, doc: StoreDoc = "11222333000181", password = "NovaSenha@1") {
  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill(doc);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Senha", { exact: true }).press("Enter");
}

async function expectShell(page: Page, store = "Padaria Teste LTDA") {
  await expect(page).toHaveURL(/\/ao-vivo\/$/);
  await expect(page.getByRole("heading", { name: "Mapa ao vivo", level: 1 })).toBeVisible();
  await expect(page.getByText(store).first()).toBeVisible();
}

/**
 * Adianta o relógio da página e navega pela sidebar: a tela nova monta a query de capabilities
 * já vencida (staleTime de 5 min), e o Query refaz o pedido com o access atual.
 */
async function refetchAfter(page: Page, minutes: number, link = "Minha equipe") {
  await page.clock.fastForward(minutes * 60_000);
  await page.getByRole("link", { name: link }).first().click();
  await page.waitForURL((url) => url.pathname !== "/ao-vivo/");
  // Os timers da página (o agendador do Query usa setTimeout) andam com o relógio falso.
  await page.clock.runFor(2_000);
}

test.describe("sessão (API mockada)", () => {
  test("login → shell → F5 restaura → sair", async ({ page, context, guard, api }) => {
    guard.expectResponse(REFRESH, 401); // primeira visita, sem cookie

    await login(page);
    await expectShell(page);
    await expect(page).toHaveTitle("Mapa ao vivo · Motoka");

    const cookie = (await context.cookies()).find((c) => c.name === COOKIE);
    expect(cookie?.path).toBe("/v1/web/auth");
    expect(cookie?.httpOnly).toBe(true);

    // O access nunca vai para storage nem para cookie do painel.
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
    expect(api.loginCalls).toBe(1);

    await page.getByRole("link", { name: "Conta" }).click();
    await expect(page).toHaveURL(/\/conta\/$/);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar\/$/);
    expect(api.logoutCalls).toBe(1);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Painel do estabelecimento" })).toBeVisible();
  });

  test("credencial errada mostra o texto do catálogo", async ({ page, guard }) => {
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse(`${API}/v1/web/auth/token`, 401);
    await login(page, "11222333000181", "errada");
    await expect(alertOf(page)).toHaveText("CPF/CNPJ, e-mail ou senha incorretos.");
  });

  test("?de= hostil cai no Mapa ao vivo; ?de= válido volta para a rota", async ({ page, guard }) => {
    guard.expectResponse(REFRESH, 401);
    await page.goto("/equipe/?semana=2026-10-05");
    await expect(page).toHaveURL(/\/entrar\/\?de=%2Fequipe%2F%3Fsemana%3D2026-10-05$/);
    await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
    await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/equipe\/\?semana=2026-10-05$/);

    for (const hostile of ["//evil.com", "/\\evil.com", "https://evil.com", "%2F%2Fevil.com", "/equipe/%0d%0a", "/nao-existe/", "/equipe/?de=/conta/"]) {
      await page.goto(`/entrar/?de=${encodeURIComponent(hostile)}`);
      await expect(page).toHaveURL(/\/ao-vivo\/$/);
    }
  });

  test("sem rede no boot: mensagem de conexão com Tentar de novo, não o login", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 0);
    guard.expectResponse(REFRESH, 401);
    api.refreshOffline = true;
    await page.goto("/ao-vivo/");
    await expect(alertOf(page)).toContainText("Não foi possível conectar ao Motoka");
    await expect(page).toHaveURL(/\/ao-vivo\/$/);
    await expect(page.getByLabel("Senha")).toHaveCount(0);
    api.refreshOffline = false;
    await page.getByRole("button", { name: "Tentar de novo" }).click();
    // Sem cookie: agora decide e vai ao login, guardando a rota.
    await expect(page).toHaveURL(/\/entrar\/\?de=%2Fao-vivo%2F$/);
  });

  for (const [status, code] of [
    [503, "INTERNAL_ERROR"],
    [429, "RATE_LIMIT_EXCEEDED"],
  ] as const) {
    test(`${status} no refresh não desloga`, async ({ page, guard, api }) => {
      guard.expectResponse(REFRESH, 401);
      guard.expectResponse(REFRESH, status);
      await login(page);
      await expectShell(page);
      api.nextRefreshError = { status, code };
      await page.reload();
      await expect(alertOf(page)).toContainText("Não foi possível conectar ao Motoka");
      await page.getByRole("button", { name: "Tentar de novo" }).click();
      await expectShell(page);
    });
  }

  test("expiração no meio da sessão (401 forçado) leva ao login com o motivo e o ?de=", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse(CAPABILITIES, 401);
    await page.clock.install();
    await login(page);
    await expectShell(page);
    api.staleUpTo = api.tokensIssued;
    api.nextRefreshError = { status: 401, code: "AUTH_SESSION_EXPIRED" };
    await refetchAfter(page, 6);
    await expect(page).toHaveURL(/\/entrar\/\?de=%2Fequipe%2F$/);
    await expect(alertOf(page)).toHaveText("Sua sessão expirou. Entre novamente.");
  });
});

test.describe("duas abas no mesmo context (critério 4)", () => {
  async function twoTabsHittingExpiry(page: Page, other: Page, api: MockApi) {
    await login(page);
    await expectShell(page);
    await other.goto("/ao-vivo/");
    await expectShell(other);
    // Os tokens que as duas abas vão receber no boot já nascem "vencidos" para as capabilities:
    // cada aba recebe 401 e precisa de um refresh, as duas ao mesmo tempo.
    api.staleUpTo = api.tokensIssued + 2;
    api.refreshes.length = 0;
    await Promise.all([page.reload(), other.reload()]);
  }

  test("o lock serializa os W2 e ninguém recebe REUSED", async ({ page, context, guard, api }) => {
    api.refreshLatencyMs = 300;
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse(CAPABILITIES, 401);
    const other = await newTab(context);
    await twoTabsHittingExpiry(page, other, api);
    await expectShell(page);
    await expectShell(other);
    await expect.poll(() => api.refreshes.length).toBe(4);
    expect(api.refreshes.every((r) => r.status === 200)).toBe(true);
    expect(api.overlapping()).toBe(false);
  });

  test("controle negativo: sem navigator.locks os W2 se sobrepõem", async ({ page, context, guard, api }) => {
    api.refreshLatencyMs = 300;
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "locks", { get: () => undefined, configurable: true });
    });
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse(CAPABILITIES, 401);
    const other = await newTab(context);
    await twoTabsHittingExpiry(page, other, api);
    await expect.poll(() => api.refreshes.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
    expect(api.overlapping()).toBe(true);
    expect(api.refreshes.some((r) => r.code === "AUTH_REFRESH_REUSED")).toBe(true);
  });

  test("sair na aba A leva a aba B ao login sem um segundo W3", async ({ page, context, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    await login(page);
    await expectShell(page);
    const other = await newTab(context);
    await other.goto("/equipe/");
    await expect(other.getByRole("heading", { name: "Minha equipe", level: 1 })).toBeVisible();
    await page.goto("/conta/");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar\/$/);
    await expect(other).toHaveURL(/\/entrar\/(\?de=%2Fequipe%2F)?$/);
    expect(api.logoutCalls).toBe(1);
  });
});

test("troca de conta no mesmo context (critério 5)", async ({ page, context, guard, api }) => {
  guard.expectResponse(REFRESH, 401);
  guard.expectResponse(CAPABILITIES, 401);
  await page.clock.install();
  await login(page, "11222333000181");
  await expectShell(page, "Padaria Teste LTDA");
  const tokenOfA = api.tokensIssued;

  // A aba B entra com outra loja: o cookie compartilhado é sobrescrito. Com o cookie da loja 1 no
  // jar, a aba B restauraria a loja 1 sem mostrar o login; por isso o cookie cai antes (como numa
  // ociosidade ou limpeza de cookies), e a aba A segue com o access da loja 1 em memória.
  await context.clearCookies();
  const other = await newTab(context);
  await other.goto("/entrar/");
  await other.getByLabel("CPF/CNPJ ou e-mail").fill("99888777000166");
  await other.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
  await other.getByRole("button", { name: "Entrar" }).click();
  await expectShell(other, "Pizzaria do Zé");

  // O próximo W2 da aba A manda o cookie da loja 2 (o mock decide o sub pelo valor do cookie).
  api.staleUpTo = tokenOfA;
  await refetchAfter(page, 6);
  await expect(page).toHaveURL(/\/entrar\//);
  await expect(alertOf(page)).toHaveText("Outra conta entrou neste navegador. Entre novamente.");
  // A aba B continua com a loja 2.
  await expect(other.getByText("Pizzaria do Zé").first()).toBeVisible();
  await expect(other).toHaveURL(/\/ao-vivo\/$/);
});

test("atalhos: ? abre a ajuda, não dispara em campo, e desligados em Preferências nenhum dispara", async ({ page, guard }) => {
  guard.expectResponse(REFRESH, 401);
  await login(page);
  await expectShell(page);
  await page.keyboard.press("?");
  const help = page.getByRole("dialog", { name: "Atalhos de teclado" });
  await expect(help).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();

  await page.getByRole("link", { name: "Conta" }).first().click();
  await page.getByRole("switch", { name: "Atalhos de teclado" }).click();
  await page.keyboard.press("?");
  await expect(help).toBeHidden();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Atalhos de teclado" })).not.toBeChecked();
  await page.keyboard.press("?");
  await expect(help).toBeHidden();
});

test("tipografia do design: pesos do PageHead e do item ativo (regressão do type-* sobre font-*)", async ({ page, guard }) => {
  guard.expectResponse(REFRESH, 401);
  await login(page);
  await expectShell(page);
  const weight = (locator: ReturnType<Page["locator"]>) => locator.evaluate((el) => getComputedStyle(el).fontWeight);
  expect(await weight(page.getByRole("heading", { level: 1, name: "Mapa ao vivo" }))).toBe("700");
  expect(await weight(page.locator('nav a[aria-current="page"]').first())).toBe("600");
  await page.getByRole("link", { name: "Conta" }).first().click();
  expect(await weight(page.getByRole("heading", { level: 2, name: "Cadastro" }))).toBe("700");
});
