import type { Page } from "@playwright/test";
import { expect } from "./guard";

/**
 * Passos do WN-1 compartilhados entre o E2E com API mockada e o E2E contra o dev-env real. Só usa o
 * que o usuário vê: papéis, nomes acessíveis e textos.
 */

export async function openTeam(page: Page): Promise<void> {
  await page.getByRole("link", { name: "Minha equipe" }).first().click();
  await expect(page).toHaveURL(/\/equipe\/$/);
  await expect(page.getByRole("heading", { name: "Minha equipe", level: 1 })).toBeVisible();
  await expect(page.getByRole("status", { name: "Carregando a escala" })).toHaveCount(0);
}

/** Convidar: link, copiar, QR, convite pelo nome e cancelar. Devolve o link da loja. */
export async function inviteFlow(page: Page, uniqueName: string): Promise<string> {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Convidar motoboy" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Convidar motoboy" });
  const link = dialog.getByTestId("invite-link");
  await expect(link).toBeVisible();
  const url = (await link.getAttribute("title")) ?? "";
  expect(url).toMatch(/\/convite\/[\w-]+$/);

  await dialog.getByRole("button", { name: "Copiar" }).click();
  await expect(dialog.getByRole("button", { name: "Copiado" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await expect(dialog.getByRole("link", { name: /Enviar pelo WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=/);
  await expect(dialog.getByRole("img", { name: "QR code do link de convite" }).locator("path")).toBeVisible();

  await dialog.getByLabel("Nome").fill(uniqueName);
  await dialog.getByLabel("Celular").fill(`4199${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`);
  await dialog.getByRole("button", { name: "Convidar", exact: true }).click();
  await expect(dialog.getByText(`Convite criado para ${uniqueName}`)).toBeVisible();
  await expect(dialog.getByRole("link", { name: "WhatsApp", exact: true })).toHaveAttribute("href", /^https:\/\/wa\.me\/55\d+\?text=/);
  await expect(dialog.getByRole("button", { name: `Cancelar convite de ${uniqueName}` })).toBeVisible();

  await dialog.getByRole("button", { name: `Cancelar convite de ${uniqueName}` }).click();
  await page.getByRole("dialog", { name: "Cancelar o convite?" }).getByRole("button", { name: "Cancelar convite" }).click();
  await expect(dialog.getByRole("button", { name: `Cancelar convite de ${uniqueName}` })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  return url;
}

const SHIFT_PILL = /turno das 23h às 23h30\. Abrir opções do turno\.$/;

/** Adicionar turno de domingo 23:00–23:30 (repete) e vê a pílula na grade. */
export async function addShiftFlow(page: Page, memberName?: string): Promise<void> {
  await page.getByRole("button", { name: "Adicionar turno" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Adicionar turno" });
  const select = drawer.getByLabel("Motoboy");
  if (memberName) {
    const value = await select.locator("option", { hasText: memberName }).first().getAttribute("value");
    await select.selectOption(value ?? { index: 1 });
  } else if ((await select.inputValue()) === "") await select.selectOption({ index: 1 });
  await drawer.getByRole("button", { name: "Dom", exact: true }).click();
  await drawer.getByLabel("Início do turno").fill("2300");
  await drawer.getByLabel("Fim do turno").fill("2330");
  await expect(drawer.getByLabel("Início do turno")).toHaveValue("23:00");
  // Motoboy sem combinado (a API devolve tarifas nulas): o formulário abre em "Outro valor".
  if ((await drawer.getByLabel("Remuneração", { exact: true }).inputValue()) === "custom") {
    await drawer.getByLabel("Diária", { exact: true }).fill("9000");
    await drawer.getByLabel("Por entrega", { exact: true }).fill("600");
  }
  await drawer.getByRole("button", { name: "Salvar 1 turno" }).click();
  await expect(page.getByText(/1 turno salvo para/)).toBeVisible();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole("button", { name: SHIFT_PILL })).toBeVisible();
}

const memberMenu = (page: Page, name?: string) => (name ? page.getByRole("button", { name: new RegExp(`^Opções de ${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }) : page.getByRole("button", { name: /^Opções de / }).first());

/** Pausar (turno suspenso), retomar, remover o turno e remover o membro. */
export async function pauseResumeRemoveFlow(page: Page, memberName?: string): Promise<void> {
  await memberMenu(page, memberName).click();
  await page.getByRole("menuitem", { name: "Pausar" }).click();
  await page.getByRole("dialog", { name: /^Pausar / }).getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.getByText(/foi pausado\.$/)).toBeVisible();
  await expect(page.getByText("Pausado", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /turno suspenso enquanto .* está pausado, turno das 23h às 23h30/ })).toBeVisible();

  await memberMenu(page, memberName).click();
  await page.getByRole("menuitem", { name: "Retomar" }).click();
  await expect(page.getByText(/voltou para a escala\./)).toBeVisible();
  await expect(page.getByText("Pausado", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: SHIFT_PILL })).toBeVisible();

  await page.getByRole("button", { name: SHIFT_PILL }).click();
  const menu = page.getByRole("dialog", { name: /^Domingo, 23:00–23:30$/ });
  await expect(menu).toContainText("Repete toda semana");
  await menu.getByRole("button", { name: "Remover turno" }).click();
  await page.getByRole("dialog", { name: "Remover este turno?" }).getByRole("button", { name: "Remover", exact: true }).click();
  await expect(page.getByText("Turno removido.")).toBeVisible();
  await expect(page.getByRole("button", { name: SHIFT_PILL })).toHaveCount(0);

  await memberMenu(page, memberName).click();
  await page.getByRole("menuitem", { name: "Remover da equipe" }).click();
  await page.getByRole("dialog", { name: /^Remover .* da equipe\?$/ }).getByRole("button", { name: "Remover", exact: true }).click();
  await expect(page.getByText(/foi removido da equipe\./)).toBeVisible();
}
