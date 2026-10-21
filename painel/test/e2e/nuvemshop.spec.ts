import { expect, test } from "./guard";
import { API } from "./mockApi";

const REFRESH = `${API}/v1/web/auth/refresh`;

async function login(page: import("@playwright/test").Page) {
  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
  await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);
}

test.describe("Nuvemshop (WN-4d, API mockada)", () => {
  test("conectar pelo portal, configurar a cotação, gerar novo endereço e desconectar", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    await login(page);
    await page.goto("/integracoes/");
    const grid = page.getByRole("list", { name: "Conectores" });
    await expect(grid.getByText("Em breve")).toHaveCount(1); // só o iFood
    await grid.getByRole("button", { name: "Nuvemshop, Conectar" }).click();
    await page.getByRole("button", { name: "Conectar à Nuvemshop" }).click();

    // Portal de mentira: volta com code e state; o painel confere e conclui.
    await expect(page.getByText("Nuvemshop conectado.")).toBeVisible();
    await expect(page).toHaveURL(/\/integracoes\/$/);
    expect(page.url()).not.toContain("code=");
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain("state-");

    await grid.getByRole("button", { name: "Nuvemshop, Conectado" }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe da integração" });
    await expect(panel.getByLabel("Prazo de entrega (minutos)")).toHaveValue("60");

    await panel.getByLabel("Prazo de entrega (minutos)").fill("0");
    await panel.getByRole("button", { name: "Salvar cotação" }).click();
    await expect(panel.getByText("Informe o prazo de 1 a 600 minutos.")).toBeVisible();

    await panel.getByLabel("Prazo de entrega (minutos)").fill("45");
    await panel.getByLabel("Preço do frete").fill("1250");
    await panel.getByLabel("Cidades atendidas").fill("Curitiba\nSão José dos Pinhais");
    await panel.getByLabel("Atende a partir de").fill("08:00");
    await panel.getByLabel("Atende até").fill("18:00");
    await panel.getByRole("switch", { name: /Oferecer a entrega por motoboy/ }).click();
    await panel.getByRole("button", { name: "Salvar cotação" }).click();
    await expect(page.getByText("Cotação salva.")).toBeVisible();
    expect(api.services.nvSettings).toMatchObject({ price: "12.50", eta_minutes: 45, active: true, cities: ["Curitiba", "São José dos Pinhais"], open_from: "08:00", open_until: "18:00" });
    await expect(panel.getByText(/guarda a cotação por até 15 minutos/)).toBeVisible();

    await panel.getByRole("button", { name: "Gerar novo endereço de cotação" }).click();
    await page.getByRole("dialog", { name: "Gerar novo endereço de cotação?" }).getByRole("button", { name: "Gerar novo endereço" }).click();
    await expect(page.getByText("Novo endereço de cotação gerado.")).toBeVisible();
    expect(api.services.nvRouteRotations).toBe(1);

    await panel.getByRole("button", { name: "Desconectar" }).click();
    await page.getByRole("dialog", { name: "Desconectar a Nuvemshop?" }).getByRole("button", { name: "Desconectar" }).click();
    await expect(page.getByText("Integração desconectada.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Conectar à Nuvemshop" })).toBeVisible();
  });

  test("cadastro da entrega falhou: incomplete, com Refazer cadastro", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.services.nvSetupFails = true;
    await login(page);
    await page.goto("/integracoes/");
    await page.getByRole("button", { name: "Nuvemshop, Conectar" }).click();
    await page.getByRole("button", { name: "Conectar à Nuvemshop" }).click();

    // A volta lê a resposta: nada de "conectado".
    await expect(page.getByText(/o cadastro da entrega na Nuvemshop não terminou/)).toBeVisible();
    await expect(page.getByText("Nuvemshop conectado.")).toHaveCount(0);
    await page.getByRole("link", { name: "Voltar para Integrações" }).click();

    await page.getByRole("button", { name: "Nuvemshop, Configuração incompleta" }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe da integração" });
    await expect(panel.getByText(/o checkout ainda não oferece o motoboy/)).toBeVisible();
    await panel.getByRole("button", { name: "Refazer cadastro" }).click();
    await expect(panel.getByText("O cadastro ainda não terminou na Nuvemshop. Tente de novo em instantes.")).toBeVisible();

    api.services.nvSetupFails = false;
    await panel.getByRole("button", { name: "Refazer cadastro" }).click();
    await expect(page.getByText("Cadastro refeito.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nuvemshop, Conectado" })).toBeVisible();
    expect(api.services.nvSetupCalls).toBe(2);
  });

  test("ambiente sem a configuração da Nuvemshop: Indisponível neste ambiente", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.services.nvConfigured = false;
    await login(page);
    await page.goto("/integracoes/");
    await page.getByRole("button", { name: "Nuvemshop, Indisponível neste ambiente" }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe da integração" });
    await expect(panel.getByText(/ainda não foi configurada neste ambiente/)).toBeVisible();
    await expect(panel.getByRole("button", { name: /Conectar/ })).toHaveCount(0);
  });

  test("instalou pela loja de apps da Nuvemshop, sem sessão: explica o caminho e o login volta a Integrações", async ({ page, guard }) => {
    guard.expectResponse(REFRESH, 401); // a página tenta restaurar a sessão e não há cookie
    await page.goto("/integracoes/nuvemshop/retorno/?code=codigo-da-nuvemshop");
    await expect(page.getByText("Para concluir, entre no painel Motoka e conecte em Integrações.")).toBeVisible();
    expect(page.url()).not.toContain("code=");
    await page.getByRole("link", { name: "Entrar no painel" }).click();
    await expect(page).toHaveURL(/\/entrar\/\?de=/);
    await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
    await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
    await page.getByLabel("Senha", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/integracoes\/$/);
    await expect(page.getByRole("heading", { name: "Integrações", level: 1 })).toBeVisible();
  });

  test("logado e sem o state do painel: mesma explicação, sem chamar a API", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    await login(page);
    await page.goto("/integracoes/nuvemshop/retorno/?code=codigo-da-nuvemshop&state=qualquer");
    await expect(page.getByText("Para concluir, entre no painel Motoka e conecte em Integrações.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para Integrações" })).toBeVisible();
    expect(api.services.calls.some((c) => c.includes("authorize/complete"))).toBe(false);
  });

  test("a URL de retorno sem a barra final redireciona preservando a query (wrangler dev)", async ({ request }) => {
    for (const partner of ["nuvemshop", "cardapio-web"]) {
      const response = await request.get(`/integracoes/${partner}/retorno?code=abc&state=xyz`, { maxRedirects: 0 });
      expect([301, 307, 308]).toContain(response.status());
      const location = response.headers()["location"] ?? "";
      expect(location).toContain(`/integracoes/${partner}/retorno/`);
      expect(location).toContain("code=abc");
      expect(location).toContain("state=xyz");
    }
  });
});
