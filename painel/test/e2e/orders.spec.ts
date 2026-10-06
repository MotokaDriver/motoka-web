import { expect, test } from "./guard";
import { API } from "./mockApi";
import { assignFlow, createOrderFlow, openOrders, readyAndCancelFlow, stubViaCep } from "./ordersFlow";

const REFRESH = `${API}/v1/web/auth/refresh`;

async function login(page: import("@playwright/test").Page) {
  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
  await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);
}

test.describe("Pedidos (API mockada)", () => {
  test("criar, atribuir, marcar pronto e cancelar", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.team.onShiftNow = true;
    await stubViaCep(page);
    await login(page);
    await openOrders(page);
    await expect(page.getByText("Nenhum pedido hoje")).toBeVisible();

    const number = await createOrderFlow(page, "Cliente E2E", { auto: false });
    const body = api.deliveries.createBodies[0] as { address: { state: string; city: string; street: string }; client_request_id: string; customer: { phone: string }; driver: { mode: string } };
    expect(body.address).toMatchObject({ city: "Curitiba", state: "PR", street: "Rua Chile" });
    expect(body.customer.phone).toBe("41999990077");
    expect(body.driver.mode).toBe("none");
    await assignFlow(page);
    await readyAndCancelFlow(page, number);

    // O pedido cancelado sai de "Em aberto" e continua em "Todos".
    await expect(page.getByRole("button", { name: "Em aberto 0" })).toBeVisible();
    await page.getByRole("button", { name: "Todos 1" }).click();
    await expect(page).toHaveURL(/filtro=todos/);
    await expect(page.getByRole("list", { name: "Pedidos" }).getByText("Cliente E2E")).toBeVisible();
    expect(api.deliveries.calls).toEqual(expect.arrayContaining(["POST ", expect.stringMatching(/\/assign$/), expect.stringMatching(/\/ready$/), expect.stringMatching(/\/cancel$/)]));
  });

  test("iFood não oferece WhatsApp; pedido de integração não cancela no Motoka; ?pedido= inválido não chama a API", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    const ifood = api.deliveries.seed({ number: 7, status: "preparing", origin: "ifood", name: "Ana iFood", phone: null, needsAttention: true });
    await login(page);
    await openOrders(page);
    await expect(page.getByRole("button", { name: /Pedidos, 1 precisa de atenção/ }).or(page.getByRole("link", { name: /Pedidos, 1 precisa de atenção/ }))).toBeVisible();
    await page.getByRole("button", { name: /Pedido 7/ }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe do pedido" });
    await expect(panel.getByText("O cliente acompanha pelo app do iFood.", { exact: false })).toBeVisible();
    await expect(panel.getByText("Enviar pelo WhatsApp")).toHaveCount(0);
    await expect(panel.getByText("Cancele no iFood; o Motoka atualiza sozinho.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0);
    expect(ifood.id).toBeTruthy();

    const before = api.deliveries.calls.length;
    await page.goto("/pedidos/?pedido=nao-e-uuid");
    await expect(page.getByText("Pedido não encontrado.")).toBeVisible();
    expect(api.deliveries.calls.slice(before).filter((c) => /nao-e-uuid/.test(c))).toEqual([]);
  });

  test("link de rastreio e WhatsApp antes da retirada; repetir a criação não duplica", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.deliveries.seed({ number: 9, status: "preparing", name: "Bia Manual" });
    await login(page);
    await openOrders(page);
    await page.getByRole("button", { name: /Pedido 9/ }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe do pedido" });
    await expect(panel.getByTestId("tracking-url")).toHaveText("localhost:8787/r/#tok-9");
    await expect(panel.getByText(/Seu pedido #9 da .* está sendo preparado\. Acompanhe aqui:/)).toBeVisible();
    await expect(panel.getByRole("link", { name: /Enviar pelo WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/5541999990077\?text=/);
    await panel.getByRole("link", { name: /Enviar pelo WhatsApp/ }).evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
    await panel.getByRole("link", { name: /Enviar pelo WhatsApp/ }).click();
    await expect(panel.getByRole("link", { name: "Enviado" })).toBeVisible();
    await expect.poll(() => api.deliveries.calls.some((c) => /tracking-link\/sent$/.test(c))).toBe(true);

    // Mesmo client_request_id: 200 com o pedido existente, sem duplicar.
    const count = api.deliveries.items.length;
    const body = { client_request_id: "dup-1", channel: "phone", customer: { name: "Dup", phone: "41999990000" }, address: { street: "R", number: "1", neighborhood: "B", city: "Curitiba", state: "PR" }, payment: { type: "online" }, driver: { mode: "none" } };
    expect(api.deliveries.route("", "POST", new URLSearchParams(), body)?.[0]).toBe(201);
    expect(api.deliveries.route("", "POST", new URLSearchParams(), body)?.[0]).toBe(200);
    expect(api.deliveries.items.length).toBe(count + 1);
  });
});
