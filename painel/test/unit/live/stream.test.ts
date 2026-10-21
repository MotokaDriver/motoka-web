import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveStream, type LiveStreamDeps, type StreamStatus } from "@/features/live/stream";

interface Conn {
  readonly init: RequestInit;
  push: (text: string) => void;
  end: () => void;
  aborted: () => boolean;
}

/** Servidor falso: cada `fetch` vira uma conexão controlável (ou uma resposta de erro). */
function setup(over: Partial<LiveStreamDeps> = {}) {
  const conns: Conn[] = [];
  const statuses: StreamStatus[] = [];
  const events: Array<[string, unknown]> = [];
  const queue: Array<() => Promise<Response>> = [];
  const encoder = new TextEncoder();

  const open = (): (() => Promise<Response>) => () =>
    Promise.resolve(new Response(new ReadableStream<Uint8Array>({ start: () => undefined }), { status: 200 }));

  const deps: LiveStreamDeps = {
    url: "http://api.test/v1/tracking/live/stream",
    fetch: ((_url: string, init: RequestInit) => {
      let controller!: ReadableStreamDefaultController<Uint8Array>;
      let aborted = false;
      const stream = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
        },
      });
      init.signal?.addEventListener("abort", () => {
        aborted = true;
        try {
          controller.error(new DOMException("abort", "AbortError"));
        } catch {
          /* já fechado */
        }
      });
      conns.push({
        init,
        push: (text) => controller.enqueue(encoder.encode(text)),
        end: () => controller.close(),
        aborted: () => aborted,
      });
      const next = queue.shift();
      if (next) return next();
      return Promise.resolve(new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } }));
    }) as typeof fetch,
    getToken: vi.fn(async () => "tok"),
    renew: vi.fn(async () => true),
    poll: vi.fn(async () => undefined),
    onEvent: (name, data) => events.push([name, data]),
    onStatus: (s) => statuses.push(s),
    random: () => 0.5,
    ...over,
  };
  void open;
  const stream = new LiveStream(deps);
  return { stream, deps, conns, statuses, events, queue };
}

const sse = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const errorResponse = (status: number, code: string) => () =>
  Promise.resolve(new Response(JSON.stringify({ error_code: code, detail: "x" }), { status, headers: { "Content-Type": "application/json" } }));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("conexão e eventos", () => {
  it("manda Authorization sem credenciais, vira streaming e entrega os eventos (inclusive em pedaços e com heartbeat)", async () => {
    const { stream, conns, statuses, events } = setup();
    stream.attach();
    await tick(0);
    expect(conns).toHaveLength(1);
    expect(conns[0]?.init.headers).toMatchObject({ Accept: "text/event-stream", Authorization: "Bearer tok" });
    expect(conns[0]?.init.credentials).toBe("omit");
    expect(statuses).toEqual(["connecting", "streaming"]);
    conns[0]?.push(": hb\n\n");
    conns[0]?.push(sse("snapshot", { a: 1 }).slice(0, 12));
    conns[0]?.push(sse("snapshot", { a: 1 }).slice(12));
    conns[0]?.push(sse("position", { driver_id: "d1" }) + "event: resync\ndata: {}\r\n\r\n" + sse("desconhecido", {}));
    await tick(0);
    expect(events).toEqual([
      ["snapshot", { a: 1 }],
      ["position", { driver_id: "d1" }],
      ["resync", null],
    ]);
  });

  it("JSON inválido descarta o evento; mais de 3 seguidos reconecta", async () => {
    const { stream, conns, events } = setup();
    stream.attach();
    await tick(0);
    conns[0]?.push("event: position\ndata: {ruim\n\n".repeat(4));
    await tick(0);
    expect(events).toEqual([]);
    await tick(2000);
    expect(conns.length).toBeGreaterThanOrEqual(2);
  });
});

describe("watchdog", () => {
  it("45 s sem byte aborta, a pílula não fica verde e reconecta com backoff", async () => {
    const { stream, conns, statuses } = setup();
    stream.attach();
    await tick(0);
    expect(stream.current).toBe("streaming");
    await tick(44_000);
    expect(stream.current).toBe("streaming");
    await tick(1_100);
    expect(conns[0]?.aborted()).toBe(true);
    expect(stream.current).toBe("reconnecting");
    expect(statuses).toContain("reconnecting");
    await tick(1_300);
    expect(conns).toHaveLength(2);
    expect(stream.current).toBe("streaming");
  });

  it("qualquer byte, até o heartbeat, rearma o watchdog", async () => {
    const { stream, conns } = setup();
    stream.attach();
    await tick(0);
    for (let i = 0; i < 4; i++) {
      await tick(30_000);
      conns[0]?.push(": hb\n\n");
    }
    expect(conns).toHaveLength(1);
    expect(stream.current).toBe("streaming");
  });
});

describe("reauth e fim de vida", () => {
  it("reauth renova e reconecta na hora, sem backoff e sem duas conexões", async () => {
    const { stream, deps, conns } = setup();
    stream.attach();
    await tick(0);
    conns[0]?.push(sse("reauth", {}));
    await tick(0);
    expect(deps.renew).toHaveBeenCalledTimes(1);
    expect(conns).toHaveLength(2);
    expect(conns[0]?.aborted()).toBe(true);
    await tick(5_000);
    expect(conns).toHaveLength(2);
  });

  it("fim natural do stream (depois de 30 s) renova e reconecta", async () => {
    const { stream, deps, conns } = setup();
    stream.attach();
    await tick(0);
    conns[0]?.push(": hb" + String.fromCharCode(10, 10));
    await tick(35_000);
    conns[0]?.end();
    await tick(0);
    expect(deps.renew).toHaveBeenCalledTimes(1);
    expect(conns).toHaveLength(2);
  });

  it("200 que fecha logo não é fim de vida: backoff, sem renovar a sessão em laço", async () => {
    const { stream, deps, conns } = setup();
    stream.attach();
    await tick(0);
    conns[0]?.end();
    await tick(0);
    expect(deps.renew).not.toHaveBeenCalled();
    expect(conns).toHaveLength(1);
    await tick(1_400);
    expect(conns).toHaveLength(2);
    conns[1]?.end();
    await tick(0);
    await tick(2_600);
    expect(conns).toHaveLength(3);
    expect(deps.renew).not.toHaveBeenCalled();
  });

  it("401 AUTH_TOKEN_EXPIRING renova uma vez; de novo, backoff", async () => {
    const { stream, deps, conns, queue } = setup();
    queue.push(errorResponse(401, "AUTH_TOKEN_EXPIRING"), errorResponse(401, "AUTH_TOKEN_EXPIRING"));
    stream.attach();
    await tick(0);
    expect(deps.renew).toHaveBeenCalledTimes(1);
    expect(conns).toHaveLength(2);
    await tick(2_000);
    expect(deps.renew).toHaveBeenCalledTimes(1);
    expect(conns.length).toBeGreaterThanOrEqual(3);
  });

  it("403 não reconecta nem cai no polling", async () => {
    const { stream, conns, queue } = setup();
    queue.push(errorResponse(403, "FORBIDDEN"));
    stream.attach();
    await tick(60_000);
    expect(conns).toHaveLength(1);
    expect(stream.current).toBe("offline");
  });

  it("sem token (sessão acabou) não reconecta", async () => {
    const { stream, conns } = setup({ getToken: async () => null });
    stream.attach();
    await tick(10_000);
    expect(conns).toHaveLength(0);
    expect(stream.current).toBe("offline");
  });
});

describe("fallback para polling", () => {
  it("429 vai para o polling de 10 s com jitter e tenta voltar ao stream em 60 s", async () => {
    const { stream, deps, conns, queue } = setup();
    queue.push(errorResponse(429, "RATE_LIMIT_EXCEEDED"));
    stream.attach();
    await tick(0);
    expect(stream.current).toBe("polling");
    expect(deps.poll).toHaveBeenCalledTimes(1);
    await tick(10_500);
    expect(deps.poll).toHaveBeenCalledTimes(2);
    await tick(60_000);
    expect(conns.length).toBeGreaterThanOrEqual(2);
    expect(stream.current).toBe("streaming");
  });

  it("503 e 404 ROUTE_NOT_FOUND também", async () => {
    for (const [status, code] of [[503, "TRACKING_STREAM_UNAVAILABLE"], [404, "ROUTE_NOT_FOUND"]] as const) {
      const { stream, queue } = setup();
      queue.push(errorResponse(status, code));
      stream.attach();
      await tick(0);
      expect(stream.current).toBe("polling");
      stream.detach();
    }
  });

  it("3 falhas em 60 s caem no polling", async () => {
    const { stream, queue } = setup();
    queue.push(errorResponse(500, "X"), errorResponse(500, "X"), errorResponse(500, "X"));
    stream.attach();
    await tick(10_000);
    expect(stream.current).toBe("polling");
  });

  it("erro do L1 no polling faz backoff 10 → 20 → 40 → 60 s", async () => {
    const poll = vi.fn(async () => {
      throw new Error("429");
    });
    const { stream, queue } = setup({ poll });
    queue.push(errorResponse(429, "RATE_LIMIT_EXCEEDED"));
    stream.attach();
    await tick(0);
    expect(poll).toHaveBeenCalledTimes(1);
    await tick(15_000); // próximo em ~20 s
    expect(poll).toHaveBeenCalledTimes(1);
    await tick(10_000);
    expect(poll).toHaveBeenCalledTimes(2);
  });
});

describe("aba oculta e saída da tela", () => {
  it("oculta por mais de 20 s fecha (paused); ao voltar, reconecta", async () => {
    const { stream, conns } = setup();
    stream.attach();
    await tick(0);
    stream.setHidden(true);
    await tick(19_000);
    expect(conns[0]?.aborted()).toBe(false);
    await tick(1_500);
    expect(conns[0]?.aborted()).toBe(true);
    expect(stream.current).toBe("paused");
    stream.setHidden(false);
    await tick(0);
    expect(conns).toHaveLength(2);
    expect(stream.current).toBe("streaming");
  });

  it("B-1: falha com a aba oculta e volta antes de 20 s: reconecta sozinho", async () => {
    const { stream, conns, queue } = setup();
    queue.push(() => Promise.reject(new TypeError("offline")));
    stream.attach();
    await tick(0);
    expect(stream.current).toBe("reconnecting");
    stream.setHidden(true);
    await tick(1_600); // o timer do backoff dispara com a aba oculta
    expect(stream.current).toBe("paused");
    const before = conns.length;
    await tick(3_000);
    stream.setHidden(false); // voltou em menos de 20 s
    await tick(0);
    expect(conns.length).toBe(before + 1);
    expect(stream.current).toBe("streaming");
  });

  it("troca rápida de aba (menos de 20 s) não fecha", async () => {
    const { stream, conns } = setup();
    stream.attach();
    await tick(0);
    stream.setHidden(true);
    await tick(5_000);
    stream.setHidden(false);
    await tick(30_000);
    expect(conns).toHaveLength(1);
  });

  it("detach fecha a conexão e não deixa timer vivo", async () => {
    const { stream, conns } = setup();
    stream.attach();
    await tick(0);
    stream.detach();
    expect(conns[0]?.aborted()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(stream.current).toBe("idle");
  });
});

describe("backoff", () => {
  it("dobra de 1 s até o teto de 30 s com jitter, e zera depois de 30 s em streaming", async () => {
    const { stream, conns, queue } = setup();
    // Quatro falhas espaçadas por mais de 60 s não caem no polling: usa erro de rede.
    for (let i = 0; i < 2; i++) queue.push(() => Promise.reject(new TypeError("offline")));
    stream.attach();
    await tick(0);
    expect(conns).toHaveLength(1);
    await tick(1_100);
    expect(conns).toHaveLength(2);
    await tick(2_100);
    expect(conns).toHaveLength(3);
    expect(stream.current).toBe("streaming");
    await tick(31_000);
    conns[2]?.end();
    await tick(0);
    expect(conns).toHaveLength(4);
  });
});
