import { expect, test } from "./guard";
import { API } from "./mockApi";
import { confirmAndPayFlow, openSettlements } from "./settlementsFlow";

const REFRESH = `${API}/v1/web/auth/refresh`;

async function login(page: import("@playwright/test").Page) {
  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
  await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);
}

test.describe("Acertos (API mockada)", () => {
  test("confirmar, copiar a chave Pix e marcar como pago", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.settlements.seed();
    await login(page);
    await openSettlements(page);
    await expect(page.getByRole("link", { name: /Acertos, 1 espera você/ })).toBeVisible();

    await page.getByRole("button", { name: /29\/09/ }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe do acerto" });
    await expect(panel.getByTestId("settlement-total")).toHaveText("R$ 120,00");
    // A chave Pix só aparece depois de confirmado.
    await expect(panel.getByTestId("pix-key")).toHaveCount(0);
    const total = await confirmAndPayFlow(page, { expectKey: "diego@exemplo.com" });
    expect(total).toBe("R$ 120,00");

    expect(api.settlements.bodies.find((b) => b.route === "POST confirm")?.body).toEqual({ version: 3, expected_total: "120.00" });
    // A chave nunca foi para o storage do navegador.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(stored).not.toContain("diego@exemplo.com");
  });

  test("ajustar com chuva volta ao motoboy; retirar e desfazer; sem a chave só a máscara", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.settlements.keyVisible = false;
    const withReturn = api.settlements.seed({ lines: [{ number: 1 }, { number: 2 }, { number: 3, kind: "pending", reason: "return_receipt" }] });
    const plain = api.settlements.seed({ date: "2026-09-30" });
    await login(page);
    await openSettlements(page);

    // Ajustar com a chuva: o servidor refaz a conta, e o total mudou: volta ao motoboy.
    await page.getByRole("button", { name: /30\/09/ }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe do acerto" });
    await panel.getByRole("button", { name: "Ajustar acerto" }).click();
    const dialog = page.getByRole("dialog", { name: "Ajustar acerto" });
    await dialog.getByRole("switch", { name: /Adicional de chuva/ }).click();
    await dialog.getByLabel("Ajuste (use - para descontar)").fill("-500");
    await expect(dialog.getByLabel("Ajuste (use - para descontar)")).toHaveValue("-R$ 5,00");
    await expect(dialog.getByRole("button", { name: "Salvar ajuste" })).toBeDisabled(); // falta o motivo
    await dialog.getByLabel("Motivo do ajuste").fill("Troco do balcão");
    await dialog.getByRole("button", { name: "Salvar ajuste" }).click();
    await expect(page.getByText("Ajuste salvo.")).toBeVisible();
    await expect(panel.getByText("Aguardando o motoboy", { exact: true })).toBeVisible();
    await expect(panel.getByTestId("settlement-total")).toHaveText("R$ 127,00");
    await expect(panel.getByRole("button", { name: "Confirmar acerto" })).toBeDisabled();
    expect(plain.status).toBe("pending_driver");
    expect(api.settlements.bodies.find((b) => b.route === "PATCH ")?.body).toMatchObject({ version: 3, rain_applied: true, adjustment_amount: "-5.00", adjustment_note: "Troco do balcão" });

    // Linha sem desfecho: retirar do acerto e desfazer.
    await page.getByRole("button", { name: /29\/09/ }).click();
    await expect(panel.getByText(/Ainda não conta: falta confirmar que o pedido voltou/)).toBeVisible();
    await expect(panel.getByRole("button", { name: "Confirmar acerto" })).toBeDisabled();
    await panel.getByRole("button", { name: "Retirar do acerto" }).click();
    await expect(page.getByText("#3 saiu do acerto.")).toBeVisible();
    await expect(panel.getByText("#3 · fora deste acerto")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Confirmar acerto" })).toBeEnabled();
    await panel.getByRole("button", { name: "Desfazer" }).click();
    await expect(page.getByText("#3 voltou para o acerto.")).toBeVisible();
    await expect(panel.getByText("#3 · fora deste acerto")).toHaveCount(0);
    expect(withReturn.excluded).toEqual([]);
  });

  test("sem a chave visível: só a máscara; contestado mostra o motivo", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.settlements.keyVisible = false;
    const s = api.settlements.seed({ status: "confirmed" });
    api.settlements.seed({ status: "disputed", date: "2026-09-28" });
    s.history.push({ action: "store_confirmed", actor_role: "establishment", at: new Date().toISOString(), total_seen: "120.00", note: null });
    const d = api.settlements.items[1];
    d?.history.push({ action: "disputed", actor_role: "driver", at: new Date().toISOString(), total_seen: "120.00", note: "Faltou uma entrega" });
    await login(page);
    await openSettlements(page);
    await page.getByRole("button", { name: /29\/09/ }).click();
    const panel = page.getByRole("complementary", { name: "Detalhe do acerto" });
    await expect(panel.getByText(/d•••@exemplo.com. Combine o pagamento com o motoboy/)).toBeVisible();
    await expect(panel.getByTestId("pix-key")).toHaveCount(0);
    await page.getByRole("button", { name: /28\/09/ }).click();
    await expect(panel.getByRole("alert")).toContainText("O motoboy contestou: Faltou uma entrega");
    await expect(panel.getByRole("button", { name: "Confirmar mesmo assim" })).toBeEnabled();
    await page.getByRole("button", { name: "Contestados" }).click();
    await expect(page).toHaveURL(/filtro=contestado/);
    await expect(page.getByRole("list", { name: "Acertos" }).getByRole("listitem")).toHaveCount(1);
  });
});
