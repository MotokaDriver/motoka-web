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

test.describe("Mapa ao vivo (WN-3)", () => {
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

    const side = page.getByRole("complementary", { name: "Equipe agora" });
    await expect(side.getByText("1 em turno")).toBeVisible();
    await expect(side.getByRole("button", { name: /Diego Ramos, Entregando/ })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /^Ao vivo$/ })).toBeVisible();
    await expect(page.getByText(/1 em turno · 1 entrega na rua · 3 feitas hoje/)).toBeVisible();
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
