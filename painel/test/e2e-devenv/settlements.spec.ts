import { expect, test } from "../e2e/guard";
import { confirmAndPayFlow, openSettlements } from "../e2e/settlementsFlow";
import { API, STORE, ensureDriverInTeam, ensurePendingStoreSettlement } from "./seed";

/**
 * "Acertos" contra a API REAL do dev-env, com o acerto preparado só por API (turno curto, M8 `end` e
 * confirmação do motoboy): a loja confirma e marca como pago pelo painel.
 */
test("acerto real: confirmar e marcar como pago", async ({ page, request, guard }) => {
  guard.expectResponse(`${API}/v1/web/auth/refresh`, 401);
  expect(await ensureDriverInTeam(request, null), "o motoboy do seed na equipe").toBe(true);
  const id = await ensurePendingStoreSettlement(request);
  test.skip(!id, "não deu para preparar o acerto: a janela do motoboy do seed está ocupada por um turno de outra rodada (espere uns 10 min) ou é quase meia-noite");
  if (!id) return;

  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill(STORE.doc);
  await page.getByLabel("Senha", { exact: true }).fill(STORE.password);
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);
  await openSettlements(page);
  await page.goto(`/acertos/?acerto=${id}`);
  await expect(page.getByRole("complementary", { name: "Detalhe do acerto" }).getByTestId("settlement-total")).toBeVisible();
  await confirmAndPayFlow(page, { expectKey: null }); // a chave só aparece depois de confirmar; o mockado cobre a cópia
});
