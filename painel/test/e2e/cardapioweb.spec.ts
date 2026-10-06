import { expect, test } from "./guard";
import { API } from "./mockApi";

const REFRESH = `${API}/v1/web/auth/refresh`;
const DIEGO = "d0000001-0000-4000-8000-000000000001";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
  await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);
}

test.describe("Cardápio Web (WN-4c, API mockada)", () => {
  test("conectar pelo portal (PKCE), vincular motoboy, sincronizar e desconectar", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    await login(page);
    await page.goto("/integracoes/");
    const grid = page.getByRole("list", { name: "Conectores" });
    // iFood e Nuvemshop: em breve.
    await expect(grid.getByText("Em breve")).toHaveCount(1); // só o iFood
    await grid.getByRole("button", { name: "Cardápio Web, Conectar" }).click();
    await page.getByRole("button", { name: "Conectar ao Cardápio Web" }).click();

    // O portal (de mentira) devolve o navegador com o code e o mesmo state; o painel confere e conclui.
    await expect(page.getByText("Cardápio Web conectado.")).toBeVisible();
    await expect(page).toHaveURL(/\/integracoes\/$/);
    expect(api.services.cwCompleteCalls).toBe(1);
    // O state some do storage depois do uso, e o code não fica no endereço.
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("state-");
    expect(page.url()).not.toContain("code=");

    await expect(grid.getByRole("button", { name: "Cardápio Web, Conectado" })).toBeVisible();
    await grid.getByRole("button", { name: "Cardápio Web, Conectado" }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe da integração" });
    await expect(panel.getByText("Loja 7731")).toBeVisible();
    await expect(panel.getByText(/não cancela o pedido no Cardápio Web/)).toBeVisible();

    const links = panel.getByRole("list", { name: "Vínculos" });
    await links.getByLabel("Entregador de Diego Ramos").selectOption("77");
    await expect(page.getByText("Motoboy vinculado.")).toBeVisible();
    expect(api.services.cwLinks.get(DIEGO)).toBe("77");
    // Quem já está vinculado a outro motoboy não pode ser escolhido de novo.
    await expect(links.getByLabel("Entregador de Rafa Lima").locator("option", { hasText: "Diego R." })).toBeDisabled();
    await links.getByLabel("Entregador de Diego Ramos").selectOption("");
    await expect(page.getByText("Vínculo removido.")).toBeVisible();
    expect(api.services.cwLinks.size).toBe(0);

    await panel.getByRole("button", { name: "Sincronizar agora" }).click();
    await expect(page.getByText("Sincronizado: 3 pedidos na fila.")).toBeVisible();

    await panel.getByRole("button", { name: "Desconectar" }).click();
    await page.getByRole("dialog", { name: "Desconectar o Cardápio Web?" }).getByRole("button", { name: "Desconectar" }).click();
    await expect(page.getByText("Integração desconectada.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Conectar ao Cardápio Web" })).toBeVisible();
  });

  test("volta do portal com state diferente do guardado é recusada sem chamar a API", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    await login(page);
    await page.evaluate(() => sessionStorage.setItem("motoka.panel.oauth-pending", JSON.stringify({ type: "cardapio_web", state: "o-que-o-painel-guardou", at: Date.now() })));
    await page.goto("/integracoes/cardapio-web/retorno/?code=x&state=de-outra-pessoa");
    await expect(page.getByText("Não foi possível confirmar a conexão. Comece de novo pelo painel.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar para Integrações" })).toBeVisible();
    expect(api.services.cwCompleteCalls).toBe(0);
    expect(page.url()).not.toContain("state=");
  });

  test("ambiente sem a configuração do parceiro: Indisponível neste ambiente", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.services.cwConfigured = false;
    await login(page);
    await page.goto("/integracoes/");
    await page.getByRole("button", { name: "Cardápio Web, Indisponível neste ambiente" }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe da integração" });
    await expect(panel.getByText(/ainda não foi configurada neste ambiente/)).toBeVisible();
    await expect(panel.getByRole("button", { name: /Conectar/ })).toHaveCount(0);
  });

  test("pedido sem entregador vinculado aparece em Atenção", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.services.integrationActivity.unshift({ id: "e0000009-0000-4000-8000-000000000009", type: "cardapio_web", kind: "attention", delivery_id: "a0000009-0000-4000-8000-000000000009", delivery_number: 189, meta: { reason: "driver_not_linked" }, created_at: new Date().toISOString() });
    await login(page);
    await page.goto("/integracoes/");
    const attention = page.getByRole("region", { name: "Atenção" });
    await expect(attention.getByText("Pedido #189: sem entregador vinculado. Vincule o motoboy a um entregador do Cardápio Web.")).toBeVisible();
    await expect(attention.getByRole("link", { name: "Abrir pedido" })).toHaveAttribute("href", /\/pedidos\/\?pedido=a0000009/);
    // O card do Cardápio Web acende o selo e o link abre o painel dele.
    await expect(page.getByRole("button", { name: "Cardápio Web, Conectar, precisa de atenção" })).toBeVisible();
    await attention.getByRole("button", { name: "Vincular motoboy" }).click();
    await expect(page.getByRole("complementary", { name: "Detalhe da integração" }).getByRole("button", { name: "Conectar ao Cardápio Web" })).toBeVisible();
  });

  test("a API diz incomplete na volta: nada de conectado, e o card fica em Configuração incompleta", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.services.cwIncomplete = true;
    await login(page);
    await page.goto("/integracoes/");
    await page.getByRole("button", { name: "Cardápio Web, Conectar" }).click();
    await page.getByRole("button", { name: "Conectar ao Cardápio Web" }).click();
    await expect(page.getByText("A conexão ficou incompleta: o Cardápio Web não informou a loja. Conecte de novo.")).toBeVisible();
    await expect(page.getByText("Cardápio Web conectado.")).toHaveCount(0);
    await page.getByRole("link", { name: "Voltar para Integrações" }).click();
    await expect(page.getByRole("button", { name: "Cardápio Web, Configuração incompleta" })).toBeVisible();
  });
});
