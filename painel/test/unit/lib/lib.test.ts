import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { telLink, trustedUrl, whatsappLink } from "@/lib/links/links";
import { backoffInterval, pollingInterval, queryRetry } from "@/lib/polling/polling";
import {
  SHORTCUTS_KEY,
  THEME_KEY,
  clearReloadMark,
  getShortcutsEnabled,
  getThemePreference,
  resetPrefsMemory,
  setShortcutsEnabled,
  setThemePreference,
  subscribePrefs,
  takeReloadMark,
} from "@/lib/prefs/prefs";
import { createBroadcastChannel, createWebLock } from "@/lib/session/crossTab";
import { decodeAccessToken } from "@/lib/session/jwt";
import { initials, storeAddress, storeName } from "@/lib/session/user";
import { addDays, currentWeekStart, isValidDay, relativeDayTime, spDay, spTime, weekStart } from "@/lib/time/saoPaulo";
import { establishmentUser, makeToken } from "../helpers";

describe("jwt", () => {
  it("lê sub, exp e roles", () => {
    expect(decodeAccessToken(makeToken({ sub: "a", exp: 10, roles: ["establishment", 3] }))).toEqual({
      sub: "a",
      exp: 10,
      roles: ["establishment"],
    });
  });
  it("token malformado ou sem sub é null", () => {
    expect(decodeAccessToken("a.b")).toBeNull();
    expect(decodeAccessToken("a.!!!.c")).toBeNull();
    expect(decodeAccessToken(makeToken({ roles: [] }))).toBeNull();
  });
  it("aceita UTF-8 no payload", () => {
    expect(decodeAccessToken(makeToken({ sub: "ção" }))?.sub).toBe("ção");
  });
});

describe("cross-tab", () => {
  it("o lock usa navigator.locks com o nome do painel", async () => {
    const request = vi.fn((_name: string, cb: () => Promise<number>) => cb());
    const lock = createWebLock({ locks: { request } } as unknown as Navigator);
    expect(await lock.run(async () => 7)).toBe(7);
    expect(request.mock.calls[0]![0]).toBe("motoka-panel-refresh");
  });
  it("sem Web Locks a ação roda direto", async () => {
    const lock = createWebLock({} as Navigator);
    expect(await lock.run(async () => 3)).toBe(3);
  });
  it("o canal entrega para as outras instâncias e não para quem publica", async () => {
    const a = createBroadcastChannel();
    const b = createBroadcastChannel();
    const gotA: string[] = [];
    const gotB: string[] = [];
    a.subscribe((m) => gotA.push(m));
    b.subscribe((m) => gotB.push(m));
    a.publish("signed-out");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(gotB).toEqual(["signed-out"]);
    expect(gotA).toEqual([]);
    a.close();
    b.close();
  });
});

describe("prefs", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetPrefsMemory();
  });

  it("atalhos ligados por padrão; desligar é lembrado e notifica", () => {
    expect(getShortcutsEnabled()).toBe(true);
    const listener = vi.fn();
    const off = subscribePrefs(listener);
    setShortcutsEnabled(false);
    expect(localStorage.getItem(SHORTCUTS_KEY)).toBe("off");
    resetPrefsMemory();
    expect(getShortcutsEnabled()).toBe(false);
    expect(listener).toHaveBeenCalled();
    off();
  });

  it("storage que lança deixa os atalhos ligados e nunca lança", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(getShortcutsEnabled()).toBe(true);
    expect(() => setShortcutsEnabled(false)).not.toThrow();
    expect(getShortcutsEnabled()).toBe(false);
    expect(takeReloadMark()).toBe(false);
    spy.mockRestore();
    set.mockRestore();
  });

  it("tema: escuro por padrão; trocar grava e aplica no <html>", () => {
    expect(getThemePreference()).toBe("dark");
    setThemePreference("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    setThemePreference("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("a marca de recarga vale uma vez por aba", () => {
    expect(takeReloadMark()).toBe(true);
    expect(takeReloadMark()).toBe(false);
    clearReloadMark();
    expect(takeReloadMark()).toBe(true);
  });
});

describe("tempo em São Paulo", () => {
  it("dia e hora no fuso de SP, sem horário de verão", () => {
    // 2026-11-15 02:30Z é 23:30 do dia 14 em SP (UTC−3 o ano todo desde 2019).
    expect(spDay(new Date("2026-11-15T02:30:00Z"))).toBe("2026-11-14");
    expect(spTime(new Date("2026-11-15T02:30:00Z"))).toBe("23:30");
    expect(spTime(new Date("2026-01-15T03:00:00Z"))).toBe("00:00");
  });

  it("virada da meia-noite", () => {
    expect(spDay(new Date("2026-10-06T02:59:59Z"))).toBe("2026-10-05");
    expect(spDay(new Date("2026-10-06T03:00:00Z"))).toBe("2026-10-06");
  });

  it("semana começa na segunda", () => {
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekStart("2026-10-11")).toBe("2026-10-05");
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
    expect(weekStart("2026-03-01")).toBe("2026-02-23");
    expect(currentWeekStart(new Date("2026-10-12T02:00:00Z"))).toBe("2026-10-05");
  });

  it("aritmética de dias e dia válido", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("2026-10-05")).toBe(true);
    expect(isValidDay("05/10/2026")).toBe(false);
  });

  it("hoje, ontem e data", () => {
    const now = new Date("2026-10-05T15:00:00Z");
    expect(relativeDayTime(new Date("2026-10-05T21:41:00Z"), now)).toBe("hoje 18:41");
    expect(relativeDayTime(new Date("2026-10-05T02:50:00Z"), now)).toBe("ontem 23:50");
    expect(relativeDayTime(new Date("2026-10-03T12:12:00Z"), now)).toBe("03/10 09:12");
  });
});

describe("links", () => {
  it("tel: e wa.me só com telefone BR válido e texto codificado", () => {
    expect(telLink("(41) 99771-0045")).toBe("tel:+5541997710045");
    expect(telLink("123")).toBeNull();
    expect(whatsappLink("Olá & tchau", "+55 41 99771-0045")).toBe("https://wa.me/5541997710045?text=Ol%C3%A1%20%26%20tchau");
    expect(whatsappLink("oi")).toBe("https://wa.me/?text=oi");
    expect(whatsappLink("oi", "abc")).toBeNull();
  });

  it("URL da API só com https e o host esperado", () => {
    expect(trustedUrl("https://painel.motokadriver.com/convite/abc", "painel.motokadriver.com")).toBe(
      "https://painel.motokadriver.com/convite/abc",
    );
    expect(trustedUrl("javascript:alert(1)", "painel.motokadriver.com")).toBeNull();
    expect(trustedUrl("https://evil.com/convite", "painel.motokadriver.com")).toBeNull();
    expect(trustedUrl("http://painel.motokadriver.com/x", "painel.motokadriver.com")).toBeNull();
    expect(trustedUrl("https://user:pw@painel.motokadriver.com/", "painel.motokadriver.com")).toBeNull();
    expect(trustedUrl("http://localhost:8787/convite/a", "localhost:8787", { allowLocalhost: true })).toBe(
      "http://localhost:8787/convite/a",
    );
  });
});

describe("usuário da loja", () => {
  it("nome, endereço e iniciais", () => {
    const user = establishmentUser();
    expect(storeName(user)).toBe("Padaria Teste LTDA");
    expect(storeName({ ...user, corporate_reason: "  " })).toBe("Padaria da Se");
    expect(storeAddress(user)).toBe("Praça da Sé, 200");
    expect(storeAddress({ ...user, address: null })).toBeNull();
    expect(initials("Pizzaria do Zé")).toBe("PZ");
    expect(initials("Loja")).toBe("L");
    expect(initials("  ")).toBe("?");
  });
});

function failing(error: ApiError) {
  return { state: { error, errorUpdateCount: 1, errorUpdatedAt: 2, dataUpdatedAt: 1 } };
}

describe("polling e retry (DN-07, §5.5)", () => {
  it("backoff dobra até 60 s e volta à base com sucesso", () => {
    expect([0, 1, 2, 3, 4].map((n) => backoffInterval(10_000, n, null))).toEqual([10_000, 20_000, 40_000, 60_000, 60_000]);
  });

  it("respeita o Retry-After", () => {
    expect(backoffInterval(10_000, 1, 30)).toBe(30_000);
    expect(backoffInterval(10_000, 1, 5)).toBe(20_000);
  });

  it("403 e 404 param o polling; 429 usa o Retry-After", () => {
    const interval = pollingInterval(10_000);
    expect(interval(failing(new ApiError({ status: 403 })))).toBe(false);
    expect(interval(failing(new ApiError({ status: 404 })))).toBe(false);
    expect(
      interval(failing(new ApiError({ status: 429, retryAfter: 30 }))),
    ).toBe(30_000);
    expect(interval({ state: { error: null, errorUpdateCount: 0, errorUpdatedAt: 0, dataUpdatedAt: 1 } })).toBe(10_000);
  });

  it("retry nunca em 4xx; rede/5xx no máximo 1", () => {
    for (const status of [400, 401, 403, 404, 409, 422, 429]) {
      expect(queryRetry(0, new ApiError({ status }))).toBe(false);
    }
    expect(queryRetry(0, new ApiError({ status: 500 }))).toBe(true);
    expect(queryRetry(1, new ApiError({ status: 500 }))).toBe(false);
    expect(queryRetry(0, new ApiError({ status: null }))).toBe(true);
    expect(queryRetry(0, new Error("bug"))).toBe(false);
  });

  describe("com relógio falso", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("falhas seguidas espaçam 10→20→40→60 s e um sucesso volta a 10 s", async () => {
      const client = new QueryClient();
      const times: number[] = [];
      let calls = 0;
      const start = Date.now();
      const observer = new QueryObserver(client, {
        queryKey: ["polling"],
        queryFn: async () => {
          calls += 1;
          times.push(Date.now() - start);
          if (calls >= 2 && calls <= 5) throw new ApiError({ status: 503 });
          return calls;
        },
        retry: 0,
        refetchInterval: pollingInterval(10_000),
        refetchIntervalInBackground: true,
      });
      const unsubscribe = observer.subscribe(() => undefined);
      await vi.advanceTimersByTimeAsync(10_000 + 20_000 + 40_000 + 60_000 + 60_000 + 10_000 + 1);
      unsubscribe();
      client.clear();
      const gaps = times.slice(1).map((t, i) => t - times[i]!);
      // 1º ok (t=0) → 2º falha em 10 s → 20 s → 40 s → 60 s → 6º ok depois de 60 s → volta a 10 s.
      expect(gaps.slice(0, 6)).toEqual([10_000, 20_000, 40_000, 60_000, 60_000, 10_000]);
    });
  });
});
