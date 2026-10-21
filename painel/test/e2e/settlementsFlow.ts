import type { Page } from "@playwright/test";
import { expect } from "./guard";

/** Passos do WN-5 compartilhados entre o E2E mockado e o real. */

export async function openSettlements(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Minha equipe" }).first().click();
  await expect(page).toHaveURL(/\/equipe\/$/);
  await page.getByRole("navigation", { name: "Minha equipe" }).getByRole("link", { name: /^Acertos/ }).click();
  await expect(page).toHaveURL(/\/acertos\/$/);
  await expect(page.getByRole("heading", { name: "Acertos", level: 1 })).toBeVisible();
  // D-18: o Motoka não movimenta dinheiro, e a tela diz isso.
  await expect(page.getByText(/não movimenta dinheiro/).first()).toBeVisible();
}

/** Confirma o acerto aberto no painel e o marca como pago, copiando a chave Pix. Devolve o total confirmado. */
export async function confirmAndPayFlow(page: Page, opts: { expectKey: string | null }): Promise<string> {
  const panel = page.getByRole("complementary", { name: "Detalhe do acerto" });
  const total = (await panel.getByTestId("settlement-total").textContent()) ?? "";
  await panel.getByRole("button", { name: "Confirmar acerto" }).click();
  const dialog = page.getByRole("dialog", { name: `Confirmar o acerto de ${total}?` });
  await expect(dialog).toContainText("não movimenta dinheiro");
  await dialog.getByRole("button", { name: "Confirmar acerto" }).click();
  await expect(page.getByText("Acerto confirmado.")).toBeVisible();
  await expect(panel.getByText("Confirmado", { exact: true })).toBeVisible();
  // Nenhum botão de "pagar": só registrar o pagamento feito fora do app.
  await expect(panel.getByRole("button", { name: /^Pagar/ })).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Ajustar acerto" })).toHaveCount(0);

  if (opts.expectKey) {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await expect(panel.getByTestId("pix-key")).toHaveText(opts.expectKey);
    await panel.getByRole("button", { name: "Copiar" }).click();
    await expect(panel.getByRole("button", { name: "Copiada" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(opts.expectKey);
  }

  await panel.getByRole("button", { name: "Marcar como pago" }).click();
  const paid = page.getByRole("dialog", { name: "Marcar como pago" });
  await expect(paid).toContainText("Pix, fora do app");
  await paid.getByLabel("Observação (opcional)").fill("Pix feito às 18h");
  await paid.getByRole("button", { name: "Marcar como pago" }).click();
  await expect(page.getByText("Acerto marcado como pago.")).toBeVisible();
  await expect(panel.getByText("Pago", { exact: true })).toBeVisible();
  await expect(panel.getByText(/Pago em .* · Pix feito às 18h/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Marcar como pago" })).toHaveCount(0);
  return total;
}
