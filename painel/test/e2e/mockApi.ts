import http from "node:http";
import { MockDeliveries } from "./mockDeliveries";
import { MockServices } from "./mockServices";
import { MockSettlements } from "./mockSettlements";
import { MockTeam } from "./mockTeam";

/**
 * API de dev mockada (DN-12) como um servidor HTTP de verdade na 8790, e não `page.route`: o
 * Chromium manda o preflight de CORS (header `X-Motoka-Client`, `Authorization`) direto para a
 * rede, sem passar pelo `route` do Playwright, e o `Set-Cookie` precisa ser gravado pelo navegador
 * como numa resposta real. O build do E2E aponta `NEXT_PUBLIC_API_URL` para cá.
 *
 * Modela a rotação do cookie de refresh (N2-2): cada W2 bem-sucedido grava um valor novo, e um
 * valor já rotacionado recebe 401 `AUTH_REFRESH_REUSED`. O `sub` da renovação vem do **valor do
 * cookie recebido**, não de um contador: assim o teste de troca de conta prova que o cookie
 * compartilhado foi sobrescrito.
 */
export const MOCK_PORT = 8790;
export const API = `http://localhost:${MOCK_PORT}`;
export const ORIGIN = "http://localhost:8787";
export const COOKIE = "mk_rt";

export const STORES = {
  "11222333000181": { sub: "5b6acbe2-9c52-4a61-945b-9aae70c59fdc", name: "Padaria Teste LTDA", street: "Praça da Sé" },
  "99888777000166": { sub: "0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0", name: "Pizzaria do Zé", street: "Rua das Flores" },
} as const;
export type StoreDoc = keyof typeof STORES;

const PASSWORD = "NovaSenha@1";

export interface Interval {
  readonly start: number;
  readonly end: number;
  readonly status: number;
  readonly code: string | null;
}

export interface InviteReply {
  readonly status: number;
  readonly body: unknown;
}

function token(sub: string, id: number): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const claims = { sub, type: "access", roles: ["establishment"], exp: Math.floor(Date.now() / 1000) + 900, jti: id };
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.mock`;
}

const LIVE_DRIVER = "a1111111-1111-4111-8111-111111111111";

export class MockApi {
  team = new MockTeam();
  deliveries = new MockDeliveries();
  settlements = new MockSettlements();
  services = new MockServices();
  refreshes: Interval[] = [];
  logoutCalls = 0;
  loginCalls = 0;
  /** Tokens com id ≤ este valor recebem 401 em `/web/capabilities` (força o refresh no meio da sessão). */
  staleUpTo = 0;
  /** Próximo W2 responde este erro (uma vez). */
  nextRefreshError: { status: number; code: string } | null = null;
  /** Derruba a conexão do W2 (sem resposta HTTP). */
  refreshOffline = false;
  refreshLatencyMs = 0;
  capabilities: Record<string, boolean> = { teams: true, deliveries: true, tracking: false };
  /** Resposta do preview do convite; `null` derruba a conexão. */
  invite: InviteReply | null = { status: 404, body: { error_code: "TEAM_INVITE_NOT_FOUND", detail: "x" } };
  liveStatus = 200;
  streamStatus = 200;
  /** `true`: o stream abre mas não manda `position` (o pin envelhece pelo relógio do cliente). */
  streamSilent = false;
  liveStreams = 0;
  /** Quando o motoboy do mapa mandou o último ponto no snapshot (ms atrás). */
  livePositionAgeMs = 5000;

  liveSnapshot() {
    const now = Date.now();
    return {
      server_time: new Date(now).toISOString(),
      no_signal_after_seconds: 180,
      at_store_radius_m: 60,
      establishment: { id: "5b6acbe2-9c52-4a61-945b-9aae70c59fdc", name: "Padaria Teste", location: { lat: -25.43, lng: -49.27 } },
      counts: { on_shift: 1, delivering: 1, returning: 0, at_store: 0, no_signal: 0, not_started: 0, done_today: { deliveries: 3, returns: 0 } },
      drivers: [
        {
          driver: { id: LIVE_DRIVER, full_name: "Diego Ramos", short_name: "Diego R.", initials: "DR", phone: "5541999990077" },
          membership_id: "11111111-1111-4111-8111-111111111111",
          shift: { shift_id: "s1", occurrence_date: "2026-10-05", starts_at: new Date(now - 3600_000).toISOString(), ends_at: new Date(now + 3600_000).toISOString() },
          session: { id: "x1", started_at: new Date(now - 3600_000).toISOString() },
          state: "delivering",
          position: { lat: -25.43, lng: -49.27, accuracy_m: 6, heading: 90, speed_mps: 6, recorded_at: new Date(now - this.livePositionAgeMs).toISOString() },
          done_today: { deliveries: 3, returns: 0 },
          last_delivered_at: null,
          current: { delivery_id: "e1", number: 184, status: "on_the_way" },
          stops: [{ delivery_id: "e1", number: 184, origin: "manual", status: "on_the_way", destination: { lat: -25.44, lng: -49.26 }, customer: { name: "Marina Souza", address_line: "Rua Itupava, 1120" } }],
        },
      ],
    };
  }

  /** Corpo do P1 (e do `snapshot` do P2) do link público do cliente. */
  publicDelivery: Record<string, unknown> = {
    number: 184,
    stage: "on_the_way",
    establishment: { name: "Padaria Teste", location: null },
    driver: { first_name: "Diego" },
    destination: null,
    code: "4821",
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    driver_position: null,
    signal: "none",
    poll_after_seconds: 15,
  };
  publicRequests: Array<{ url: string; referer: string | undefined; cookie: string | undefined }> = [];
  inviteRequests: Array<{ url: string; referer: string | undefined; cookie: string | undefined }> = [];

  private tokenCounter = 0;
  private cookieCounter = 0;
  private cookies = new Map<string, { sub: string; used: boolean }>();
  private tokens = new Map<string, number>();
  private server: http.Server | null = null;

  get tokensIssued(): number {
    return this.tokenCounter;
  }

  reset(): void {
    this.refreshes = [];
    this.logoutCalls = 0;
    this.loginCalls = 0;
    this.staleUpTo = 0;
    this.nextRefreshError = null;
    this.refreshOffline = false;
    this.refreshLatencyMs = 0;
    this.capabilities = { teams: true, deliveries: true, tracking: false };
    this.invite = { status: 404, body: { error_code: "TEAM_INVITE_NOT_FOUND", detail: "x" } };
    this.inviteRequests = [];
    this.publicRequests = [];
    this.liveStatus = 200;
    this.streamStatus = 200;
    this.streamSilent = false;
    this.livePositionAgeMs = 5000;
    this.liveStreams = 0;
    this.team = new MockTeam();
    this.deliveries = new MockDeliveries();
    this.settlements = new MockSettlements();
    this.services = new MockServices();
    this.cookies = new Map();
    this.tokens = new Map();
  }

  start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((error: unknown) => {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(String(error));
      });
    });
    return new Promise((resolve) => this.server!.listen(MOCK_PORT, "localhost", resolve));
  }

  stop(): Promise<void> {
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  /** Algum par de W2 se sobrepôs no tempo? */
  overlapping(): boolean {
    const sorted = [...this.refreshes].sort((a, b) => a.start - b.start);
    return sorted.some((interval, i) => i > 0 && interval.start < sorted[i - 1]!.end);
  }

  private issue(sub: string): { access: string; cookie: string } {
    this.tokenCounter += 1;
    this.cookieCounter += 1;
    const access = token(sub, this.tokenCounter);
    this.tokens.set(access, this.tokenCounter);
    const cookie = `rt-${this.cookieCounter}-${sub.slice(0, 8)}`;
    this.cookies.set(cookie, { sub, used: false });
    return { access, cookie };
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", API);
    const path = url.pathname.replace(/^\/v1/, "");
    const origin = req.headers.origin;
    const auth = path.startsWith("/web/auth/");
    const publicInvite = path.startsWith("/teams/invites/");
    const publicDelivery = path.startsWith("/public/deliveries/");
    if (path === "/style.json") {
      const headers = { "Content-Type": "application/json", ...(origin === ORIGIN ? { "Access-Control-Allow-Origin": ORIGIN } : {}) };
      res.writeHead(200, headers);
      res.end(JSON.stringify({ version: 8, name: "vazio", sources: {}, layers: [{ id: "fundo", type: "background", paint: { "background-color": "#161a22" } }] }));
      return;
    }
    // Como a API: credenciada só para a origem do painel; o convite é público.
    const cors: Record<string, string> = {
      ...(origin === ORIGIN ? { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Credentials": "true" } : {}),
      ...((publicInvite || publicDelivery) && origin ? { "Access-Control-Allow-Origin": origin } : {}),
      "Access-Control-Expose-Headers": "Retry-After",
      Vary: "Origin",
    };
    const send = (status: number, body: unknown, extra: Record<string, string | string[]> = {}) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors, ...extra });
      res.end(body === undefined ? undefined : JSON.stringify(body));
    };
    const readBody = () =>
      new Promise<string>((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(data));
      });
    const setCookie = (value: string, maxAge = 86_400) =>
      `${COOKIE}=${value}; Path=/v1/web/auth; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
    const sentCookie = () => /(?:^|;\s*)mk_rt=([^;]+)/.exec(req.headers.cookie ?? "")?.[1] ?? null;

    if (req.method === "OPTIONS") {
      res.writeHead(200, {
        ...cors,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, x-motoka-client, accept",
        "Access-Control-Max-Age": "0",
      });
      res.end();
      return;
    }

    if (publicDelivery) {
      const [token = "", tail] = path.slice("/public/deliveries/".length).split("/");
      this.publicRequests.push({ url: req.url ?? "", referer: req.headers.referer, cookie: req.headers.cookie });
      const headers = { "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };
      if (token.startsWith("gone")) return send(410, { error_code: "DELIVERY_TRACKING_EXPIRED", detail: "x" }, headers);
      if (token.startsWith("none")) return send(404, { error_code: "DELIVERY_TRACKING_NOT_FOUND", detail: "x" }, headers);
      const body = { ...this.publicDelivery, updated_at: new Date().toISOString() };
      if (tail === "stream") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", ...cors, ...headers });
        const sse = (event: string, data: unknown) => res.write(`event: ${event}`+String.fromCharCode(10)+`data: ${JSON.stringify(data)}`+String.fromCharCode(10,10));
        sse("snapshot", body);
        sse("position", { lat: -25.43, lng: -49.27, recorded_at: new Date().toISOString() });
        req.on("close", () => res.end());
        return;
      }
      return send(200, body, headers);
    }

    if (publicInvite) {
      this.inviteRequests.push({ url: req.url ?? "", referer: req.headers.referer, cookie: req.headers.cookie });
      if (!this.invite) {
        req.socket.destroy();
        return;
      }
      return send(this.invite.status, this.invite.body);
    }

    if (auth && (req.headers["x-motoka-client"] !== "painel" || origin !== ORIGIN)) {
      return send(400, { error_code: "WEB_AUTH_ORIGIN_NOT_ALLOWED", detail: "x" });
    }

    if (path === "/web/auth/token") {
      this.loginCalls += 1;
      const form = new URLSearchParams(await readBody());
      if (form.has("device_token")) return send(500, { error_code: "TEST_DEVICE_TOKEN_SENT" });
      const store = STORES[(form.get("username") ?? "") as StoreDoc];
      if (!store || form.get("password") !== PASSWORD) {
        return send(401, { error_code: "LOGIN_INVALID_CREDENTIALS", detail: "x" });
      }
      const { access, cookie } = this.issue(store.sub);
      return send(200, { access_token: access, token_type: "bearer", expires_in: 900 }, { "Set-Cookie": setCookie(cookie) });
    }

    if (path === "/web/auth/refresh") {
      const start = Date.now();
      const sent = sentCookie();
      if (this.refreshLatencyMs) await new Promise((r) => setTimeout(r, this.refreshLatencyMs));
      if (this.refreshOffline) {
        this.refreshes.push({ start, end: Date.now(), status: 0, code: null });
        req.socket.destroy();
        return;
      }
      const fail = (status: number, code: string) => {
        this.refreshes.push({ start, end: Date.now(), status, code });
        return send(status, { error_code: code, detail: "x" }, status === 401 ? { "Set-Cookie": setCookie('""', 0) } : {});
      };
      if (this.nextRefreshError) {
        const { status, code } = this.nextRefreshError;
        this.nextRefreshError = null;
        return fail(status, code);
      }
      if (!sent) return fail(401, "AUTH_REFRESH_MISSING");
      const family = this.cookies.get(sent);
      if (!family) return fail(401, "AUTH_REFRESH_REVOKED");
      if (family.used) return fail(401, "AUTH_REFRESH_REUSED");
      family.used = true;
      const { access, cookie } = this.issue(family.sub);
      this.refreshes.push({ start, end: Date.now(), status: 200, code: null });
      return send(200, { access_token: access, token_type: "bearer", expires_in: 900 }, { "Set-Cookie": setCookie(cookie) });
    }

    if (path === "/web/auth/logout") {
      this.logoutCalls += 1;
      const sent = sentCookie();
      if (sent) this.cookies.delete(sent);
      res.writeHead(204, { ...cors, "Set-Cookie": setCookie('""', 0) });
      res.end();
      return;
    }

    // Rotas com Bearer.
    const bearer = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
    const id = this.tokens.get(bearer);
    if (!id) return send(401, { error_code: "AUTH_TOKEN_INVALID", detail: "x" });
    const sub = JSON.parse(Buffer.from(bearer.split(".")[1]!, "base64url").toString()).sub as string;

    if (path === "/tracking/live") {
      if (this.liveStatus !== 200) return send(this.liveStatus, { error_code: "RATE_LIMIT_EXCEEDED", detail: "x" }, { "Retry-After": "1" });
      return send(200, this.liveSnapshot());
    }

    if (path === "/tracking/live/stream") {
      if (this.streamStatus !== 200) return send(this.streamStatus, { error_code: this.streamStatus === 429 ? "RATE_LIMIT_EXCEEDED" : "TRACKING_STREAM_UNAVAILABLE", detail: "x" });
      this.liveStreams += 1;
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", ...cors });
      const sse = (event: string, data: unknown) => res.write(`event: ${event}` + String.fromCharCode(10) + `data: ${JSON.stringify(data)}` + String.fromCharCode(10, 10));
      sse("snapshot", this.liveSnapshot());
      const timer = setInterval(() => {
        if (this.streamSilent) return;
        sse("position", { driver_id: LIVE_DRIVER, lat: -25.43 + Math.random() * 0.005, lng: -49.27, accuracy_m: 6, heading: 90, speed_mps: 6, recorded_at: new Date().toISOString(), state: "delivering" });
      }, 1000);
      req.on("close", () => {
        clearInterval(timer);
        this.liveStreams -= 1;
        res.end();
      });
      return;
    }

    if (path === "/web/capabilities") {
      if (id <= this.staleUpTo) return send(401, { error_code: "AUTH_TOKEN_EXPIRED", detail: "x" });
      return send(200, this.capabilities);
    }

    const servicesPath =
      path.endsWith("/remind-location") || path === "/orders" || path.startsWith("/orders/") || path === "/notifications" || path.startsWith("/notifications/") || (path.startsWith("/users/") && (path.split("/").length > 3 || req.method !== "GET"));
    if (servicesPath) {
      const raw = req.method === "GET" || req.method === "DELETE" ? "" : await readBody();
      const json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const result = this.services.route(path, req.method ?? "GET", url.searchParams, json);
      if (result) return send(result[0], result[0] === 204 ? undefined : result[1]);
    }

    const userMatch = /^\/users\/([^/]+)$/.exec(path);
    if (userMatch) {
      const entry = Object.entries(STORES).find(([, s]) => s.sub === userMatch[1]);
      if (!entry || entry[1].sub !== sub) return send(403, { error_code: "FORBIDDEN", detail: "x" });
      const [doc, data] = entry;
      return send(200, {
        id: data.sub,
        full_name: data.name,
        type: "establishment",
        email: "loja@motoka.com",
        phone: "11977776666",
        document_number: doc,
        corporate_reason: data.name,
        address: { street: data.street, number: 200, neighborhood: "Centro", city: "Curitiba", state: "PR" },
      });
    }

    if (path === "/teams/me/settlements" || path.startsWith("/teams/me/settlements/")) {
      const raw = req.method === "GET" || req.method === "DELETE" ? "" : await readBody();
      const json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const result = this.settlements.route(path.slice("/teams/me/settlements".length), req.method ?? "GET", url.searchParams, json);
      if (result) return send(result[0], result[1]);
    }

    if (path.startsWith("/teams/me/")) {
      const raw = req.method === "GET" || req.method === "DELETE" ? "" : await readBody();
      const json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const result = this.team.route(path.slice("/teams/me/".length), req.method ?? "GET", url.searchParams.get("week_start"), json);
      if (result) return send(result[0], result[1]);
    }

    if (path === "/deliveries" || path.startsWith("/deliveries/")) {
      const raw = req.method === "GET" || req.method === "DELETE" ? "" : await readBody();
      const json = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const result = this.deliveries.route(path.slice("/deliveries".length), req.method ?? "GET", url.searchParams, json);
      if (result) return send(result[0], result[1]);
    }

    return send(404, { error_code: "ROUTE_NOT_FOUND", detail: "x" });
  }
}
