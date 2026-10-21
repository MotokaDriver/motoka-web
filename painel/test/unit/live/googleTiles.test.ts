import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DARK_STYLES,
  SESSION_MARGIN_MS,
  TilesError,
  buildStyle,
  createSession,
  fetchCopyright,
  getSession,
  resetSessionCache,
  tileUrl,
} from "@/features/live/googleTiles";

const CONFIG = { key: "e2e-fake-key-0000000000", base: "http://localhost:8790" };
const NOW = Date.parse("2026-10-20T12:00:00Z");
const expiryIn = (ms: number) => String(Math.floor((NOW + ms) / 1000));

type Call = { url: string; init?: RequestInit };
let calls: Call[];

function stubFetch(...replies: (() => Response | Promise<Response>)[]) {
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)]!;
    return Promise.resolve(reply());
  });
}
const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status });
const sessionReply = (session: string, ttlMs = 14 * 24 * 3_600_000) => json({ session, expiry: expiryIn(ttlMs), tileWidth: 512, tileHeight: 512, imageFormat: "png" });

beforeEach(() => {
  calls = [];
  resetSessionCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Map Tiles API do Google (WN-3b)", () => {
  it("createSession: POST com a chave na query e o corpo da D-W3b-04 (escuro, 2x, pt-BR, BR)", async () => {
    stubFetch(sessionReply("s1"));
    const session = await createSession(CONFIG);
    expect(session).toMatchObject({ session: "s1", expiry: Number(expiryIn(14 * 24 * 3_600_000)) * 1000 });
    // ttl relativo ao relógio local na hora da resposta (a base do agendamento no MapView).
    expect(Math.abs(session.ttl! - (session.expiry - Date.now()))).toBeLessThan(1_000);
    expect(Math.abs(session.receivedAt! - Date.now())).toBeLessThan(1_000);
    expect(session.receivedAt! + session.ttl!).toBe(session.expiry);
    expect(calls[0]!.url).toBe("http://localhost:8790/v1/createSession?key=e2e-fake-key-0000000000");
    expect(calls[0]!.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({
      mapType: "roadmap",
      language: "pt-BR",
      region: "BR",
      scale: "scaleFactor2x",
      highDpi: true,
      styles: JSON.parse(JSON.stringify(DARK_STYLES)),
    });
  });

  it("sessionRemaining: receivedAt + ttl − agora; sem os dois, expiry − agora", async () => {
    const { sessionRemaining } = await import("@/features/live/googleTiles");
    // Relógio local 2 h adiantado: o expiry absoluto diz 1 h, o ttl recebido diz 3 h e manda.
    expect(sessionRemaining({ session: "s", expiry: NOW + 3_600_000, ttl: 3 * 3_600_000, receivedAt: NOW - 600_000 }, NOW)).toBe(3 * 3_600_000 - 600_000);
    expect(sessionRemaining({ session: "s", expiry: NOW + 3_600_000 }, NOW)).toBe(3_600_000);
    expect(sessionRemaining({ session: "s", expiry: NOW + 3_600_000, ttl: 5 }, NOW)).toBe(3_600_000);
  });

  it("createSession: 403, rede fora e resposta sem sessão viram TilesError", async () => {
    stubFetch(json({ error: { code: 403 } }, 403));
    await expect(createSession(CONFIG)).rejects.toMatchObject({ status: 403 });
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(createSession(CONFIG)).rejects.toBeInstanceOf(TilesError);
    stubFetch(json({ expiry: expiryIn(3_600_000) }));
    await expect(createSession(CONFIG)).rejects.toBeInstanceOf(TilesError);
  });

  it("getSession: dois pedidos juntos dividem um fetch, e a sessão é reaproveitada com mais de 1 h de folga", async () => {
    stubFetch(sessionReply("s1"));
    const [a, b] = await Promise.all([getSession(CONFIG, { now: NOW }), getSession(CONFIG, { now: NOW })]);
    expect(a).toBe(b);
    expect(await getSession(CONFIG, { now: NOW + 1_000 })).toBe(a);
    expect(calls).toHaveLength(1);
  });

  it("getSession: rejeição não fica em cache; o próximo pedido tenta de novo", async () => {
    stubFetch(json({}, 500), sessionReply("s2"));
    await expect(getSession(CONFIG, { now: NOW })).rejects.toMatchObject({ status: 500 });
    expect((await getSession(CONFIG, { now: NOW })).session).toBe("s2");
    expect(calls).toHaveLength(2);
  });

  it("getSession: renova com menos de 1 h para o expiry, ou quando o tile recusou a sessão do cache", async () => {
    stubFetch(sessionReply("s1", 2 * SESSION_MARGIN_MS), sessionReply("s2"), sessionReply("s3"));
    expect((await getSession(CONFIG, { now: NOW })).session).toBe("s1");
    // Faltando 59 min: sessão nova.
    expect((await getSession(CONFIG, { now: NOW + SESSION_MARGIN_MS + 60_000 })).session).toBe("s2");
    // O tile recusou s2: descarta; um `stale` antigo (s1) não derruba a s3 já em cache.
    expect((await getSession(CONFIG, { stale: "s2", now: NOW })).session).toBe("s3");
    expect((await getSession(CONFIG, { stale: "s1", now: NOW })).session).toBe("s3");
    expect(calls).toHaveLength(3);
  });

  it("estilo: uma fonte raster com a sessão e a chave, tile de 512 px servido em 256, teto de zoom 20", () => {
    const session = { session: "abc/=", expiry: NOW + 86_400_000 };
    const style = buildStyle(CONFIG, session);
    expect(style.version).toBe(8);
    expect(style.glyphs).toBeUndefined();
    expect(style.sources.google).toEqual({ type: "raster", tiles: [tileUrl(CONFIG, session)], tileSize: 256, maxzoom: 20 });
    expect(tileUrl(CONFIG, session)).toBe("http://localhost:8790/v1/2dtiles/{z}/{x}/{y}?session=abc%2F%3D&key=e2e-fake-key-0000000000");
    expect(style.layers.map((l) => l.type)).toEqual(["background", "raster"]);
  });

  it("copyright: GET do viewport com zoom inteiro e limites dentro do globo", async () => {
    stubFetch(json({ copyright: "Dados do mapa ©2026 Google", maxZoomRects: [] }));
    const text = await fetchCopyright(CONFIG, { session: "s1", expiry: NOW }, { north: 95, south: -25.5, east: 200, west: -49.4 }, 13.6);
    expect(text).toBe("Dados do mapa ©2026 Google");
    const url = new URL(calls[0]!.url);
    expect(url.origin + url.pathname).toBe("http://localhost:8790/tile/v1/viewport");
    expect(Object.fromEntries(url.searchParams)).toEqual({ session: "s1", key: CONFIG.key, zoom: "14", north: "90", south: "-25.5", east: "180", west: "-49.4" });
    stubFetch(json({}, 403));
    await expect(fetchCopyright(CONFIG, { session: "s1", expiry: NOW }, { north: 1, south: 0, east: 1, west: 0 }, 3)).rejects.toMatchObject({ status: 403 });
  });
});

describe("Map Tiles API: bordas (hm-qa WN-3b)", () => {
  it("rejeição em voo é dividida pelos dois pedidos e sai do cache; o terceiro tenta de novo", async () => {
    stubFetch(json({}, 403), sessionReply("s2"));
    const [a, b] = await Promise.allSettled([getSession(CONFIG, { now: NOW }), getSession(CONFIG, { now: NOW })]);
    expect(a).toMatchObject({ status: "rejected", reason: { status: 403 } });
    expect(b).toMatchObject({ status: "rejected", reason: { status: 403 } });
    expect(calls).toHaveLength(1);
    expect((await getSession(CONFIG, { now: NOW })).session).toBe("s2");
    expect(calls).toHaveLength(2);
  });

  it("stale enquanto a sessão ainda está em voo: divide o fetch em vez de abrir outro", async () => {
    stubFetch(sessionReply("s1"), sessionReply("s2"));
    const [a, b] = await Promise.all([getSession(CONFIG, { now: NOW }), getSession(CONFIG, { stale: "s0", now: NOW })]);
    expect(a.session).toBe("s1");
    expect(b.session).toBe("s1");
    expect(calls).toHaveLength(1);
  });

  it("borda exata da margem: com exatamente 1 h de folga já renova; com 1 h + 1 ms reaproveita", async () => {
    stubFetch(sessionReply("s1", 2 * SESSION_MARGIN_MS), sessionReply("s2"));
    await getSession(CONFIG, { now: NOW });
    expect((await getSession(CONFIG, { now: NOW + SESSION_MARGIN_MS - 1 })).session).toBe("s1");
    expect((await getSession(CONFIG, { now: NOW + SESSION_MARGIN_MS })).session).toBe("s2");
  });

  it("sessão vencida no cache (relógio passou do expiry) nunca é devolvida", async () => {
    stubFetch(sessionReply("s1", 2 * SESSION_MARGIN_MS), sessionReply("s2"));
    await getSession(CONFIG, { now: NOW });
    expect((await getSession(CONFIG, { now: NOW + 30 * 24 * 3_600_000 })).session).toBe("s2");
  });

  it("outra chave ou outra base não reaproveita a sessão do cache", async () => {
    stubFetch(sessionReply("s1"), sessionReply("s2"), sessionReply("s3"));
    expect((await getSession(CONFIG, { now: NOW })).session).toBe("s1");
    expect((await getSession({ ...CONFIG, key: "outra-chave-000000000000" }, { now: NOW })).session).toBe("s2");
    expect((await getSession({ ...CONFIG, base: "https://tile.googleapis.com" }, { now: NOW })).session).toBe("s3");
    expect(calls).toHaveLength(3);
  });

  it("createSession: 429 mantém o status; 200 com corpo não-JSON e expiry não numérico são TilesError", async () => {
    stubFetch(json({ error: { code: 429 } }, 429));
    await expect(createSession(CONFIG)).rejects.toMatchObject({ status: 429 });
    stubFetch(() => new Response("<html>", { status: 200 }));
    await expect(createSession(CONFIG)).rejects.toMatchObject({ status: 200 });
    stubFetch(json({ session: "s1", expiry: "amanhã" }));
    await expect(createSession(CONFIG)).rejects.toBeInstanceOf(TilesError);
    stubFetch(json(null));
    await expect(createSession(CONFIG)).rejects.toBeInstanceOf(TilesError);
  });

  it("chave com caracteres especiais vai codificada na URL da sessão e dos tiles", async () => {
    const config = { key: "a+b/c=d&e", base: CONFIG.base };
    stubFetch(sessionReply("s1"));
    await createSession(config);
    expect(calls[0]!.url).toBe("http://localhost:8790/v1/createSession?key=a%2Bb%2Fc%3Dd%26e");
    expect(tileUrl(config, { session: "s1", expiry: NOW })).toContain("&key=a%2Bb%2Fc%3Dd%26e");
  });

  it("copyright: abort propaga o AbortError (não vira TilesError); copyright que não é texto vira vazio; zoom negativo vira 0", async () => {
    vi.stubGlobal("fetch", (_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );
    const abort = new AbortController();
    const pending = fetchCopyright(CONFIG, { session: "s1", expiry: NOW }, { north: 1, south: 0, east: 1, west: 0 }, 3, abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    stubFetch(json({ copyright: 42 }));
    expect(await fetchCopyright(CONFIG, { session: "s1", expiry: NOW }, { north: 1, south: 0, east: 1, west: 0 }, -2)).toBe("");
    expect(new URL(calls[0]!.url).searchParams.get("zoom")).toBe("0");
    stubFetch(json({ copyright: "x" }));
    await fetchCopyright(CONFIG, { session: "s1", expiry: NOW }, { north: 1, south: 0, east: 1, west: 0 }, 25);
    expect(new URL(calls[1]!.url).searchParams.get("zoom")).toBe("20");
  });

  it("estilo escuro curto (o Google ignora estilo grande em silêncio): corpo do createSession abaixo de 2 KB", () => {
    expect(JSON.stringify(DARK_STYLES).length).toBeLessThan(2048);
  });
});
