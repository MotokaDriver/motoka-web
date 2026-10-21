import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { SIGNED_OUT } from "@/lib/session/crossTab";
import { SessionMessages } from "@/lib/session/messages";
import { SessionStore } from "@/lib/session/store";
import type { PanelUser } from "@/lib/session/user";
import {
  FakeAuthApi,
  OTHER_STORE_ID,
  STORE_ID,
  deferred,
  establishmentToken,
  establishmentUser,
  flush,
  makeToken,
  memoryBus,
  memoryLock,
} from "../helpers";

function setup(options: { loadUser?: (access: string, sub: string) => Promise<PanelUser> } = {}) {
  const api = new FakeAuthApi();
  const bus = memoryBus();
  const channel = bus.channel();
  const loadUser = vi.fn(options.loadUser ?? (async (_access: string, sub: string) => establishmentUser(sub)));
  const store = new SessionStore({ api, lock: memoryLock(), channel, loadUser });
  return { api, bus, channel, loadUser, store };
}

const ok = (token = establishmentToken()) => async () => ({ accessToken: token });
const fail = (status: number | null, code: string | null = null) => async () => {
  throw new ApiError({ status, code });
};

describe("SessionStore.restore", () => {
  it("sem cookie é a primeira visita silenciosa", async () => {
    const { api, store } = setup();
    api.refreshResults.push(fail(401, "AUTH_REFRESH_MISSING"));
    await store.restore();
    expect(store.getState()).toEqual({ status: "anonymous", message: null, expired: false, keepReturn: true });
  });

  it("REUSED diz que a sessão foi encerrada por segurança", async () => {
    const { api, store } = setup();
    api.refreshResults.push(fail(401, "AUTH_REFRESH_REUSED"));
    await store.restore();
    expect(store.getState()).toMatchObject({
      status: "anonymous",
      expired: true,
      message: "Sua sessão foi encerrada por segurança. Entre novamente.",
    });
  });

  it.each([
    ["rede", null],
    ["429", 429],
    ["500", 500],
    ["502", 502],
  ])("%s é indisponível e não apaga nada", async (_label, status) => {
    const { api, store } = setup();
    api.refreshResults.push(fail(status as number | null));
    await store.restore();
    expect(store.getState()).toEqual({ status: "unavailable", message: SessionMessages.connection });
  });

  it("origem mal configurada diz isso, e não culpa a conexão", async () => {
    const { api, store } = setup();
    api.refreshResults.push(fail(400, "WEB_AUTH_ORIGIN_NOT_ALLOWED"));
    await store.restore();
    expect(store.getState()).toEqual({ status: "unavailable", message: "Requisição não permitida." });
  });

  it("estabelecimento entra, com o access só em memória", async () => {
    const { api, store, loadUser } = setup();
    const token = establishmentToken();
    api.refreshResults.push(ok(token));
    await store.restore();
    expect(store.getState()).toMatchObject({ status: "authenticated", sub: STORE_ID });
    expect(store.getAccessToken()).toBe(token);
    expect(loadUser).toHaveBeenCalledWith(token, STORE_ID);
    expect(JSON.stringify(store.getState())).not.toContain(token);
  });

  it("GET /users 401 termina num estado expirado", async () => {
    const { api, store } = setup({
      loadUser: async () => {
        throw new ApiError({ status: 401, code: "AUTH_TOKEN_EXPIRED" });
      },
    });
    api.refreshResults.push(ok());
    await store.restore();
    expect(store.getState()).toMatchObject({ status: "anonymous", expired: true, message: SessionMessages.sessionExpired });
    expect(store.getAccessToken()).toBeNull();
  });

  it("GET /users 502 é indisponível", async () => {
    const { api, store } = setup({
      loadUser: async () => {
        throw new ApiError({ status: 502 });
      },
    });
    api.refreshResults.push(ok());
    await store.restore();
    expect(store.getState()).toEqual({ status: "unavailable", message: SessionMessages.loadUser });
  });

  it("token sem sub não abre sessão", async () => {
    const { api, store } = setup();
    api.refreshResults.push(ok(makeToken({ type: "access", roles: ["establishment"] })));
    await store.restore();
    expect(store.getState()).toEqual({ status: "unavailable", message: SessionMessages.startSession });
  });

  it("um restore lento nunca sobrescreve um logout que veio depois", async () => {
    const { api, store } = setup();
    const slow = deferred<{ accessToken: string }>();
    api.refreshResults.push(() => slow.promise);
    const restoring = store.restore();
    await flush();
    const leaving = store.logout();
    slow.resolve({ accessToken: establishmentToken() });
    await Promise.all([restoring, leaving]);
    expect(store.getState()).toEqual({ status: "anonymous", message: null, expired: false, keepReturn: false });
    expect(store.getAccessToken()).toBeNull();
  });
});

describe("SessionStore.login", () => {
  it("W1 400 WEB_AUTH_ACCOUNT_NOT_ALLOWED é erro de login, sem W3", async () => {
    const { api, store } = setup();
    api.loginResults.push(fail(400, "WEB_AUTH_ACCOUNT_NOT_ALLOWED"));
    const result = await store.login("52998224725", "x");
    expect(result).toEqual({ ok: false, message: "O painel é só para estabelecimentos." });
    expect(api.logoutCalls).toBe(0);
  });

  it("credencial errada usa o texto do catálogo", async () => {
    const { api, store } = setup();
    api.loginResults.push(fail(401, "LOGIN_INVALID_CREDENTIALS"));
    expect(await store.login("a", "b")).toEqual({ ok: false, message: "CPF/CNPJ, e-mail ou senha incorretos." });
  });

  it("sem rede no login diz para conferir a conexão", async () => {
    const { api, store } = setup();
    api.loginResults.push(fail(null));
    expect(await store.login("a", "b")).toEqual({ ok: false, message: SessionMessages.connection });
  });

  it("estabelecimento autentica", async () => {
    const { api, store } = setup();
    api.loginResults.push(ok());
    expect(await store.login("11222333000181", "NovaSenha@1")).toEqual({ ok: true });
    expect(api.loginCalls).toEqual([["11222333000181", "NovaSenha@1"]]);
    expect(store.getState().status).toBe("authenticated");
  });

  it.each([
    ["motoboy", "driver", ["driver"], SessionMessages.notEstablishment],
    ["admin", "admin", ["admin"], SessionMessages.noPanelAccess],
    ["estabelecimento sem papel", "establishment", [], SessionMessages.noPanelAccess],
  ])("defesa em profundidade: %s é negado e o cookie revogado", async (_label, type, roles, message) => {
    const { api, store } = setup({ loadUser: async (_a, sub) => ({ ...establishmentUser(sub), type }) });
    api.loginResults.push(ok(makeToken({ sub: STORE_ID, roles })));
    await store.login("x", "y");
    expect(api.logoutCalls).toBe(1);
    expect(store.getState()).toEqual({ status: "denied", message });
    expect(store.getAccessToken()).toBeNull();
  });

  it("token sem sub falha para o login, revogando", async () => {
    const { api, store } = setup();
    api.loginResults.push(ok(makeToken({ roles: ["establishment"] })));
    expect(await store.login("x", "y")).toEqual({ ok: false, message: SessionMessages.startSession });
    expect(api.logoutCalls).toBe(1);
  });

  it("falha ao carregar o usuário revoga e avisa", async () => {
    const { api, store } = setup({
      loadUser: async () => {
        throw new ApiError({ status: null });
      },
    });
    api.loginResults.push(ok());
    expect(await store.login("x", "y")).toEqual({ ok: false, message: SessionMessages.connection });
    expect(api.logoutCalls).toBe(1);
  });
});

describe("SessionStore.expire", () => {
  it("duas expirações separadas por um login emitem dois estados expirados", async () => {
    const { api, store, channel } = setup();
    api.loginResults.push(ok(), ok());
    await store.login("a", "b");
    store.expire("AUTH_SESSION_EXPIRED");
    expect(store.getState()).toMatchObject({ status: "anonymous", expired: true, message: SessionMessages.sessionExpired });
    await store.login("a", "b");
    store.expire("AUTH_REFRESH_REVOKED");
    expect(store.getState()).toMatchObject({ message: "Sua sessão foi encerrada. Entre novamente." });
    expect(channel.published).toEqual([SIGNED_OUT, SIGNED_OUT]);
  });

  it("AUTH_REFRESH_MISSING no meio da sessão mostra a mensagem", async () => {
    const { api, store } = setup();
    api.loginResults.push(ok());
    await store.login("a", "b");
    store.expire("AUTH_REFRESH_MISSING");
    expect(store.getState()).toMatchObject({ expired: true, message: SessionMessages.sessionExpired, keepReturn: true });
  });

  it("é idempotente depois de deslogado", async () => {
    const { api, store, channel } = setup();
    api.loginResults.push(ok());
    await store.login("a", "b");
    const listener = vi.fn();
    store.subscribe(listener);
    store.expire(null);
    store.expire("AUTH_REFRESH_REUSED");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(channel.published).toEqual([SIGNED_OUT]);
  });

  it("troca de conta não derruba a outra aba", async () => {
    const { api, store, channel } = setup();
    api.loginResults.push(ok());
    await store.login("a", "b");
    store.expire("PANEL_SESSION_USER_CHANGED");
    expect(store.getState()).toMatchObject({ message: SessionMessages.userChanged });
    expect(channel.published).toEqual([]);
  });

  it("limpa o cache da loja", async () => {
    const { api, store } = setup();
    const clear = vi.fn();
    store.onClear(clear);
    api.loginResults.push(ok());
    await store.login("a", "b");
    store.expire(null);
    expect(clear).toHaveBeenCalled();
  });
});

describe("refreshForRetry", () => {
  it("outra conta no cookie encerra esta aba (comparação de sub)", async () => {
    const { api, store } = setup();
    api.loginResults.push(ok());
    await store.login("a", "b");
    const failed = store.getAccessToken()!;
    api.refreshResults.push(ok(establishmentToken(OTHER_STORE_ID)));
    const outcome = await store.refreshForRetry(failed);
    expect(outcome).toEqual({ kind: "rejected", code: "PANEL_SESSION_USER_CHANGED" });
    expect(store.getAccessToken()).toBe(failed);
  });

  it("a mesma conta renova normalmente", async () => {
    const { api, store } = setup();
    api.loginResults.push(ok());
    await store.login("a", "b");
    const failed = store.getAccessToken()!;
    const renewed = establishmentToken();
    api.refreshResults.push(ok(renewed + "x"));
    const outcome = await store.refreshForRetry(failed);
    expect(outcome.kind).toBe("renewed");
    expect(store.getAccessToken()).toBe(renewed + "x");
  });

  it("dois 401 juntos fazem um refresh só (single-flight da aba)", async () => {
    const { api, store } = setup();
    api.loginResults.push(ok());
    await store.login("a", "b");
    const failed = store.getAccessToken()!;
    const gate = deferred<{ accessToken: string }>();
    api.refreshResults.push(() => gate.promise);
    const a = store.refreshForRetry(failed);
    const b = store.refreshForRetry(failed);
    gate.resolve({ accessToken: establishmentToken() + "y" });
    await Promise.all([a, b]);
    expect(api.refreshCalls).toBe(1);
    // Um terceiro 401 com o token antigo não renova de novo: o token já mudou.
    await store.refreshForRetry(failed);
    expect(api.refreshCalls).toBe(1);
  });
});

describe("logout e outras abas", () => {
  it("limpa localmente mesmo com o W3 falhando", async () => {
    const { api, store, channel } = setup();
    api.loginResults.push(ok());
    await store.login("a", "b");
    api.logoutResult = async () => {
      throw new ApiError({ status: null });
    };
    await store.logout();
    expect(store.getState()).toEqual({ status: "anonymous", message: null, expired: false, keepReturn: false });
    expect(store.getAccessToken()).toBeNull();
    expect(channel.published).toEqual([SIGNED_OUT]);
  });

  it("sair numa aba desloga a outra sem um segundo W3", async () => {
    const api = new FakeAuthApi();
    const bus = memoryBus();
    const lock = memoryLock();
    const loadUser = async (_a: string, sub: string) => establishmentUser(sub);
    const tabA = new SessionStore({ api, lock, channel: bus.channel(), loadUser });
    const tabB = new SessionStore({ api, lock, channel: bus.channel(), loadUser });
    api.loginResults.push(ok(), ok());
    await tabA.login("a", "b");
    await tabB.login("a", "b");
    await tabA.logout();
    await flush();
    expect(tabB.getState()).toMatchObject({ status: "anonymous", message: null });
    expect(tabB.getAccessToken()).toBeNull();
    expect(api.logoutCalls).toBe(1);
  });
});

describe("corridas com o Sair", () => {
  it("um 401 atrasado durante o Sair não troca o estado nem chama outro refresh", async () => {
    const { api, store } = setup();
    api.loginResults.push(ok());
    await store.login("a", "b");
    const failed = store.getAccessToken()!;
    const gate = deferred<undefined>();
    api.logoutResult = () => gate.promise;
    const leaving = store.logout();
    expect(await store.refreshForRetry(failed)).toEqual({ kind: "unavailable" });
    store.expire("AUTH_TOKEN_EXPIRED");
    gate.resolve(undefined);
    await leaving;
    expect(store.getState()).toEqual({ status: "anonymous", message: null, expired: false, keepReturn: false });
    expect(api.refreshCalls).toBe(0);
  });
});

describe("notas da revisão do WN-0", () => {
  it("signed-out de outra aba durante o próprio Sair termina no login puro", async () => {
    const api = new FakeAuthApi();
    const bus = memoryBus();
    const loadUser = async (_a: string, sub: string) => establishmentUser(sub);
    const tabA = new SessionStore({ api, lock: memoryLock(), channel: bus.channel(), loadUser });
    const other = bus.channel();
    api.loginResults.push(ok());
    await tabA.login("a", "b");
    const gate = deferred<undefined>();
    api.logoutResult = () => gate.promise;
    const leaving = tabA.logout();
    other.publish(SIGNED_OUT);
    await flush();
    gate.resolve(undefined);
    await leaving;
    expect(tabA.getState()).toEqual({ status: "anonymous", message: null, expired: false, keepReturn: false });
  });

  it("refresh que termina depois de outra operação não repete com o token dela", async () => {
    const { api, store } = setup();
    const fresh = establishmentToken() + "novo";
    api.loginResults.push(ok(), ok(fresh));
    await store.login("a", "b");
    const failed = store.getAccessToken()!;
    const gate = deferred<{ accessToken: string }>();
    api.refreshResults.push(() => gate.promise);
    const pending = store.refreshForRetry(failed);
    await store.login("a", "b");
    gate.resolve({ accessToken: establishmentToken() + "velho" });
    expect(await pending).toEqual({ kind: "unavailable" });
    expect(store.getAccessToken()).toBe(fresh);
  });
});
