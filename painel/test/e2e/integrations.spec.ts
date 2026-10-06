import { expect, test } from "./guard";
import { API } from "./mockApi";

const REFRESH = `${API}/v1/web/auth/refresh`;
const MERCHANT = "12345678000199-11111111-2222-4333-8444-555555555555";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
  await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);
}

const awaitingItem = (id: string, number: number, over: Record<string, unknown> = {}) => ({
  id,
  number,
  origin: "open_delivery",
  channel: null,
  status: "awaiting_acceptance",
  customer: { name: "Marina Souza", address_line: "Rua Chile, 1880", neighborhood: "Rebouças" },
  driver: null,
  previewed_driver: { id: "d0000001-0000-4000-8000-000000000001", short_name: "Diego R.", initials: "DR" },
  needs_attention: true,
  accept_deadline_at: new Date(Date.now() + 100_000).toISOString(),
  situation: "busy",
  ...over,
});

test.describe("Aceite de pedidos do PDV (WN-4a, API mockada)", () => {
  test("banner, aceitar com o previsto e chamar reforço", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.services.awaiting = [awaitingItem("a0000001-0000-4000-8000-000000000001", 189), awaitingItem("a0000002-0000-4000-8000-000000000002", 190)];
    await login(page);
    await page.goto("/pedidos/");
    await expect(page.getByText("2 pedidos esperando o seu aceite")).toBeVisible();
    await page.getByRole("button", { name: "Responder" }).click();
    const list = page.getByRole("list", { name: "Pedidos esperando o aceite" });
    await expect(list.getByText(/Diego R\. é o motoboy previsto, livre em 4 min/).first()).toBeVisible();
    await expect(list.getByText(/^\d:\d\d$/).first()).toBeVisible();

    await list.getByRole("listitem").filter({ hasText: "#189" }).getByRole("button", { name: "Aceitar · Diego R. leva" }).click();
    await expect(page.getByText("Pedido #189 aceito.")).toBeVisible();
    expect(api.services.accepted).toEqual(["a0000001-0000-4000-8000-000000000001"]);

    // O que sobrou: aceitar e chamar reforço abre Solicitar serviço.
    await page.getByRole("button", { name: "Aceitar e chamar reforço" }).click();
    await expect(page).toHaveURL(/\/servicos\/novo\/$/);
    expect(api.services.accepted).toHaveLength(2);
  });

  test("recusar pede confirmação e avisa a origem; fora de /pedidos o banner depende de integração conectada", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.services.awaiting = [awaitingItem("a0000003-0000-4000-8000-000000000003", 191)];
    await login(page);
    // Sem integração conectada, as outras telas não consultam nem mostram o banner.
    await page.goto("/equipe/");
    await expect(page.getByRole("heading", { name: "Minha equipe", level: 1 })).toBeVisible();
    await expect(page.getByText("1 pedido esperando o seu aceite")).toHaveCount(0);
    await page.goto("/pedidos/");
    await page.getByRole("button", { name: "Responder" }).click();
    await page.getByRole("list", { name: "Pedidos esperando o aceite" }).getByRole("button", { name: "Recusar" }).click();
    const dialog = page.getByRole("dialog", { name: "Recusar o pedido #191?" });
    await expect(dialog).toContainText("O Open Delivery será avisado");
    await dialog.getByRole("button", { name: "Recusar" }).click();
    await expect(page.getByText("Pedido #191 recusado. O Open Delivery foi avisado.")).toBeVisible();
    expect(api.services.rejected).toEqual(["a0000003-0000-4000-8000-000000000003"]);
  });

  test("sem ninguém em turno só existe a recusa", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.services.awaiting = [awaitingItem("a0000004-0000-4000-8000-000000000004", 192, { situation: "empty", previewed_driver: null })];
    await login(page);
    await page.goto("/pedidos/");
    await page.getByRole("button", { name: "Responder" }).click();
    const list = page.getByRole("list", { name: "Pedidos esperando o aceite" });
    await expect(list.getByText("Ninguém em turno agora: só dá para recusar.")).toBeVisible();
    await expect(list.getByRole("button", { name: /Aceitar/ })).toHaveCount(0);
  });
});

test.describe("Integrações (WN-4b, API mockada)", () => {
  test("conectar o Open Delivery: salvar, gerar credenciais (secret uma vez), testar e desconectar", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse(/\/v1\/integrations\/open_delivery$/, 409);
    await login(page);
    await page.getByRole("link", { name: "Integrações" }).first().click();
    await expect(page).toHaveURL(/\/integracoes\/$/);
    const grid = page.getByRole("list", { name: "Conectores" });
    await expect(grid.getByRole("button", { name: "Open Delivery, Conectar" })).toBeVisible();
    await expect(grid.getByText("Em breve")).toBeVisible();
    await expect(grid.getByText("Saipos")).toHaveCount(0);

    const panel = page.getByRole("complementary", { name: "Detalhe da integração" });
    await panel.getByLabel("Merchant ID que o seu sistema mostrou").fill("curto");
    await panel.getByRole("button", { name: "Salvar" }).click();
    await expect(panel.getByText(/pelo menos 36 caracteres/)).toBeVisible();
    await panel.getByLabel("Merchant ID que o seu sistema mostrou").fill(api.services.takenMerchant);
    await panel.getByRole("button", { name: "Salvar" }).click();
    await expect(panel.getByText("Este ID de loja já está ligado a outra conta do Motoka.")).toBeVisible();

    await panel.getByLabel("Merchant ID que o seu sistema mostrou").fill(MERCHANT);
    await panel.getByLabel("URL de eventos (webhook)").fill("http://inseguro.com");
    await panel.getByRole("button", { name: "Salvar" }).click();
    await expect(panel.getByText("Use um endereço https.")).toBeVisible();
    await panel.getByLabel("URL de eventos (webhook)").fill("https://pdv.exemplo.com/eventos");
    await panel.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByText("Integração salva.")).toBeVisible();

    await panel.getByRole("button", { name: "Gerar credenciais" }).click();
    const alert = panel.getByRole("alert").filter({ hasText: "não aparece de novo" });
    await expect(alert).toBeVisible();
    await alert.getByRole("button", { name: "Mostrar Client secret" }).click();
    const secret = api.services.issuedSecrets[0] ?? "";
    await expect(alert.getByTestId("secret-value")).toHaveText(secret);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await alert.getByRole("button", { name: "Copiar Client secret" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(secret);
    // O toast não leva o secret.
    await expect(page.getByText("Client secret copiado.")).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(secret);

    // Recarregar: o secret não volta, só a dica.
    await page.reload();
    await expect(panel.getByText("••••••••••••abcd")).toBeVisible();
    await expect(page.getByText(secret)).toHaveCount(0);
    await expect(grid.getByRole("button", { name: "Open Delivery, Conectado" })).toBeVisible();

    await panel.getByRole("button", { name: "Testar conexão" }).click();
    await expect(panel.getByText("Conectou e o certificado é válido (resposta HTTP 405).")).toBeVisible();

    await panel.getByRole("button", { name: "Gerar novo secret" }).click();
    await page.getByRole("dialog", { name: "Gerar novo secret?" }).getByRole("button", { name: "Gerar novo secret" }).click();
    await expect(alert).toBeVisible();
    expect(api.services.issuedSecrets).toHaveLength(2);

    await panel.getByRole("button", { name: "Desconectar" }).click();
    await page.getByRole("dialog", { name: "Desconectar a integração?" }).getByRole("button", { name: "Desconectar" }).click();
    await expect(page.getByText("Integração desconectada.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Gerar credenciais" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Atividade recente" }).getByText("Integração desconectada")).toBeVisible();
  });

  test("a Saipos só aparece quando a API a libera", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.services.saiposAvailable = true;
    await login(page);
    await page.goto("/integracoes/");
    const grid = page.getByRole("list", { name: "Conectores" });
    await expect(grid.getByRole("button", { name: "Saipos, Conectar" })).toBeVisible();
    await grid.getByRole("button", { name: "Saipos, Conectar" }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe da integração" });
    await expect(panel.getByLabel("Merchant ID que a Saipos mostrou")).toBeVisible();
    // Perfil Saipos: sem URL de eventos nem preço.
    await expect(panel.getByLabel("URL de eventos (webhook)")).toHaveCount(0);
  });
});
