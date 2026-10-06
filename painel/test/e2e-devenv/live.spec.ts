import { expect, test } from "../e2e/guard";
import { API, STORE, cancelDeliveryApi, createManualDelivery, ensureDriverInTeam, ensureDriverOnShift, reportPosition } from "./seed";

/**
 * "Mapa ao vivo" e "Acompanhar pedido" contra a API REAL do dev-env (API em :8000, painel na 3001): o
 * motoboy do seed em turno manda pontos (T1), o painel os vê pelo stream L2, e o link do cliente (P1/P2)
 * acompanha um pedido até o cancelamento. O build precisa de `NEXT_PUBLIC_API_URL=http://localhost:8000`,
 * `NEXT_PUBLIC_APP_ENV=e2e` e `NEXT_PUBLIC_MAP_STYLE_URL` apontando para um estilo local (ver README).
 */
test("mapa ao vivo: o motoboy em turno aparece e a posição chega pelo stream", async ({ page, request, guard }) => {
  guard.expectResponse(`${API}/v1/web/auth/refresh`, 401);
  expect(await ensureDriverInTeam(request, null), "o motoboy do seed na equipe").toBe(true);
  test.skip(!(await ensureDriverOnShift(request)), "não deu para pôr o motoboy do seed em turno agora (janela ocupada por uma rodada anterior)");
  expect(await reportPosition(request, -25.4372, -49.27)).toBe(true);

  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill(STORE.doc);
  await page.getByLabel("Senha", { exact: true }).fill(STORE.password);
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);

  const side = page.getByRole("complementary", { name: "Equipe agora" });
  const card = side.getByRole("button", { name: /^Joca Motoboy, /});
  await expect(card).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^Ao vivo$/ })).toBeVisible({ timeout: 20_000 }); // stream aberto e com bytes
  await expect(page.locator(".maplibregl-marker").filter({ hasText: "JM" })).toBeVisible();

  // Um ponto novo chega pelo stream: o "há N s" volta a ser pequeno.
  await reportPosition(request, -25.438, -49.271);
  await expect(card).toContainText(/posição há [0-9] s/, { timeout: 15_000 });
});

test("acompanhar pedido: P1 e P2 de um pedido real, 404 de token falso e encerramento no cancelamento", async ({ page, request }) => {
  const order = await createManualDelivery(request, `Cliente Link ${Date.now() % 100000}`);
  test.skip(!order.trackingUrl, "a API não devolveu o link do cliente");
  const url = new URL(order.trackingUrl as string);
  const hosts = new Set<string>();
  page.on("request", (r) => hosts.add(new URL(r.url()).host));

  // O link da API aponta para o host configurado no dev-env; o painel de teste serve o /r/ na 3001.
  await page.goto(`/r/${url.hash || ""}`);
  await expect(page.getByRole("heading", { name: "A loja está preparando o seu pedido" })).toBeVisible();
  await expect(page.getByText(`Pedido #${order.number}`)).toBeVisible();
  expect([...hosts].sort()).toEqual(["localhost:3001", "localhost:8000"]);

  await cancelDeliveryApi(request, order.bearer, order.id);
  await expect(page.getByRole("heading", { name: "Acompanhamento encerrado" })).toBeVisible({ timeout: 40_000 });
});

test("acompanhar pedido: token falso dá 404 com texto fixo", async ({ page, guard }) => {
  guard.expectResponse("/public/deliveries/", 404);
  await page.goto("/r/#nenhumTokenValidoAqui12");
  await expect(page.getByRole("heading", { name: "Pedido não encontrado" })).toBeVisible();
});
