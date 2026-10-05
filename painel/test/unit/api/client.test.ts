import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createApiClient, type SessionPort } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { RefreshOutcome } from "@/lib/session/refresher";

const API = "http://api.test/v1";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function fakeSession(outcomes: RefreshOutcome[] = []) {
  let token: string | null = "old";
  const session: SessionPort & { refreshes: number; expired: Array<string | null> } = {
    refreshes: 0,
    expired: [],
    getAccessToken: () => token,
    refreshForRetry: vi.fn(async () => {
      session.refreshes += 1;
      const outcome = outcomes.shift() ?? { kind: "rejected", code: null };
      if (outcome.kind === "renewed") token = outcome.accessToken;
      return outcome;
    }),
    expire: (code) => {
      session.expired.push(code);
      token = null;
    },
  };
  return session;
}

const renewed = (accessToken = "new"): RefreshOutcome => ({
  kind: "renewed",
  accessToken,
  claims: { sub: "s", exp: null, roles: ["establishment"] },
});

describe("apiFetch", () => {
  it("manda Bearer e nunca credenciais nem o header do painel", async () => {
    let seen: Request | undefined;
    server.use(
      http.get(`${API}/web/capabilities`, ({ request }) => {
        seen = request;
        return HttpResponse.json({ teams: true });
      }),
    );
    const apiFetch = createApiClient(fakeSession());
    expect(await apiFetch("/web/capabilities")).toEqual({ teams: true });
    expect(seen!.headers.get("Authorization")).toBe("Bearer old");
    expect(seen!.headers.get("X-Motoka-Client")).toBeNull();
    expect(seen!.credentials).toBe("omit");
  });

  it("401 de token → refresh → uma repetição com o token novo", async () => {
    const auths: string[] = [];
    server.use(
      http.get(`${API}/x`, ({ request }) => {
        auths.push(request.headers.get("Authorization") ?? "");
        return auths.length === 1
          ? HttpResponse.json({ error_code: "AUTH_TOKEN_EXPIRED" }, { status: 401 })
          : HttpResponse.json({ ok: 1 });
      }),
    );
    const session = fakeSession([renewed()]);
    expect(await createApiClient(session)("/x")).toEqual({ ok: 1 });
    expect(auths).toEqual(["Bearer old", "Bearer new"]);
    expect(session.expired).toEqual([]);
  });

  it("um segundo 401 encerra a sessão", async () => {
    server.use(http.get(`${API}/x`, () => HttpResponse.json({ error_code: "AUTH_TOKEN_INVALID" }, { status: 401 })));
    const session = fakeSession([renewed()]);
    await expect(createApiClient(session)("/x")).rejects.toMatchObject({ status: 401 });
    expect(session.expired).toEqual(["AUTH_TOKEN_INVALID"]);
    expect(session.refreshes).toBe(1);
  });

  it("refresh recusado encerra com o código do W2", async () => {
    server.use(http.get(`${API}/x`, () => HttpResponse.json({ error_code: "AUTH_TOKEN_EXPIRED" }, { status: 401 })));
    const session = fakeSession([{ kind: "rejected", code: "AUTH_REFRESH_REUSED" }]);
    await expect(createApiClient(session)("/x")).rejects.toBeInstanceOf(ApiError);
    expect(session.expired).toEqual(["AUTH_REFRESH_REUSED"]);
  });

  it("refresh indisponível não desloga e vira falta de conexão", async () => {
    server.use(http.get(`${API}/x`, () => HttpResponse.json({ error_code: "AUTH_TOKEN_EXPIRED" }, { status: 401 })));
    const session = fakeSession([{ kind: "unavailable" }]);
    await expect(createApiClient(session)("/x")).rejects.toMatchObject({ status: null });
    expect(session.expired).toEqual([]);
  });

  it("401 sem código (header ausente) também tenta o refresh", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/x`, () => {
        calls += 1;
        return calls === 1 ? HttpResponse.json({ detail: "Not authenticated" }, { status: 401 }) : HttpResponse.json(1);
      }),
    );
    expect(await createApiClient(fakeSession([renewed()]))("/x")).toBe(1);
  });

  it.each([403, 404, 429, 500])("%s não chama o refresh nem desloga", async (status) => {
    server.use(http.get(`${API}/x`, () => HttpResponse.json({ error_code: "QUALQUER" }, { status })));
    const session = fakeSession();
    await expect(createApiClient(session)("/x")).rejects.toMatchObject({ status });
    expect(session.refreshes).toBe(0);
    expect(session.expired).toEqual([]);
  });

  it("rede vira ApiError sem status", async () => {
    server.use(http.get(`${API}/x`, () => HttpResponse.error()));
    await expect(createApiClient(fakeSession())("/x")).rejects.toMatchObject({ status: null });
  });

  it("timeout vira ApiError marcado", async () => {
    server.use(
      http.get(`${API}/x`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(1);
      }),
    );
    await expect(createApiClient(fakeSession())("/x", { timeoutMs: 20 })).rejects.toMatchObject({
      status: null,
      timedOut: true,
    });
  });

  it("monta query e corpo JSON; recusa caminho fora da API", async () => {
    let seen: Request | undefined;
    server.use(
      http.post(`${API}/y`, async ({ request }) => {
        seen = request;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const apiFetch = createApiClient(fakeSession());
    await apiFetch("/y", { method: "POST", body: { a: 1 }, query: { scope: "open", vazio: null } });
    expect(new URL(seen!.url).search).toBe("?scope=open");
    expect(await seen!.json()).toEqual({ a: 1 });
    await expect(apiFetch("//evil.com/x")).rejects.toThrow();
    await expect(apiFetch("/a/../b")).rejects.toThrow();
  });

  it("sem sessão não chama a rede", async () => {
    const session = fakeSession();
    session.expire(null);
    await expect(createApiClient(session)("/x")).rejects.toMatchObject({ status: 401 });
  });
});
