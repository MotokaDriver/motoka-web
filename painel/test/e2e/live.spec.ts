import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./guard";
import { API } from "./mockApi";

const REFRESH = `${API}/v1/web/auth/refresh`;
const STREAM = `${API}/v1/tracking/live/stream`;
const MAPLIBRE = JSON.parse(fs.readFileSync(path.join(process.cwd(), "node_modules/maplibre-gl/package.json"), "utf8")).version as string;

async function openLive(page: Page) {
  await page.goto("/entrar/");
  await page.getByLabel("CPF/CNPJ ou e-mail").fill("11222333000181");
  await page.getByLabel("Senha", { exact: true }).fill("NovaSenha@1");
  await page.getByLabel("Senha", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/ao-vivo\/$/);
  await expect(page.getByRole("heading", { name: "Mapa ao vivo", level: 1 })).toBeAttached();
}

test.describe("Mapa ao vivo (WN-3, WN-3b)", () => {
  test("E17: lembrar de ativar a localização de quem está sem sinal", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.capabilities.tracking = true;
    api.livePositionAgeMs = 600_000;
    guard.expectResponse(`${API}/v1/teams/me/members/11111111-1111-4111-8111-111111111111/remind-location`, 429);
    await openLive(page);
    const side = page.getByRole("complementary", { name: "Equipe agora" });
    const remind = side.getByRole("button", { name: "Lembrar Diego R. de ativar a localização" });
    await expect(remind).toBeVisible();
    await remind.click();
    await expect(page.getByText("Lembrete enviado.")).toBeVisible();
    expect(api.services.calls).toContain("POST /teams/me/members/11111111-1111-4111-8111-111111111111/remind-location");
    // Duas vezes seguidas: o servidor recusa com 429 e o painel mostra o texto fixo.
    api.services.nextReminderError = { status: 429, code: "TEAM_REMINDER_TOO_SOON" };
    await remind.click();
    await expect(page.getByText("O lembrete acabou de ser enviado. Aguarde alguns minutos para reenviar.")).toBeVisible();
  });

  test("mapa, worker do MapLibre do próprio site, stream e cartões", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.capabilities.tracking = true;
    const workers: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/_maplibre/")) workers.push(request.url());
    });
    await openLive(page);

    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await expect.poll(() => workers.length).toBeGreaterThan(0);
    for (const url of workers) expect(url).toContain(`http://localhost:8787/_maplibre/${MAPLIBRE}/`);
    // Tiles do Google (WN-3b, mock na 8790): sessão, tiles, e a atribuição (logo oficial e copyright do viewport).
    const map = page.getByTestId("live-map").locator("..");
    await expect(map.getByRole("img", { name: "Google Maps" })).toBeVisible();
    await expect(map.getByRole("img", { name: "Google Maps" })).toHaveAttribute("src", "/google-maps-logo.svg");
    await expect(map.getByText("Dados do mapa ©2026 Google")).toBeVisible();
    await expect(page.locator(".maplibregl-ctrl-attrib")).toHaveCount(0);
    expect(api.googleTiles.sessions).toBe(1);
    await expect.poll(() => api.googleTiles.tiles).toBeGreaterThan(0);

    const side = page.getByRole("complementary", { name: "Equipe agora" });
    await expect(side.getByText("1 em turno")).toBeVisible();
    await expect(side.getByRole("button", { name: /Diego Ramos, Entregando/ })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /^Ao vivo$/ })).toBeVisible();
    await expect(page.getByText(/1 em turno · 1 entrega na rua · 0 livres · 3 feitas hoje/)).toBeVisible();
    // A loja e o motoboy: dois marcadores.
    await expect(page.locator(".maplibregl-marker")).toHaveCount(2);
    await expect(page.locator(".maplibregl-marker").filter({ hasText: "DR" })).toHaveCount(1);

    await side.getByRole("button", { name: /Diego Ramos/ }).click();
    const panel = page.getByRole("region", { name: "Detalhe de Diego Ramos" });
    await expect(panel.getByText("#184 · Marina Souza")).toBeVisible();
    await expect(panel.getByRole("link", { name: "Ligar" })).toHaveAttribute("href", "tel:+5541999990077");
    await expect(panel.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/5541999990077/);
    expect(api.liveStreams).toBe(1);
  });

  // WN-3b, D-W3b-07 com o MapLibre de verdade: o `status` do AJAXError do tile chega ao handler de erro.
  test("createSession 403 (chave errada, API desligada): Não foi possível carregar o mapa, e a lateral segue", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse("/v1/createSession", 403);
    api.capabilities.tracking = true;
    api.googleTiles.sessionStatus = 403;
    await openLive(page);
    await expect(page.getByText("Não foi possível carregar o mapa")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Equipe agora" }).getByRole("button", { name: /Diego Ramos, Entregando/ })).toBeVisible();
    await expect(page.getByRole("img", { name: "Google Maps" })).toHaveCount(0);
    expect(api.googleTiles.tiles).toBe(0);
  });

  test("tile 429 (cota): O mapa atingiu o limite de uso por agora, sem pedir sessão nova", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse("/v1/2dtiles/", 429);
    api.capabilities.tracking = true;
    api.googleTiles.tileStatus = 429;
    await openLive(page);
    await expect(page.getByText("O mapa atingiu o limite de uso por agora")).toBeVisible();
    await expect(page.getByText("A lista ao lado continua atualizando.")).toBeVisible();
    expect(api.googleTiles.sessions).toBe(1);
  });

  test("tile 403 com a sessão vencida: renova uma vez e o mapa segue com a sessão nova", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse("/v1/2dtiles/", 403);
    api.capabilities.tracking = true;
    api.googleTiles.refuseSessions.add("sessao-e2e");
    const tiles: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/v1/2dtiles/")) tiles.push(request.url());
    });
    await openLive(page);
    await expect.poll(() => api.googleTiles.sessions).toBe(2);
    await expect.poll(() => tiles.some((url) => url.includes("session=sessao-e2e-2"))).toBe(true);
    await expect(page.locator(".maplibregl-canvas")).toBeVisible();
    await expect(page.getByText("Não foi possível carregar o mapa")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Google Maps" })).toBeVisible();
  });

  test("tile 403 que persiste depois de renovar: desiste com Não foi possível carregar o mapa (duas sessões, não um laço)", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse("/v1/2dtiles/", 403);
    api.capabilities.tracking = true;
    api.googleTiles.tileStatus = 403;
    await openLive(page);
    await expect(page.getByText("Não foi possível carregar o mapa")).toBeVisible();
    expect(api.googleTiles.sessions).toBe(2);
  });

  test("teclado: zoom do mapa com nome acessível, focável e acionado por Enter; um zoom pede um viewport só", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.capabilities.tracking = true;
    await openLive(page);
    await expect(page.getByText("Dados do mapa ©2026 Google")).toBeVisible();
    const zoomIn = page.getByRole("button", { name: "Aproximar" });
    await expect(zoomIn).toBeVisible();
    await expect(page.getByRole("button", { name: "Afastar" })).toBeVisible();
    // Os pins são decorativos (aria-hidden); a lateral é a alternativa acessível.
    await expect(page.locator(".maplibregl-marker[aria-hidden='true']").first()).toBeAttached();
    // Foco e Enter no controle de zoom (botão nativo do MapLibre).
    await zoomIn.focus();
    await expect(zoomIn).toBeFocused();
    const before = api.googleTiles.viewports;
    await page.keyboard.press("Enter");
    await expect.poll(() => api.googleTiles.viewports, { timeout: 5_000 }).toBe(before + 1);
    // Sem novos movimentos, nenhum viewport extra (debounce, sem polling).
    await page.waitForTimeout(1_200);
    expect(api.googleTiles.viewports).toBe(before + 1);
  });

  test("tela de 390 px com copyright longo: vira o botão Fontes de dados, nada cobre o logo, e o popover mostra o texto", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.capabilities.tracking = true;
    const long = "Dados do mapa ©2026 Google, INEGI, Imagens ©2026 TerraMetrics, Airbus, CNES / Airbus, Landsat / Copernicus, Maxar Technologies";
    api.googleTiles.copyright = long;
    await page.setViewportSize({ width: 390, height: 844 });
    await openLive(page);
    const logo = page.getByRole("img", { name: "Google Maps" });
    const sources = page.getByRole("button", { name: "Fontes de dados" });
    await expect(logo).toBeVisible();
    await expect(sources).toBeVisible();
    await expect(sources).toHaveAttribute("aria-expanded", "false");
    // A linha cortada não aparece (só serve de medida).
    await expect(page.getByText(long)).toBeHidden();
    const apart = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
      a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
    const logoBox = (await logo.boundingBox())!;
    expect(logoBox.height).toBeGreaterThanOrEqual(16);
    expect(logoBox.height).toBeLessThanOrEqual(19);
    expect(apart(logoBox, (await sources.boundingBox())!)).toBe(true);

    await sources.click();
    await expect(sources).toHaveAttribute("aria-expanded", "true");
    const popover = page.locator(`[id="${await sources.getAttribute("aria-controls")}"]`);
    await expect(popover).toHaveText(long);
    const popoverBox = (await popover.boundingBox())!;
    expect(apart(logoBox, popoverBox)).toBe(true);
    expect(popoverBox.x).toBeGreaterThanOrEqual(0);
    expect(popoverBox.x + popoverBox.width).toBeLessThanOrEqual(390);

    await page.keyboard.press("Escape");
    await expect(sources).toHaveAttribute("aria-expanded", "false");
    await expect(sources).toBeFocused();
    await sources.click();
    await page.getByRole("heading", { name: "Equipe agora" }).click();
    await expect(sources).toHaveAttribute("aria-expanded", "false");
  });

  test("mock da Map Tiles API: só os caminhos exatos do Google respondem (o painel não pode acertar por acaso)", async ({ request, api }) => {
    const body = { mapType: "roadmap", language: "pt-BR", region: "BR", scale: "scaleFactor2x", highDpi: true, styles: [{ stylers: [{ color: "#000000" }] }] };
    const key = "key=e2e-fake-key-0000000000";
    expect((await request.post(`${API}/v1/createSession?${key}`, { data: body })).status()).toBe(200);
    // Sem o /v1, ou com /v1 a mais: não é a Map Tiles API, cai na API do Motoka (sem token, 401) e não conta como tile.
    expect((await request.post(`${API}/createSession?${key}`, { data: body })).status()).toBe(401);
    expect((await request.get(`${API}/2dtiles/1/1/1?session=sessao-e2e&${key}`)).status()).toBe(401);
    expect((await request.get(`${API}/v1/tile/v1/viewport?session=sessao-e2e&${key}&zoom=3&north=1&south=0&east=1&west=0`)).status()).toBe(401);
    expect((await request.get(`${API}/tile/v1/viewport?session=sessao-e2e&${key}&zoom=3&north=1&south=0&east=1&west=0`)).status()).toBe(200);
    expect((await request.get(`${API}/v1/2dtiles/1/1/1?session=sessao-e2e&${key}`)).headers()["content-type"]).toBe("image/png");
    expect(api.googleTiles).toMatchObject({ sessions: 1, tiles: 1, viewports: 1 });
  });

  test("o pin envelhece sozinho: stale depois de 120 s, sem pin e Sem sinal depois de 180 s (stream aberto e mudo)", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.capabilities.tracking = true;
    api.streamSilent = true;
    api.livePositionAgeMs = 117_000;
    await openLive(page);
    const marker = page.locator(".maplibregl-marker").filter({ hasText: "DR" });
    await expect(marker).toBeVisible();
    await expect(marker).toHaveCSS("border-top-style", "solid");
    await expect(marker).toHaveCSS("border-top-style", "dashed", { timeout: 15_000 }); // passou de 120 s sem evento
    await page.reload();
    api.livePositionAgeMs = 177_000;
    await page.reload();
    await expect(page.getByRole("button", { name: /Diego Ramos, Sem sinal/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".maplibregl-marker").filter({ hasText: "DR" })).toHaveCount(0, { timeout: 15_000 });
  });

  test("429 no stream cai no polling do L1 com a pílula âmbar; sair da tela fecha o transporte", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    guard.expectResponse(STREAM, 429);
    api.capabilities.tracking = true;
    api.streamStatus = 429;
    await openLive(page);
    await expect(page.getByText("Atualização a cada 10 s")).toBeVisible();
    await expect(page.getByRole("button", { name: /Diego Ramos/ })).toBeVisible();
  });

  test("sem rastreio ligado: lateral e atenção funcionam, sem erro", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.capabilities.tracking = false;
    api.deliveries.seed({ number: 12, status: "preparing", name: "Cliente Atenção", needsAttention: true });
    await openLive(page);
    await expect(page.getByText("O rastreio dos motoboys ainda não foi ativado para a sua conta.")).toBeVisible();
    await expect(page.getByText("Pedidos pedindo atenção")).toBeVisible();
    await expect(page.getByRole("link", { name: /#12 · Sem motoboy/ })).toBeVisible();
  });

  test("a lateral some com o bloco de atenção quando não há pendência, e sair da tela libera o stream", async ({ page, guard, api }) => {
    guard.expectResponse(REFRESH, 401);
    api.capabilities.tracking = true;
    await openLive(page);
    await expect(page.getByText("Pedidos pedindo atenção")).toHaveCount(0);
    await page.getByRole("link", { name: /^Pedidos/ }).first().click();
    await expect(page).toHaveURL(/\/pedidos\/$/);
    await expect.poll(() => api.liveStreams, { timeout: 10_000 }).toBe(0);
  });
});
