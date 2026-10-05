import { expect, test } from "../e2e/guard";
import { assignFlow, createOrderFlow, openOrders, readyAndCancelFlow, stubViaCep } from "../e2e/ordersFlow";
import { API, STORE, ensureDriverInTeam, ensureDriverOnShift } from "./seed";

/**
 * "Pedidos" contra a API REAL do dev-env (API em :8000, painel na 3001), com o motoboy do seed em turno
 * e com a sessão aberta: criar pedido manual, atribuir, marcar pronto e cancelar. O build precisa de
 * `NEXT_PUBLIC_API_URL=http://localhost:8000` e `NEXT_PUBLIC_APP_ENV=e2e`.
 */
test("pedido manual de ponta a ponta com motoboy em turno", async ({ page, request, guard }) => {
  guard.expectResponse(`${API}/v1/web/auth/refresh`, 401); // primeira visita, sem cookie

  expect(await ensureDriverInTeam(request, null), "o motoboy do seed na equipe").toBe(true);
  const onShift = await ensureDriverOnShift(request);
  test.skip(!onShift, "não deu para pôr o motoboy do seed em turno agora: a API não deixa reabrir a sessão de um turno já usado nem apagar turno em andamento, então um turno de uma rodada anterior bloqueia a janela até acabar (limpe `teamshifts` e `teamshiftsessions` do motoboy no motoka_pg ou espere)");

  await stubViaCep(page);
  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill(STORE.doc);
  await page.getByLabel("Senha", { exact: true }).fill(STORE.password);
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);

  await openOrders(page);
  const customer = `Cliente E2E ${Date.now() % 100000}`;
  const number = await createOrderFlow(page, customer, { auto: false });
  await assignFlow(page);
  await readyAndCancelFlow(page, number);
  await page.getByRole("button", { name: /^Todos \d+$/ }).click();
  await expect(page.getByRole("list", { name: "Pedidos" }).getByText(customer)).toBeVisible();
});
