// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { injectApiMeta } from "../../../scripts/copy-static.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
const js = fs.readFileSync(path.join(root, "static-pages/r/r.js"), "utf8");
const html = injectApiMeta(fs.readFileSync(path.join(root, "static-pages/r/index.html"), "utf8"), "http://api.test/v1");
const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";

interface View {
  title: string;
  steps: Array<{ label: string; state: string }>;
  code: string | null;
  position: string;
  stale: boolean;
  subtitle: string;
}

/** Executa o r.js do jeito do navegador (script clássico). */
function run(testHook: boolean) {
  const w = window as unknown as Record<string, unknown>;
  if (testHook) w.__MOTOKA_R_TEST__ = true;
  else delete w.__MOTOKA_R_TEST__;
  // eslint-disable-next-line no-eval -- só o teste executa o r.js (script clássico) dentro do jsdom
  (0, eval)(js);
  return w.__MOTOKA_R__ as {
    parseToken: (p: string, h: string) => { token: string; fromPath: boolean } | null;
    orderView: (d: unknown, p: { recordedAt: string } | null, now: number) => View;
    positionView: (p: { recordedAt: string } | null, now: number, stage: string) => { text: string; stale: boolean };
    errorKind: (s: number | null) => { kind: string; final: boolean };
    nextDelay: (a: number | undefined, b: number | null) => number;
  };
}

const delivery = (over: Record<string, unknown> = {}) => ({
  number: 184,
  stage: "on_the_way",
  establishment: { name: "Padaria", location: null },
  driver: { first_name: "Diego" },
  destination: null,
  code: "4821",
  updated_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  driver_position: null,
  signal: "none",
  poll_after_seconds: 15,
  ...over,
});

describe("funções puras", () => {
  const api = run(true);

  it("token do fragmento e do caminho; lixo é recusado", () => {
    expect(api.parseToken("/r/", `#${TOKEN}`)).toEqual({ token: TOKEN, fromPath: false });
    expect(api.parseToken(`/r/${TOKEN}`, "")).toEqual({ token: TOKEN, fromPath: true });
    for (const bad of ["#", "#curto", "#%E0%A4%A", `#${TOKEN}/../x`, "#<script>alert(1)</script>"]) {
      expect(api.parseToken("/r/", bad)).toBeNull();
    }
  });

  it("etapas, motoboy só pelo primeiro nome, código só quando vem", () => {
    const now = Date.now();
    const v = api.orderView(delivery(), null, now);
    expect(v.steps.map((s) => s.state)).toEqual(["done", "done", "current", "todo"]);
    expect(v.subtitle).toBe("Diego está com o seu pedido.");
    expect(v.code).toBe("4821");
    expect(api.orderView(delivery({ code: null, stage: "preparing", driver: null }), null, now)).toMatchObject({
      code: null,
      subtitle: "Pedido #184",
      title: "A loja está preparando o seu pedido",
    });
    expect(api.orderView(delivery({ stage: "returning" }), null, now)).toMatchObject({
      steps: [],
      title: "O pedido está voltando para a loja",
    });
  });

  it("o pin envelhece sozinho depois de 120 s sem position", () => {
    const now = Date.parse("2026-10-05T21:00:00Z");
    const at = (secondsAgo: number) => ({ recordedAt: new Date(now - secondsAgo * 1000).toISOString() });
    expect(api.positionView(at(10), now, "on_the_way")).toEqual({ text: "Posição do motoboy atualizada há 10 s.", stale: false });
    expect(api.positionView(at(90), now, "on_the_way").text).toBe("Posição do motoboy atualizada há 2 minutos.");
    expect(api.positionView(at(121), now, "on_the_way")).toEqual({ text: "Atualizando a posição…", stale: true });
    expect(api.positionView(null, now, "on_the_way").text).toBe("Aguardando a posição do motoboy.");
    expect(api.positionView(at(10), now, "preparing").text).toBe("");
  });

  it("erros por status e cadência do polling", () => {
    expect(api.errorKind(410)).toEqual({ kind: "ended", final: true });
    expect(api.errorKind(404)).toEqual({ kind: "notFound", final: true });
    expect(api.errorKind(429)).toEqual({ kind: "rate", final: false });
    expect(api.errorKind(null)).toEqual({ kind: "network", final: false });
    expect(api.errorKind(503)).toEqual({ kind: "generic", final: false });
    expect(api.nextDelay(15, null)).toBe(15000);
    expect(api.nextDelay(1, null)).toBe(5000);
    expect(api.nextDelay(15, 60)).toBe(60000);
  });
});

describe("página", () => {
  const requests: string[] = [];
  let responses: Array<() => Promise<Response>> = [];

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) => () =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } }));

  const resetDom = () => {
    document.documentElement.innerHTML = html.replace(/^[\s\S]*?<html[^>]*>/i, "").replace(/<\/html>\s*$/i, "");
  };

  beforeEach(() => {
    vi.useFakeTimers();
    requests.length = 0;
    responses = [];
    resetDom();
    vi.stubGlobal("fetch", (url: string) => {
      requests.push(String(url));
      const next = responses.shift();
      return next ? next() : Promise.reject(new TypeError("sem resposta"));
    });
    (window as unknown as { EventSource?: unknown }).EventSource = undefined;
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const text = (id: string) => document.getElementById(id)?.textContent ?? "";
  const visible = (id: string) => document.getElementById(id)?.hidden === false;
  const boot = async (hash = `#${TOKEN}`) => {
    window.history.replaceState(null, "", `/r/${hash}`);
    run(false);
    await vi.advanceTimersByTimeAsync(0);
  };

  it("mostra o pedido e o código, e só chama a API (a primeira com mark_opened)", async () => {
    responses = [json(200, delivery())];
    await boot();
    expect(visible("order")).toBe(true);
    expect(text("title")).toBe("O seu pedido está a caminho");
    expect(text("store")).toBe("Padaria");
    expect(visible("code-card")).toBe(true);
    expect(text("code")).toBe("4821");
    expect(requests).toEqual([`http://api.test/v1/public/deliveries/${TOKEN}?mark_opened=true`]);
  });

  it("link antigo /r/<token> vira /r/#<token>", async () => {
    responses = [json(200, delivery())];
    window.history.replaceState(null, "", `/r/${TOKEN}`);
    run(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(window.location.pathname).toBe("/r/");
    expect(window.location.hash).toBe(`#${TOKEN}`);
  });

  it("410 vira acompanhamento encerrado e para o polling", async () => {
    responses = [json(410, { error_code: "DELIVERY_TRACKING_EXPIRED" })];
    await boot();
    expect(visible("error")).toBe(true);
    expect(text("error-title")).toBe("Acompanhamento encerrado");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(requests).toHaveLength(1);
  });

  it("404 e token inválido (este nem chama a API)", async () => {
    responses = [json(404, { error_code: "DELIVERY_TRACKING_NOT_FOUND" })];
    await boot();
    expect(text("error-title")).toBe("Pedido não encontrado");
    resetDom();
    await boot("#curto");
    expect(text("error-title")).toBe("Link incompleto");
    expect(requests).toHaveLength(1);
  });

  it("sem rede: avisa, tenta de novo e se recupera", async () => {
    responses = [() => Promise.reject(new TypeError("offline")), json(200, delivery({ stage: "preparing", code: null }))];
    await boot();
    expect(text("status")).toContain("Sem conexão");
    await vi.advanceTimersByTimeAsync(15_000);
    expect(requests).toHaveLength(2);
    expect(text("title")).toBe("A loja está preparando o seu pedido");
    expect(text("status")).toBe("");
    expect(visible("code-card")).toBe(false);
  });

  it("polling de 15 s com a aba visível; pausa com a aba oculta", async () => {
    responses = [json(200, delivery()), json(200, delivery()), json(200, delivery())];
    await boot();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(requests).toHaveLength(2);
    expect(requests[1]).not.toContain("mark_opened");
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(requests).toHaveLength(2);
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    // Instâncias de testes anteriores seguem ouvindo o `document` (só nos testes): conta pelo menos a desta.
    expect(requests.length).toBeGreaterThanOrEqual(3);
  });

  it("429 respeita o Retry-After", async () => {
    responses = [json(429, { error_code: "RATE_LIMIT_EXCEEDED" }, { "Retry-After": "40" }), json(200, delivery())];
    await boot();
    expect(text("error-title")).toBe("Muitas tentativas");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(requests).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(requests).toHaveLength(2);
  });

  it("o pin envelhece sozinho com o stream aberto", async () => {
    type Handler = (e: { data: string }) => void;
    const handlers: Record<string, Handler> = {};
    class FakeES {
      static CLOSED = 2;
      readyState = 1;
      onerror: (() => void) | null = null;
      constructor(url: string) {
        requests.push(url);
      }
      addEventListener(name: string, h: Handler) {
        handlers[name] = h;
      }
      close() {
        this.readyState = 2;
      }
    }
    (window as unknown as { EventSource?: unknown }).EventSource = FakeES;
    responses = [json(200, delivery())];
    await boot();
    expect(requests[1]).toBe(`http://api.test/v1/public/deliveries/${TOKEN}/stream`);
    handlers.position?.({ data: JSON.stringify({ lat: -25.4, lng: -49.2, recorded_at: new Date().toISOString() }) });
    expect(text("position")).toMatch(/Posição do motoboy atualizada há \d+ s\./);
    await vi.advanceTimersByTimeAsync(125_000);
    expect(text("position")).toBe("Atualizando a posição…");
    handlers.ended?.({ data: "{}" });
    expect(text("error-title")).toBe("Acompanhamento encerrado");
  });
});
