import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TileSession } from "@/features/live/googleTiles";

// Ciclo de vida do mapa (WN-3b, D-W3b-05/06/07): renovação por timer e por visibilitychange, falhas, unmount no meio
// do createSession, copyright no load e debounce no moveend. O MapLibre e a sessão são de mentira; o tempo é falso.

const ml = vi.hoisted(() => ({
  maps: 0,
  removed: 0,
  handlers: new Map<string, (event?: unknown) => void>(),
  setTiles: [] as string[][],
  zoom: 13.4,
}));
vi.mock("maplibre-gl", () => {
  class Marker {
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    remove() {}
  }
  class MlMap {
    constructor() {
      ml.maps += 1;
    }
    addControl() {}
    on(type: string, handler: (event?: unknown) => void) {
      ml.handlers.set(type, handler);
    }
    getSource() {
      return { setTiles: (urls: string[]) => ml.setTiles.push(urls) };
    }
    getBounds() {
      return { getNorth: () => -25.3, getSouth: () => -25.5, getEast: () => -49.1, getWest: () => -49.4 };
    }
    getZoom() {
      return ml.zoom;
    }
    remove() {
      ml.removed += 1;
    }
    easeTo() {}
  }
  return { Map: MlMap, Marker, NavigationControl: function NavigationControl() {}, setWorkerUrl: () => undefined };
});
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

type Deferred = { promise: Promise<TileSession>; resolve: (s: TileSession) => void; reject: (e: unknown) => void };
type AnyFn = (...args: any[]) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
const tiles = vi.hoisted(() => ({
  getSession: null as unknown as import("vitest").Mock<AnyFn>,
  fetchCopyright: null as unknown as import("vitest").Mock<AnyFn>,
}));
vi.mock("@/features/live/googleTiles", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/features/live/googleTiles")>();
  return {
    ...real,
    getSession: (...args: unknown[]) => tiles.getSession(...args),
    fetchCopyright: (...args: unknown[]) => tiles.fetchCopyright(...args),
  };
});

const { default: MapView } = await import("@/features/live/MapView");
const { SESSION_MARGIN_MS } = await import("@/features/live/googleTiles");

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = Date.parse("2026-10-20T12:00:00Z");
const CONFIG = { key: "e2e-fake-key-0000000000", base: "http://localhost:8790" };
const tile = (s: string) => `http://localhost:8790/v1/2dtiles/{z}/{x}/{y}?session=${s}&key=${CONFIG.key}`;

function deferred(): Deferred {
  let resolve!: (s: TileSession) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<TileSession>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}
const flush = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)));
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

function mount(onFailed = vi.fn()) {
  const view = render(<MapView tiles={CONFIG} store={null} views={[]} selectedId={null} stops={[]} onSelect={() => undefined} onFailed={onFailed} />);
  return { ...view, onFailed };
}
/** Monta e entrega a primeira sessão (`ttl` a partir de agora). */
async function mountReady(ttl = 14 * DAY, onFailed = vi.fn()) {
  tiles.getSession.mockResolvedValueOnce({ session: "s1", expiry: Date.now() + ttl });
  const view = mount(onFailed);
  await flush();
  expect(ml.maps).toBe(1);
  return view;
}
const tileError = (status: number, session: string) =>
  act(async () => {
    ml.handlers.get("error")?.({ error: { status, url: `http://localhost:8790/v1/2dtiles/3/4/5?session=${session}&key=${CONFIG.key}` } });
    await vi.advanceTimersByTimeAsync(0);
  });

beforeEach(() => {
  vi.useFakeTimers({ now: T0, toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  ml.maps = 0;
  ml.removed = 0;
  ml.handlers.clear();
  ml.setTiles = [];
  ml.zoom = 13.4;
  tiles.getSession = vi.fn<AnyFn>();
  tiles.fetchCopyright = vi.fn<AnyFn>().mockResolvedValue("Dados do mapa ©2026 Google");
});
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
});

describe("renovação da sessão (D-W3b-06)", () => {
  it("timer: renova em expiry − 1 h, troca só a URL dos tiles e reagenda pela sessão nova", async () => {
    await mountReady(3 * HOUR);
    tiles.getSession.mockResolvedValueOnce({ session: "s2", expiry: Date.now() + 14 * DAY });
    await advance(3 * HOUR - SESSION_MARGIN_MS - 1);
    expect(tiles.getSession).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
    // Renovação de rotina: sem `stale` (a sessão não foi recusada).
    expect(tiles.getSession.mock.calls[1]![1]).toEqual({});
    expect(ml.setTiles).toEqual([[tile("s2")]]);
    // O mapa não foi recriado.
    expect(ml.maps).toBe(1);
    expect(ml.removed).toBe(0);
  });

  it("timer: dorme no máximo 24 h (setTimeout com semanas dispararia na hora) e não toca nos tiles se a sessão é a mesma", async () => {
    await mountReady(14 * DAY);
    tiles.getSession.mockImplementation(async () => ({ session: "s1", expiry: T0 + 14 * DAY }));
    await advance(DAY - 1);
    expect(tiles.getSession).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
    expect(ml.setTiles).toEqual([]);
    await advance(DAY);
    expect(tiles.getSession).toHaveBeenCalledTimes(3);
  });

  it("visibilitychange depois de suspensão: o relógio andou sem o timer correr; ao voltar, renova", async () => {
    await mountReady(14 * DAY);
    tiles.getSession.mockResolvedValueOnce({ session: "s2", expiry: T0 + 28 * DAY });
    const fire = (state: "visible" | "hidden") =>
      act(async () => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
        document.dispatchEvent(new Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(0);
      });
    // Com folga, voltar à aba não pede sessão.
    await fire("visible");
    expect(tiles.getSession).toHaveBeenCalledTimes(1);
    // Notebook dormiu: o relógio pula para 30 min do expiry sem disparar timers.
    vi.setSystemTime(T0 + 14 * DAY - 30 * 60_000);
    await fire("hidden");
    expect(tiles.getSession).toHaveBeenCalledTimes(1);
    await fire("visible");
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
    expect(ml.setTiles).toEqual([[tile("s2")]]);
  });

  it("tile 401/403: dois erros juntos pedem uma renovação só (com stale); 500 e erro sem status não renovam", async () => {
    const { onFailed } = await mountReady();
    const pending = deferred();
    tiles.getSession.mockReturnValueOnce(pending.promise);
    await tileError(403, "s1");
    await tileError(401, "s1");
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
    expect(tiles.getSession.mock.calls[1]![1]).toEqual({ stale: "s1" });
    await act(async () => pending.resolve({ session: "s2", expiry: Date.now() + 14 * DAY }));
    expect(ml.setTiles).toEqual([[tile("s2")]]);
    await tileError(500, "s2");
    await act(async () => ml.handlers.get("error")?.({ error: new Error("style") }));
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("tile 403, e a renovação falha: onFailed(\"error\")", async () => {
    const { onFailed } = await mountReady();
    tiles.getSession.mockRejectedValueOnce(new Error("403"));
    await tileError(403, "s1");
    expect(onFailed).toHaveBeenCalledWith("error");
  });

  it("tile 429: onFailed(\"quota\"), sem renovar a sessão", async () => {
    const { onFailed } = await mountReady();
    await tileError(429, "s1");
    expect(onFailed).toHaveBeenCalledWith("quota");
    expect(tiles.getSession).toHaveBeenCalledTimes(1);
  });

  // A renovação de rotina roda com 1 h de folga: se ela falha (rede piscou), a sessão atual ainda vale e o mapa fica.
  it("renovação de rotina falha com a sessão ainda válida: o mapa fica de pé e tenta de novo", async () => {
    const { onFailed } = await mountReady(3 * HOUR);
    tiles.getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await advance(3 * HOUR - SESSION_MARGIN_MS);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("nova tentativa em 1, 2 e 5 min (e 5 min depois disso); sucesso troca a sessão e zera o backoff", async () => {
    const { onFailed } = await mountReady(3 * HOUR);
    const offline = () => tiles.getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    offline();
    await advance(3 * HOUR - SESSION_MARGIN_MS);
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
    for (const [wait, calls] of [[60_000, 3], [120_000, 4], [300_000, 5], [300_000, 6]] as const) {
      offline();
      await advance(wait - 1);
      expect(tiles.getSession).toHaveBeenCalledTimes(calls - 1);
      await advance(1);
      expect(tiles.getSession).toHaveBeenCalledTimes(calls);
    }
    expect(onFailed).not.toHaveBeenCalled();
    tiles.getSession.mockResolvedValueOnce({ session: "s2", expiry: Date.now() + 14 * DAY });
    await advance(300_000);
    expect(ml.setTiles).toEqual([[tile("s2")]]);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("as tentativas não passam do expiry: com a sessão vencida, a falha derruba o mapa", async () => {
    const { onFailed } = await mountReady(SESSION_MARGIN_MS + 10 * 60_000);
    tiles.getSession.mockRejectedValue(new TypeError("Failed to fetch"));
    // Piso de 5 min no primeiro timer (faltavam 10 min para a margem), depois 1, 2, 5 min... até o expiry.
    await advance(SESSION_MARGIN_MS + 10 * 60_000 - 1);
    expect(onFailed).not.toHaveBeenCalled();
    await advance(1);
    expect(onFailed).toHaveBeenCalledWith("error");
  });

  it("relógio adiantado: sessão que já nasce dentro da margem não vira laço (sem setTiles, piso de 5 min)", async () => {
    const { onFailed } = await mountReady(3 * HOUR);
    // O Google manda um expiry que, no relógio local adiantado, fica a 10 min.
    tiles.getSession.mockResolvedValue({ session: "s2", expiry: Date.now() + 10 * 60_000, ttl: 10 * 60_000 });
    await advance(3 * HOUR - SESSION_MARGIN_MS);
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
    expect(ml.setTiles).toEqual([]);
    // Nada de renovar em 0: a próxima só depois do piso.
    await advance(5 * 60_000 - 1);
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(tiles.getSession).toHaveBeenCalledTimes(3);
    expect(ml.setTiles).toEqual([]);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("sessão inicial curta (ttl abaixo da margem): o primeiro timer respeita o piso de 5 min", async () => {
    tiles.getSession.mockResolvedValueOnce({ session: "s1", expiry: Date.now() + 20 * 60_000, ttl: 20 * 60_000 });
    mount();
    await flush();
    tiles.getSession.mockResolvedValue({ session: "s1", expiry: T0 + 20 * 60_000, ttl: 20 * 60_000 });
    await advance(5 * 60_000 - 1);
    expect(tiles.getSession).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
  });

  it("403 que chega com a renovação de rotina em voo: roda depois dela, com stale", async () => {
    await mountReady(3 * HOUR);
    const routine = deferred();
    tiles.getSession.mockReturnValueOnce(routine.promise);
    await advance(3 * HOUR - SESSION_MARGIN_MS);
    await tileError(403, "s1");
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
    // A rotina devolve a mesma sessão (cache): o 403 pendente pede uma nova, com stale.
    tiles.getSession.mockResolvedValueOnce({ session: "s2", expiry: Date.now() + 14 * DAY });
    await act(async () => routine.resolve({ session: "s1", expiry: T0 + 3 * HOUR }));
    await flush();
    expect(tiles.getSession).toHaveBeenCalledTimes(3);
    expect(tiles.getSession.mock.calls[2]![1]).toEqual({ stale: "s1" });
    expect(ml.setTiles).toEqual([[tile("s2")]]);
  });

  it("createSession com 429 no mount: onFailed(\"quota\")", async () => {
    const { TilesError } = await import("@/features/live/googleTiles");
    tiles.getSession.mockRejectedValueOnce(new TilesError(429));
    const { onFailed } = mount();
    await flush();
    expect(onFailed).toHaveBeenCalledWith("quota");
  });

  it("createSession com 429 na renovação de rotina, sessão ainda válida: o mapa fica e tenta de novo em 1 min", async () => {
    const { TilesError } = await import("@/features/live/googleTiles");
    const { onFailed } = await mountReady(3 * HOUR);
    tiles.getSession.mockRejectedValueOnce(new TilesError(429));
    await advance(3 * HOUR - SESSION_MARGIN_MS);
    expect(onFailed).not.toHaveBeenCalled();
    tiles.getSession.mockResolvedValueOnce({ session: "s2", expiry: Date.now() + 14 * DAY });
    await advance(60_000);
    expect(tiles.getSession).toHaveBeenCalledTimes(3);
    expect(ml.setTiles).toEqual([[tile("s2")]]);
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("createSession com 429 depois de o tile recusar a sessão (não há sessão válida): onFailed(\"quota\")", async () => {
    const { TilesError } = await import("@/features/live/googleTiles");
    const { onFailed } = await mountReady();
    tiles.getSession.mockRejectedValueOnce(new TilesError(429));
    await tileError(403, "s1");
    expect(onFailed).toHaveBeenCalledWith("quota");
  });

  it("remount com sessão do cache: a validade sai de receivedAt + ttl, não do instante do mount", async () => {
    // A sessão foi recebida 2 h 30 min atrás com ttl de 3 h: faltam 30 min, já dentro da margem de 1 h.
    tiles.getSession.mockResolvedValueOnce({ session: "s1", expiry: T0 + 30 * 60_000, ttl: 3 * HOUR, receivedAt: T0 - 150 * 60_000 });
    mount();
    await flush();
    tiles.getSession.mockResolvedValueOnce({ session: "s2", expiry: Date.now() + 14 * DAY, ttl: 14 * DAY, receivedAt: Date.now() });
    // Renova no piso de 5 min (e não em 3 h − 1 h, como se a sessão tivesse acabado de chegar).
    await advance(5 * 60_000);
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
    expect(ml.setTiles).toEqual([[tile("s2")]]);
  });

  it("remount com sessão do cache, depois de suspensão: o visibilitychange também usa receivedAt + ttl", async () => {
    tiles.getSession.mockResolvedValueOnce({ session: "s1", expiry: T0 + 30 * 60_000, ttl: 3 * HOUR, receivedAt: T0 - 150 * 60_000 });
    mount();
    await flush();
    tiles.getSession.mockResolvedValueOnce({ session: "s2", expiry: Date.now() + 14 * DAY });
    await act(async () => {
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(tiles.getSession).toHaveBeenCalledTimes(2);
  });
});

describe("unmount e vazamento (D-W3b-06)", () => {
  it("unmount durante o createSession: a sessão que chega depois não cria mapa nem avisa falha nem liga listener", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const pending = deferred();
    tiles.getSession.mockReturnValueOnce(pending.promise);
    const { unmount, onFailed } = mount();
    unmount();
    await act(async () => pending.resolve({ session: "s1", expiry: Date.now() + 14 * DAY }));
    expect(ml.maps).toBe(0);
    expect(onFailed).not.toHaveBeenCalled();
    expect(add.mock.calls.filter(([type]) => type === "visibilitychange")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    add.mockRestore();
  });

  it("unmount durante o createSession que depois falha: sem onFailed", async () => {
    const pending = deferred();
    tiles.getSession.mockReturnValueOnce(pending.promise);
    const { unmount, onFailed } = mount();
    unmount();
    await act(async () => pending.reject(new Error("403")));
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("unmount com o mapa de pé: remove o mapa, o listener de visibilidade, os timers e aborta o copyright em voo", async () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = await mountReady();
    let signal: AbortSignal | undefined;
    tiles.fetchCopyright.mockImplementation((_c, _s, _b, _z, s: AbortSignal) => {
      signal = s;
      return new Promise(() => undefined);
    });
    await act(async () => ml.handlers.get("moveend")?.());
    await advance(500);
    expect(signal?.aborted).toBe(false);
    await act(async () => ml.handlers.get("moveend")?.());
    unmount();
    expect(ml.removed).toBe(1);
    expect(signal?.aborted).toBe(true);
    expect(remove.mock.calls.filter(([type]) => type === "visibilitychange")).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
    remove.mockRestore();
  });
});

describe("atribuição do Google (D-W3b-05)", () => {
  it("logo com nome acessível \"Google Maps\" e o copyright do viewport buscado no load", async () => {
    await mountReady();
    expect(screen.getByRole("img", { name: "Google Maps" })).toHaveAttribute("src", "/google-maps-logo.svg");
    expect(tiles.fetchCopyright).not.toHaveBeenCalled();
    await act(async () => ml.handlers.get("load")?.());
    expect(tiles.fetchCopyright).toHaveBeenCalledTimes(1);
    const [config, session, bounds, zoom] = tiles.fetchCopyright.mock.calls[0]!;
    expect(config).toEqual(CONFIG);
    expect((session as TileSession).session).toBe("s1");
    expect(bounds).toEqual({ north: -25.3, south: -25.5, east: -49.1, west: -49.4 });
    expect(zoom).toBe(13.4);
    await flush();
    expect(screen.getByText("Dados do mapa ©2026 Google")).toBeInTheDocument();
  });

  it("moveend com debounce de 500 ms: uma rajada vira um pedido; o pedido anterior em voo é abortado", async () => {
    await mountReady();
    const signals: AbortSignal[] = [];
    tiles.fetchCopyright.mockImplementation(async (_c, _s, _b, _z, s: AbortSignal) => {
      signals.push(s);
      return `texto ${signals.length}`;
    });
    for (let i = 0; i < 5; i += 1) {
      await act(async () => ml.handlers.get("moveend")?.());
      await advance(100);
    }
    expect(tiles.fetchCopyright).not.toHaveBeenCalled();
    await advance(400);
    expect(tiles.fetchCopyright).toHaveBeenCalledTimes(1);
    expect(screen.getByText("texto 1")).toBeInTheDocument();
    await act(async () => ml.handlers.get("moveend")?.());
    await advance(500);
    expect(tiles.fetchCopyright).toHaveBeenCalledTimes(2);
    expect(signals[0]!.aborted).toBe(true);
    expect(screen.getByText("texto 2")).toBeInTheDocument();
  });

  it("viewport que falha sem texto ainda: tenta de novo em 5 s, 30 s e depois a cada 2 min, até conseguir", async () => {
    await mountReady();
    tiles.fetchCopyright.mockRejectedValue(new TypeError("Failed to fetch"));
    await act(async () => ml.handlers.get("load")?.());
    await flush();
    expect(tiles.fetchCopyright).toHaveBeenCalledTimes(1);
    for (const [wait, calls] of [[5_000, 2], [30_000, 3], [120_000, 4], [120_000, 5]] as const) {
      await advance(wait - 1);
      expect(tiles.fetchCopyright).toHaveBeenCalledTimes(calls - 1);
      await advance(1);
      expect(tiles.fetchCopyright).toHaveBeenCalledTimes(calls);
    }
    tiles.fetchCopyright.mockResolvedValue("Dados do mapa ©2026 Google");
    await advance(120_000);
    expect(screen.getByText("Dados do mapa ©2026 Google")).toBeInTheDocument();
    // Com o texto na tela, acabaram as tentativas.
    await advance(10 * 60_000);
    expect(tiles.fetchCopyright).toHaveBeenCalledTimes(6);
  });

  it("as tentativas do viewport param no unmount", async () => {
    const { unmount } = await mountReady();
    tiles.fetchCopyright.mockRejectedValue(new TypeError("Failed to fetch"));
    await act(async () => ml.handlers.get("load")?.());
    await advance(5_000);
    expect(tiles.fetchCopyright).toHaveBeenCalledTimes(2);
    unmount();
    await advance(10 * 60_000);
    expect(tiles.fetchCopyright).toHaveBeenCalledTimes(2);
  });

  it("load sem 429: onLoaded avisa (o LiveScreen zera o backoff da cota); depois de um 429, não", async () => {
    const onLoaded = vi.fn();
    tiles.getSession.mockResolvedValueOnce({ session: "s1", expiry: Date.now() + 14 * DAY });
    render(<MapView tiles={CONFIG} store={null} views={[]} selectedId={null} stops={[]} onSelect={() => undefined} onFailed={() => undefined} onLoaded={onLoaded} />);
    await flush();
    await act(async () => ml.handlers.get("load")?.());
    expect(onLoaded).toHaveBeenCalledTimes(1);
    await tileError(429, "s1");
    await act(async () => ml.handlers.get("load")?.());
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it("copyright que falha mantém o texto anterior e não derruba o mapa", async () => {
    const { onFailed } = await mountReady();
    await act(async () => ml.handlers.get("load")?.());
    expect(screen.getByText("Dados do mapa ©2026 Google")).toBeInTheDocument();
    tiles.fetchCopyright.mockRejectedValueOnce(new Error("403"));
    await act(async () => ml.handlers.get("moveend")?.());
    await advance(500);
    expect(screen.getByText("Dados do mapa ©2026 Google")).toBeInTheDocument();
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("copyright usa a sessão renovada depois do setTiles", async () => {
    await mountReady(3 * HOUR);
    tiles.getSession.mockResolvedValueOnce({ session: "s2", expiry: Date.now() + 14 * DAY });
    await advance(3 * HOUR - SESSION_MARGIN_MS);
    await act(async () => ml.handlers.get("moveend")?.());
    await advance(500);
    expect((tiles.fetchCopyright.mock.calls.at(-1)![1] as TileSession).session).toBe("s2");
  });

  it("antes da sessão não há logo nem copyright (o mapa ainda não existe)", () => {
    tiles.getSession.mockReturnValueOnce(deferred().promise);
    mount();
    expect(screen.queryByRole("img", { name: "Google Maps" })).not.toBeInTheDocument();
  });
});

describe("copyright que não cabe (tela estreita): botão \"Fontes de dados\" e popover", () => {
  const LONG = "Dados do mapa ©2026 Google, INEGI, Imagens ©2026 TerraMetrics, Airbus, CNES / Airbus, Landsat / Copernicus, Maxar Technologies";
  let width = { scroll: 0, client: 0 };
  beforeEach(() => {
    width = { scroll: 0, client: 0 };
    // O jsdom não faz layout: a largura medida e o ResizeObserver são de mentira (o observer avisa ao observar).
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => width.scroll);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width.client);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly callback: () => void) {}
        observe() {
          this.callback();
        }
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mountWithCopyright(text: string) {
    tiles.fetchCopyright.mockResolvedValue(text);
    const view = await mountReady();
    await act(async () => ml.handlers.get("load")?.());
    await flush();
    return view;
  }

  it("cabe: o texto aparece na linha, sem botão", async () => {
    width = { scroll: 200, client: 280 };
    await mountWithCopyright("Dados do mapa ©2026 Google");
    expect(screen.getByText("Dados do mapa ©2026 Google")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Fontes de dados" })).not.toBeInTheDocument();
  });

  it("não cabe: a linha some (medida, mas invisível) e o botão abre o texto completo; Esc fecha e devolve o foco", async () => {
    width = { scroll: 640, client: 280 };
    await mountWithCopyright(LONG);
    const button = screen.getByRole("button", { name: "Fontes de dados" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    // Fechado, sem aria-controls (não aponta para um elemento que não existe).
    expect(button).not.toHaveAttribute("aria-controls");
    expect(screen.getByText(LONG).closest("p")).toHaveStyle({ visibility: "hidden" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const popover = document.getElementById(button.getAttribute("aria-controls")!);
    expect(popover).toHaveTextContent(LONG);
    expect(popover).toHaveClass("map-google-popover");
    // Clique dentro do popover não fecha.
    fireEvent.pointerDown(popover!);
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("aria-controls");
    expect(document.querySelector(".map-google-popover")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("clique fora fecha o popover; o botão alterna", async () => {
    width = { scroll: 640, client: 280 };
    await mountWithCopyright(LONG);
    const button = screen.getByRole("button", { name: "Fontes de dados" });
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("aberto, conta como overlay (os atalhos de uma letra não disparam)", async () => {
    const { isOverlayOpen } = await import("@/ui/overlays");
    width = { scroll: 640, client: 280 };
    await mountWithCopyright(LONG);
    fireEvent.click(screen.getByRole("button", { name: "Fontes de dados" }));
    expect(isOverlayOpen()).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(isOverlayOpen()).toBe(false);
  });
});
