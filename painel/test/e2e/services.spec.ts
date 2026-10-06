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

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

test.describe("Contratar motoboys (API mockada)", () => {
  test("solicitar serviço, pagar a taxa por PIX e só ficar pago pelo status da API", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    await login(page);
    await page.getByRole("link", { name: "Contratar motoboys" }).first().click();
    await expect(page).toHaveURL(/\/servicos\/$/);
    await expect(page.getByText("Nenhum serviço ainda")).toBeVisible();
    await page.getByRole("link", { name: "Solicitar serviço" }).first().click();
    await expect(page).toHaveURL(/\/servicos\/novo\/$/);

    await page.getByLabel("Data de início").fill(day(2));
    await page.getByLabel("Horário de início").fill("10:00");
    await page.getByLabel("Data de fim").fill(day(2));
    await page.getByLabel("Horário de fim").fill("14:00");
    await page.getByLabel("Quantidade de motoboys").fill("8");
    await page.getByLabel("Tipo de serviço").selectOption("fixed_value");
    await page.getByLabel("Valor por motoboy").fill("5000");
    // A taxa vem da prévia da API (o painel não calcula). Sem teto artificial de motoboys: como o app e a API.
    await expect(page.getByText("R$ 400,00")).toBeVisible();
    await page.getByRole("button", { name: "Solicitar", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Confirmar solicitação" });
    await expect(confirm).toContainText("antecedência de 3hrs");
    await confirm.getByRole("button", { name: "Confirmar solicitação" }).click();

    // Pagamento: PIX. Nenhum campo de cartão no DOM, e o cartão novo é só no app.
    await expect(page.getByText("Pagar a taxa de serviço")).toBeVisible();
    await expect(page.locator('input[autocomplete="cc-number"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Pagar R$ 5,00" }).click();
    const qr = page.getByAltText("QR Code do PIX");
    await expect(qr).toBeVisible();
    expect(await qr.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    await expect(page.getByLabel("PIX copia e cola")).toHaveValue(/mock-pix-code/);
    await expect(page.getByText(/Este código expira em \d\d:\d\d/)).toBeVisible();

    // O clique não confirma: só o status `paid` da API.
    await page.getByRole("button", { name: "Já fiz o pagamento" }).click();
    await expect(page.getByText("Serviço solicitado com sucesso!")).toHaveCount(0);
    const order = api.services.orders[0];
    const payment = order ? api.services.payments.get(order.id) : undefined;
    expect(payment).toBeDefined();
    if (payment && order) {
      payment.status = "paid";
      payment.paid_at = new Date().toISOString();
      order.status = "waiting_for_drivers";
    }
    await expect(page.getByText("Serviço solicitado com sucesso!")).toBeVisible({ timeout: 10_000 });
    expect(api.services.bodies.find((b) => b.route === "POST /orders")?.body).toMatchObject({ requested_drivers: 8, type: "fixed_value", value: "50.00" });
  });

  test("proposta do motoboy: contraproposta, aceitar e cancelar o serviço", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    const order = api.services.seedOrder();
    api.services.seedProposal(order.id, "60.00");
    await login(page);
    await page.goto(`/servicos/?pedido=${order.id}`);
    const panel = page.getByRole("complementary", { name: "Detalhe do serviço" });
    await panel.getByRole("tab", { name: "Propostas" }).click();
    await expect(panel.getByText("+20% do anunciado")).toBeVisible();

    await panel.getByRole("button", { name: "Fazer contraproposta" }).click();
    const dialog = page.getByRole("dialog", { name: "Fazer contraproposta" });
    await dialog.getByRole("textbox", { name: "Valor fixo" }).fill("5500");
    await dialog.getByRole("button", { name: "Enviar proposta" }).click();
    await expect(page.getByText("Contraproposta enviada.")).toBeVisible();
    await expect(panel.getByText("Aguardando resposta do motoboy")).toBeVisible();

    // Outra proposta do motoboy: a loja aceita e a vaga é preenchida.
    api.services.negotiations.length = 0;
    api.services.seedProposal(order.id, "52.00");
    await page.reload();
    await panel.getByRole("tab", { name: "Propostas" }).click();
    await panel.getByRole("button", { name: "Aceitar" }).click();
    await expect(page.getByText("Proposta aceita.")).toBeVisible();
    await expect(panel.getByText("1/2 motoboys")).toBeVisible();

    await panel.getByRole("button", { name: "Cancelar serviço" }).click();
    await page.getByRole("dialog", { name: "Cancelar serviço" }).getByRole("button", { name: "Cancelar serviço" }).click();
    await expect(page.getByText("Serviço cancelado.")).toBeVisible();
    expect(order.status).toBe("cancelled");
  });
});

test.describe("Pagamento e cancelamento (API mockada)", () => {
  test("PIX expirado: mensagem fixa e novo pagamento", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    const order = api.services.seedOrder({ status: "pending_payment" });
    await login(page);
    await page.goto(`/servicos/?pedido=${order.id}`);
    const panel = page.getByRole("complementary", { name: "Detalhe do serviço" });
    await panel.getByRole("button", { name: "Pagar R$ 5,00" }).click();
    await expect(panel.getByAltText("QR Code do PIX")).toBeVisible();
    const payment = api.services.payments.get(order.id);
    if (payment) payment.status = "expired";
    await expect(panel.getByText("Código expirado")).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByText("O prazo deste pagamento expirou. Gere uma nova cobrança para confirmar o pedido.")).toBeVisible();
    await panel.getByRole("button", { name: "Pagar novamente" }).click();
    await panel.getByRole("button", { name: "Pagar R$ 5,00" }).click();
    await expect(panel.getByAltText("QR Code do PIX")).toBeVisible();
    expect(api.services.calls.filter((c) => c === `POST /orders/${order.id}/payments`)).toHaveLength(2);
  });

  test("cancelar serviço já pago avisa que o estorno não é automático", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    const order = api.services.seedOrder({ status: "waiting_for_drivers" });
    await login(page);
    await page.goto(`/servicos/?pedido=${order.id}`);
    const panel = page.getByRole("complementary", { name: "Detalhe do serviço" });
    await panel.getByRole("button", { name: "Cancelar serviço" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancelar serviço" });
    await expect(dialog).toContainText("não é devolvida automaticamente");
    await expect(dialog).toContainText("fale com o suporte");
  });

  test("recusar contraproposta atualiza a lista de propostas", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    const order = api.services.seedOrder();
    api.services.seedProposal(order.id, "60.00");
    await login(page);
    await page.goto(`/servicos/?pedido=${order.id}`);
    const panel = page.getByRole("complementary", { name: "Detalhe do serviço" });
    await panel.getByRole("tab", { name: "Propostas" }).click();
    await panel.getByRole("button", { name: "Recusar" }).click();
    await page.getByRole("dialog", { name: "Recusar proposta" }).getByRole("button", { name: "Recusar" }).click();
    await expect(page.getByText("Proposta recusada.")).toBeVisible();
    await expect(panel.getByText("Quando motoboys enviarem contrapropostas, elas aparecem aqui.")).toBeVisible();
  });
});

test.describe("Avisos e Conta (API mockada)", () => {
  test("avisos: marcar como lido leva ao serviço; marcar todos", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    const order = api.services.seedOrder();
    api.services.seedNotice({ data: { order_id: order.id } });
    api.services.seedNotice({ title: "Outro aviso", type: "algo_novo" });
    await login(page);
    await page.getByRole("link", { name: "Avisos" }).first().click();
    await expect(page.getByText("Você tem 2 avisos não lidos")).toBeVisible();
    await page.getByRole("button", { name: "Não lidos" }).click();
    await expect(page.getByRole("list", { name: "Avisos" }).getByRole("listitem")).toHaveCount(2);
    await page.getByRole("button", { name: "Marcar todos como lidos" }).click();
    await expect(page.getByText("Nenhum aviso não lido").first()).toBeVisible();
    await page.getByRole("button", { name: "Todos", exact: true }).click();
    await page.getByRole("button", { name: /Nova proposta/ }).click();
    await expect(page).toHaveURL(new RegExp(`/servicos/\\?pedido=${order.id}`));
  });

  test("conta: telefone, endereço pelo CEP e cartões salvos", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    await login(page);
    await page.getByRole("link", { name: "Conta" }).first().click();
    await expect(page.getByRole("heading", { name: "Conta", level: 1 })).toBeVisible();

    const phone = page.getByLabel("Telefone");
    await phone.fill("41988887777");
    await page.getByRole("button", { name: "Salvar telefone" }).click();
    await expect(page.getByText("Telefone alterado com sucesso!")).toBeVisible();
    expect(api.services.phone).toBe("41988887777");

    await expect(page.getByLabel("Endereço", { exact: true })).toHaveValue("Rua A");
    await page.getByLabel("Número", { exact: true }).fill("350");
    await page.getByRole("button", { name: "Salvar endereço" }).click();
    await expect(page.getByText("Endereço alterado com sucesso!")).toBeVisible();
    expect(api.services.address.number).toBe(350);

    // Cartões: só listar e excluir; cadastrar é do app.
    await expect(page.getByText("Crédito · •••• 4242")).toBeVisible();
    await expect(page.getByText("Para cadastrar um cartão novo, use o app Motoka. Os cartões salvos lá aparecem aqui.")).toBeVisible();
    await expect(page.locator('input[autocomplete="cc-number"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await page.getByRole("dialog", { name: "Excluir cartão" }).getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText("Nenhum cartão cadastrado.")).toBeVisible();
  });

  test("conta: troca de e-mail com código e troca de senha", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse(`${API}/v1/users/confirm-email-code`, 400);
    guard.expectResponse(/\/v1\/users\/[^/]+\/password$/, 400);
    await login(page);
    await page.getByRole("link", { name: "Conta" }).first().click();

    await page.getByLabel("Novo e-mail").fill("nova@loja.com");
    await page.getByRole("button", { name: "Enviar código" }).click();
    await page.getByLabel("Código de confirmação").fill("000000");
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByText("Código inválido. Confira e tente novamente.")).toBeVisible();
    expect(api.services.email).toBe("loja@motoka.com");
    await expect(page.getByRole("button", { name: /Reenviar código em \d+s/ })).toBeDisabled();
    await page.getByLabel("Código de confirmação").fill("123456");
    await page.getByRole("button", { name: "Confirmar", exact: true }).click();
    await expect(page.getByText("Email alterado com sucesso!")).toBeVisible();
    await expect(page.getByText("E-mail atual: nova@loja.com")).toBeVisible();
    expect(api.services.email).toBe("nova@loja.com");

    await page.getByLabel("Senha atual").fill("errada");
    await page.getByLabel("Nova senha", { exact: true }).fill("OutraSenha@2");
    await page.getByLabel("Confirme a nova senha").fill("OutraSenha@2");
    await page.getByRole("button", { name: "Alterar senha" }).click();
    await expect(page.getByText("A senha atual está incorreta.")).toBeVisible();
    await page.getByLabel("Senha atual").fill("NovaSenha@1");
    await page.getByRole("button", { name: "Alterar senha" }).click();
    await expect(page).toHaveURL(/\/entrar\/$/);
    expect(api.services.password).toBe("OutraSenha@2");
  });

  test("conta: excluir exige digitar EXCLUIR, apaga a conta e encerra a sessão", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    await login(page);
    await page.getByRole("link", { name: "Conta" }).first().click();
    await page.getByRole("button", { name: "Excluir conta" }).click();
    const dialog = page.getByRole("dialog", { name: "Excluir conta" });
    const confirm = dialog.getByRole("button", { name: "Excluir permanentemente" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Para confirmar, digite EXCLUIR").fill("excluir");
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Para confirmar, digite EXCLUIR").fill("EXCLUIR");
    await confirm.click();
    await expect(page).toHaveURL(/\/entrar\/$/);
    expect(api.services.deleted).toBe(true);
    expect(api.logoutCalls).toBe(1);
    // A sessão acabou: voltar ao painel pede o login de novo.
    await page.goto("/conta/");
    await expect(page).toHaveURL(/\/entrar\//);
  });
});
