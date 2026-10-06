import { createParser } from "eventsource-parser";

/**
 * Cliente do stream L2 do mapa ao vivo (WS-10 §6, WN-3). `fetch` com `Authorization` (o `EventSource`
 * não manda header) lido por `eventsource-parser`, com:
 * - watchdog: 45 s sem nenhum byte (inclusive `: hb`) aborta e reconecta; a pílula nunca fica verde com
 *   conexão morta (15 s para o cabeçalho na conexão);
 * - geração por conexão: `reauth`, fim de vida, watchdog e erro só reconectam se a geração ainda é a atual;
 * - token: renovado antes de conectar se faltar menos de 300 s (`getToken`); `reauth` e o fim natural
 *   (`min(exp, 900 s)`) renovam e reconectam sem contar como falha; 401 `AUTH_TOKEN_EXPIRING` renova uma vez;
 * - backoff 1 s ×2 até 30 s com jitter de ±25 %, zerado depois de 30 s em `streaming`;
 * - fallback: 429, 503, 404 `ROUTE_NOT_FOUND` ou 3 falhas em 60 s → polling do L1 a cada 10 s (jitter ±20 %,
 *   backoff 10→60 s em erro), com uma tentativa de voltar ao stream a cada 60 s;
 * - aba oculta por mais de 20 s fecha o stream (`paused`); ao voltar, reconecta e o `snapshot` substitui o estado.
 * Tudo injetável (`fetch`, `random`, relógio via timers globais) para o teste com `vi.useFakeTimers`.
 */

export type StreamStatus = "idle" | "connecting" | "streaming" | "reconnecting" | "polling" | "paused" | "offline";

export const WATCHDOG_MS = 45_000;
export const CONNECT_TIMEOUT_MS = 15_000;
export const HIDDEN_CLOSE_MS = 20_000;
export const POLL_BASE_MS = 10_000;
export const POLL_MAX_MS = 60_000;
export const RETRY_STREAM_MS = 60_000;
export const STABLE_AFTER_MS = 30_000;
export const MAX_EVENT_BYTES = 1024 * 1024;
/** Um stream que fecha antes disto, sem `reauth`, não é fim de vida (`min(exp, 900 s)`): é falha, com backoff. */
export const MIN_NATURAL_END_MS = 30_000;

export interface LiveStreamDeps {
  readonly url: string;
  readonly fetch: typeof fetch;
  /** Token com pelo menos 300 s de vida, renovando se preciso. `null`: a sessão acabou. */
  readonly getToken: () => Promise<string | null>;
  /** Renova a sessão agora (reauth, 401 `AUTH_TOKEN_EXPIRING`). `false`: não deu. */
  readonly renew: () => Promise<boolean>;
  /** Releitura do L1 (polling). Lança em erro; um `ApiError` 429/5xx pede backoff. */
  readonly poll: () => Promise<void>;
  readonly onEvent: (name: string, data: unknown) => void;
  readonly onStatus: (status: StreamStatus) => void;
  readonly random?: () => number;
}

const EVENTS = new Set(["snapshot", "position", "delivery", "session", "resync", "reauth"]);

const jitter = (ms: number, spread: number, random: () => number): number => Math.round(ms * (1 + (random() * 2 - 1) * spread));

export class LiveStream {
  private readonly deps: LiveStreamDeps;
  private readonly random: () => number;
  private gen = 0;
  private attached = false;
  private hidden = false;
  private status: StreamStatus = "idle";
  private controller: AbortController | null = null;
  private watchdog: ReturnType<typeof setTimeout> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stableTimer: ReturnType<typeof setTimeout> | undefined;
  private hiddenTimer: ReturnType<typeof setTimeout> | undefined;
  private retryStreamTimer: ReturnType<typeof setTimeout> | undefined;
  private failures: number[] = [];
  private backoffStep = 0;
  private pollFailures = 0;
  private renewedForExpiring = false;
  private badJson = 0;

  constructor(deps: LiveStreamDeps) {
    this.deps = deps;
    this.random = deps.random ?? Math.random;
  }

  /** Abre o transporte (a tela entrou em `/ao-vivo/`). */
  attach(): void {
    if (this.attached) return;
    this.attached = true;
    if (this.hidden) this.setStatus("paused");
    else void this.connect();
  }

  /** Fecha tudo e libera a vaga do servidor (a tela saiu de `/ao-vivo/`, ou logout). */
  detach(): void {
    this.attached = false;
    this.teardown();
    this.setStatus("idle");
  }

  setHidden(hidden: boolean): void {
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (!this.attached) return;
    if (hidden) {
      clearTimeout(this.hiddenTimer);
      this.hiddenTimer = setTimeout(() => {
        this.teardown();
        this.setStatus("paused");
      }, HIDDEN_CLOSE_MS);
      return;
    }
    clearTimeout(this.hiddenTimer);
    // Voltou à aba: se não há transporte vivo (pausa, ou uma falha que ocorreu com a aba oculta), reconecta.
    if (this.status !== "streaming" && this.status !== "connecting" && this.status !== "polling") void this.connect();
  }

  get current(): StreamStatus {
    return this.status;
  }

  private setStatus(status: StreamStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.deps.onStatus(status);
  }

  private teardown(): void {
    this.gen += 1;
    this.controller?.abort();
    this.controller = null;
    for (const timer of [this.watchdog, this.timer, this.stableTimer, this.hiddenTimer, this.retryStreamTimer]) clearTimeout(timer);
  }

  private armWatchdog(gen: number): void {
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      if (gen !== this.gen) return;
      // Sem byte nenhum por 45 s: a conexão morreu. Aborta, avisa e reconecta com backoff.
      this.controller?.abort();
      this.setStatus("reconnecting");
      this.fail(gen);
    }, WATCHDOG_MS);
  }

  private async connect(renewFirst = false): Promise<void> {
    if (!this.attached) return;
    if (this.hidden) {
      // Aba oculta: não conecta, mas também não morre calado; `setHidden(false)` reconecta.
      this.teardown();
      this.setStatus("paused");
      return;
    }
    this.teardown();
    const gen = this.gen;
    this.setStatus(this.status === "streaming" ? "reconnecting" : "connecting");
    if (renewFirst) await this.deps.renew().catch(() => false);
    if (gen !== this.gen) return;
    const token = await this.deps.getToken().catch(() => null);
    if (gen !== this.gen) return;
    if (!token) {
      // Sessão acabou: o shell leva ao login; não há o que reconectar.
      this.setStatus("offline");
      return;
    }

    const controller = new AbortController();
    this.controller = controller;
    const headersTimer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    this.armWatchdog(gen);
    let response: Response;
    try {
      response = await this.deps.fetch(this.deps.url, {
        headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` },
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
    } catch {
      clearTimeout(headersTimer);
      if (gen === this.gen) this.fail(gen);
      return;
    }
    clearTimeout(headersTimer);
    if (gen !== this.gen) return;

    if (!response.ok) {
      clearTimeout(this.watchdog);
      await this.onHttpError(gen, response);
      return;
    }
    await this.read(gen, response);
  }

  private async onHttpError(gen: number, response: Response): Promise<void> {
    let code: string | null = null;
    try {
      const body: unknown = await response.json();
      const raw = (body as { error_code?: unknown } | null)?.error_code;
      if (typeof raw === "string") code = raw;
    } catch {
      /* sem envelope */
    }
    if (gen !== this.gen) return;
    if (response.status === 401 && code === "AUTH_TOKEN_EXPIRING" && !this.renewedForExpiring) {
      this.renewedForExpiring = true;
      void this.connect(true);
      return;
    }
    if (response.status === 403) {
      // Sem permissão não muda com o tempo: não fica reconectando.
      this.setStatus("offline");
      return;
    }
    if (response.status === 429 || response.status === 503 || (response.status === 404 && code === "ROUTE_NOT_FOUND")) {
      this.startPolling();
      return;
    }
    this.fail(gen);
  }

  private async read(gen: number, response: Response): Promise<void> {
    const body = response.body;
    if (!body) return this.fail(gen);
    this.renewedForExpiring = false;
    this.badJson = 0;
    const openedAt = Date.now();
    this.setStatus("streaming");
    clearTimeout(this.stableTimer);
    this.stableTimer = setTimeout(() => {
      if (gen === this.gen) {
        this.backoffStep = 0;
        this.failures = [];
      }
    }, STABLE_AFTER_MS);

    const decoder = new TextDecoder();
    const parser = createParser({
      maxBufferSize: MAX_EVENT_BYTES,
      onError: () => {
        if (gen === this.gen) this.fail(gen);
      },
      onEvent: (message) => {
        const name = message.event ?? "message";
        if (!EVENTS.has(name) || gen !== this.gen) return;
        if (name === "reauth") {
          // Renova e reconecta mantendo o último estado até o `snapshot` novo; não conta como falha.
          void this.connect(true);
          return;
        }
        let data: unknown = null;
        if (name !== "resync") {
          try {
            data = JSON.parse(message.data);
            this.badJson = 0;
          } catch {
            this.badJson += 1;
            if (this.badJson > 3) this.fail(gen);
            return;
          }
        }
        this.deps.onEvent(name, data);
      },
    });

    const reader = body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (gen !== this.gen) return;
        if (done) break;
        this.armWatchdog(gen);
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch {
      if (gen === this.gen) this.fail(gen);
      return;
    }
    if (gen !== this.gen) return;
    clearTimeout(this.watchdog);
    // Fim natural (`min(exp, 900 s)`): renova e reconecta, sem backoff. Mas um 200 que fecha logo (proxy, corte
    // da borda) é falha: com backoff e sem rotacionar o refresh em laço.
    if (Date.now() - openedAt < MIN_NATURAL_END_MS) return this.fail(gen);
    void this.connect(true);
  }

  private fail(gen: number): void {
    if (gen !== this.gen || !this.attached) return;
    this.controller?.abort();
    clearTimeout(this.watchdog);
    const now = Date.now();
    this.failures = [...this.failures.filter((at) => now - at < 60_000), now];
    if (this.failures.length >= 3) {
      this.startPolling();
      return;
    }
    const delay = jitter(Math.min(30_000, 1_000 * 2 ** this.backoffStep), 0.25, this.random);
    this.backoffStep += 1;
    this.setStatus("reconnecting");
    this.gen += 1;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.connect(), delay);
  }

  private startPolling(): void {
    this.teardown();
    const gen = this.gen;
    this.failures = [];
    this.setStatus("polling");
    this.retryStreamTimer = setTimeout(() => {
      if (gen === this.gen) void this.connect();
    }, jitter(RETRY_STREAM_MS, 0.2, this.random));
    const tick = async () => {
      if (gen !== this.gen) return;
      try {
        await this.deps.poll();
        this.pollFailures = 0;
      } catch {
        this.pollFailures += 1;
      }
      if (gen !== this.gen) return;
      const base = this.pollFailures === 0 ? POLL_BASE_MS : Math.min(POLL_MAX_MS, POLL_BASE_MS * 2 ** this.pollFailures);
      this.timer = setTimeout(() => void tick(), jitter(base, 0.2, this.random));
    };
    void tick();
  }
}
