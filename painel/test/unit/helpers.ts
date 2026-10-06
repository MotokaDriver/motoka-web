import type { AuthApi, WebSession } from "@/lib/session/authApi";
import type { CrossTabChannel, CrossTabLock } from "@/lib/session/crossTab";
import type { PanelUser } from "@/lib/session/user";

/** JWT sem assinatura válida (o painel não verifica): só o payload importa. */
export function makeToken(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.assinatura`;
}

export const STORE_ID = "5b6acbe2-9c52-4a61-945b-9aae70c59fdc";
export const OTHER_STORE_ID = "0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0";

export function establishmentToken(sub = STORE_ID): string {
  return makeToken({ sub, type: "access", roles: ["establishment"], exp: Math.floor(Date.now() / 1000) + 900 });
}

export function establishmentUser(id = STORE_ID): PanelUser {
  return {
    id,
    full_name: "Padaria da Se",
    type: "establishment",
    email: "novaloja@motoka.com",
    phone: "11977776666",
    document_number: "11222333000181",
    corporate_reason: "Padaria Teste LTDA",
    address: { street: "Praça da Sé", number: 200, neighborhood: "Se", city: "Sao Paulo", state: "SP" },
  };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** API de sessão falsa: cada chamada consome a próxima resposta da fila. */
export class FakeAuthApi implements AuthApi {
  loginCalls: Array<[string, string]> = [];
  refreshCalls = 0;
  logoutCalls = 0;
  loginResults: Array<() => Promise<WebSession>> = [];
  refreshResults: Array<() => Promise<WebSession>> = [];
  logoutResult: () => Promise<void> = async () => undefined;

  async login(username: string, password: string): Promise<WebSession> {
    this.loginCalls.push([username, password]);
    const next = this.loginResults.shift();
    if (!next) throw new Error("login inesperado");
    return next();
  }

  async refresh(): Promise<WebSession> {
    this.refreshCalls += 1;
    const next = this.refreshResults.shift();
    if (!next) throw new Error("refresh inesperado");
    return next();
  }

  async logout(): Promise<void> {
    this.logoutCalls += 1;
    return this.logoutResult();
  }
}

/** Lock que serializa dentro do processo (o real é o Web Locks). */
export function memoryLock(): CrossTabLock & { held: number; maxHeld: number } {
  let tail: Promise<unknown> = Promise.resolve();
  const lock = {
    held: 0,
    maxHeld: 0,
    run<T>(action: () => Promise<T>): Promise<T> {
      const result = tail.then(async () => {
        lock.held += 1;
        lock.maxHeld = Math.max(lock.maxHeld, lock.held);
        try {
          return await action();
        } finally {
          lock.held -= 1;
        }
      });
      tail = result.catch(() => undefined);
      return result;
    },
  };
  return lock;
}

/** Barramento entre "abas" do mesmo teste: não ecoa para quem publica. */
export function memoryBus() {
  const channels = new Set<{ listeners: Set<(m: string) => void> }>();
  return {
    channel(): CrossTabChannel & { published: string[] } {
      const self = { listeners: new Set<(m: string) => void>() };
      channels.add(self);
      const published: string[] = [];
      return {
        published,
        subscribe(listener) {
          self.listeners.add(listener);
          return () => self.listeners.delete(listener);
        },
        publish(message) {
          published.push(message);
          for (const other of channels) {
            if (other === self) continue;
            for (const listener of other.listeners) listener(message);
          }
        },
        close() {
          channels.delete(self);
        },
      };
    },
  };
}

export async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
