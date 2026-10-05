import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { SessionContractError, webAuthApi } from "@/lib/session/authApi";
import { classifyRefreshError, refreshSession } from "@/lib/session/refresher";
import { FakeAuthApi, establishmentToken, memoryLock } from "../helpers";

const API = "http://api.test/v1";
const seen: Request[] = [];
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  seen.length = 0;
});
afterAll(() => server.close());

function record(response: () => Response) {
  return async ({ request }: { request: Request }) => {
    seen.push(request.clone());
    return response();
  };
}

describe("webAuthApi (W1/W2/W3)", () => {
  it("as três chamadas mandam o header do painel, pedem credenciais e não mandam Bearer", async () => {
    const token = establishmentToken();
    server.use(
      http.post(`${API}/web/auth/token`, record(() => HttpResponse.json({ access_token: token, token_type: "bearer", expires_in: 900 }))),
      http.post(`${API}/web/auth/refresh`, record(() => HttpResponse.json({ access_token: token }))),
      http.post(`${API}/web/auth/logout`, record(() => new HttpResponse(null, { status: 204 }))),
    );
    await webAuthApi.login("11222333000181", "NovaSenha@1");
    await webAuthApi.refresh();
    await webAuthApi.logout();
    expect(seen).toHaveLength(3);
    for (const request of seen) {
      expect(request.headers.get("X-Motoka-Client")).toBe("painel");
      expect(request.headers.get("Authorization")).toBeNull();
      expect(request.credentials).toBe("include");
    }
  });

  it("o login é um form urlencoded sem device_token", async () => {
    server.use(http.post(`${API}/web/auth/token`, record(() => HttpResponse.json({ access_token: establishmentToken() }))));
    await webAuthApi.login("novaloja@motoka.com", "a&b=c");
    const request = seen[0]!;
    expect(request.headers.get("Content-Type")).toContain("application/x-www-form-urlencoded");
    const form = new URLSearchParams(await request.text());
    expect([...form.keys()].sort()).toEqual(["password", "username"]);
    expect(form.get("username")).toBe("novaloja@motoka.com");
    expect(form.get("password")).toBe("a&b=c");
  });

  it("refresh e logout vão sem corpo", async () => {
    server.use(
      http.post(`${API}/web/auth/refresh`, record(() => HttpResponse.json({ access_token: establishmentToken() }))),
      http.post(`${API}/web/auth/logout`, record(() => new HttpResponse(null, { status: 204 }))),
    );
    await webAuthApi.refresh();
    await webAuthApi.logout();
    expect(await seen[0]!.text()).toBe("");
    expect(await seen[1]!.text()).toBe("");
  });

  it("ignora um refresh_token no corpo e devolve só o access", async () => {
    const token = establishmentToken();
    server.use(http.post(`${API}/web/auth/refresh`, () => HttpResponse.json({ access_token: token, refresh_token: "nao" })));
    expect(await webAuthApi.refresh()).toEqual({ accessToken: token });
  });

  it("200 sem access_token é contrato quebrado", async () => {
    server.use(http.post(`${API}/web/auth/refresh`, () => HttpResponse.json({ token_type: "bearer" })));
    await expect(webAuthApi.refresh()).rejects.toBeInstanceOf(SessionContractError);
  });

  it("erro vira ApiError com o código, sem o detail", async () => {
    server.use(
      http.post(`${API}/web/auth/refresh`, () =>
        HttpResponse.json({ error_code: "AUTH_REFRESH_MISSING", detail: "Entre novamente para continuar." }, { status: 401 }),
      ),
    );
    const error = await webAuthApi.refresh().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("AUTH_REFRESH_MISSING");
    expect(JSON.stringify(error)).not.toContain("Entre novamente para continuar");
  });

  it("falha de rede vira ApiError sem status", async () => {
    server.use(http.post(`${API}/web/auth/refresh`, () => HttpResponse.error()));
    const error = await webAuthApi.refresh().catch((e: unknown) => e);
    expect((error as ApiError).status).toBeNull();
  });
});

describe("classificação do W2", () => {
  it.each(["AUTH_REFRESH_MISSING", "AUTH_REFRESH_REVOKED", "AUTH_REFRESH_REUSED", "AUTH_SESSION_EXPIRED"])(
    "401 %s é rejeitado e guarda o código",
    (code) => {
      expect(classifyRefreshError(new ApiError({ status: 401, code }))).toEqual({ kind: "rejected", code });
    },
  );

  it("400 WEB_AUTH_ORIGIN_NOT_ALLOWED é configuração", () => {
    expect(classifyRefreshError(new ApiError({ status: 400, code: "WEB_AUTH_ORIGIN_NOT_ALLOWED" }))).toEqual({
      kind: "misconfigured",
    });
  });

  it.each([429, 500, 502, 503, 520])("%s é indisponível, nunca logout", (status) => {
    expect(classifyRefreshError(new ApiError({ status }))).toEqual({ kind: "unavailable" });
  });

  it("rede e contrato quebrado são indisponíveis", () => {
    expect(classifyRefreshError(new ApiError({ status: null }))).toEqual({ kind: "unavailable" });
    expect(classifyRefreshError(new SessionContractError())).toEqual({ kind: "unavailable" });
  });

  it("outro 4xx é rejeitado", () => {
    expect(classifyRefreshError(new ApiError({ status: 403, code: "FORBIDDEN" }))).toEqual({
      kind: "rejected",
      code: "FORBIDDEN",
    });
  });

  it("o W2 roda dentro do lock, um de cada vez", async () => {
    const api = new FakeAuthApi();
    const lock = memoryLock();
    let inside = 0;
    let maxInside = 0;
    const slow = async () => {
      inside += 1;
      maxInside = Math.max(maxInside, inside);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inside -= 1;
      return { accessToken: establishmentToken() };
    };
    api.refreshResults.push(slow, slow, slow);
    await Promise.all([1, 2, 3].map(() => refreshSession(api, lock, () => null)));
    expect(api.refreshCalls).toBe(3);
    expect(maxInside).toBe(1);
  });
});
