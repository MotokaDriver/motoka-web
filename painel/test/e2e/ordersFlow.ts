import type { Page } from "@playwright/test";
import { expect } from "./guard";

/** Passos do WN-2 compartilhados entre o E2E com API mockada e o E2E contra o dev-env real. */

/** O ViaCEP é de terceiros: o E2E nunca depende da internet. */
export async function stubViaCep(page: Page): Promise<void> {
  await page.route("https://viacep.com.br/**", (route) =>
    route.fulfill({
      json: [{ cep: "80220-020", logradouro: "Rua Chile", bairro: "Rebouças", localidade: "Curitiba", uf: "PR" }],
      headers: { "access-control-allow-origin": "*" },
    }),
  );
}

export async function openOrders(page: Page): Promise<void> {
  await page.getByRole("link", { name: /^Pedidos/ }).first().click();
  await expect(page).toHaveURL(/\/pedidos\/$/);
  await expect(page.getByRole("heading", { name: "Pedidos de hoje", level: 1 })).toBeVisible();
  await expect(page.getByRole("status", { name: "Carregando os pedidos" })).toHaveCount(0);
}

/** Cria um pedido manual (WhatsApp, cobrar R$ 58,00) e devolve o número que a API deu. */
export async function createOrderFlow(page: Page, customer: string, opts: { auto: boolean }): Promise<number> {
  await page.getByRole("button", { name: "Novo pedido" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Novo pedido" });
  await drawer.getByLabel("Celular").fill("41999990077");
  await drawer.getByLabel("Cliente", { exact: true }).fill(customer);
  await drawer.getByLabel("Rua", { exact: true }).fill("Rua Chile");
  await expect(drawer.getByRole("option", { name: /Rua Chile · Rebouças · 80220-020/ })).toBeVisible({ timeout: 15_000 });
  await drawer.getByRole("option", { name: /Rua Chile/ }).getByRole("button").click();
  await expect(drawer.getByLabel("Bairro")).toHaveValue("Rebouças");
  await drawer.getByLabel("Número", { exact: true }).fill("1880");
  await drawer.getByRole("button", { name: "Cobrar na entrega" }).click();
  await drawer.getByLabel("Valor a cobrar").fill("5800");
  await expect(drawer.getByLabel("Valor a cobrar")).toHaveValue("R$ 58,00");
  if (!opts.auto) await drawer.getByRole("switch", { name: /Atribuir automaticamente/ }).click();
  await drawer.getByRole("button", { name: "Criar pedido" }).click();
  const toast = page.getByText(/^Pedido #\d+ criado\.$/);
  await expect(toast).toBeVisible();
  const number = Number(/#(\d+)/.exec((await toast.textContent()) ?? "")?.[1]);
  expect(number).toBeGreaterThan(0);
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/\/pedidos\/\?pedido=[0-9a-f-]{36}$/);
  const panel = page.getByRole("complementary", { name: "Detalhe do pedido" });
  await expect(panel.getByRole("heading", { name: customer })).toBeVisible();
  await expect(panel.getByText(`Pedido #${number}`, { exact: true })).toBeVisible();
  return number;
}

/** Atribui o primeiro motoboy em turno ao pedido selecionado (sem motoboy). */
export async function assignFlow(page: Page): Promise<void> {
  const panel = page.getByRole("complementary", { name: "Detalhe do pedido" });
  const select = panel.getByLabel("Motoboy em turno");
  await expect(select.locator("option")).not.toHaveCount(1);
  await select.selectOption({ index: 1 });
  await panel.getByRole("button", { name: "Atribuir" }).click();
  await expect(page.getByText("Motoboy atribuído.")).toBeVisible();
  await expect(panel.getByText("trocar")).toBeVisible();
}

/** Marca pronto e cancela com motivo. */
export async function readyAndCancelFlow(page: Page, number: number): Promise<void> {
  const panel = page.getByRole("complementary", { name: "Detalhe do pedido" });
  await panel.getByRole("button", { name: "Pronto para retirar" }).click();
  await expect(panel.getByText("Pronto p/ retirar")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Pronto para retirar" })).toHaveCount(0);

  await panel.getByRole("button", { name: "Cancelar pedido" }).click();
  const dialog = page.getByRole("dialog", { name: `Cancelar o pedido #${number}?` });
  await expect(dialog.getByRole("button", { name: "Cancelar pedido" })).toBeDisabled();
  await dialog.getByRole("radio", { name: "Cliente desistiu" }).click();
  await dialog.getByRole("button", { name: "Cancelar pedido" }).click();
  await expect(page.getByText(`Pedido #${number} cancelado.`)).toBeVisible();
  await expect(panel.getByText("Cancelado", { exact: true }).first()).toBeVisible();
  await expect(panel.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0);
}
