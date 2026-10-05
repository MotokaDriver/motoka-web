import { z } from "@/lib/zod";
import { ApiError, apiErrorFromResponse } from "@/lib/api/errors";
import { API_BASE } from "@/lib/env";

/**
 * Os três endpoints da sessão do navegador (`/v1/web/auth/*`, WS-01a).
 *
 * Só aqui o painel manda credenciais (`credentials: 'include'`): o cookie de refresh
 * (`Path=/v1/web/auth`) nunca vai em outra requisição. A API exige `Origin` exato e o header
 * `X-Motoka-Client: painel`, que força o preflight (defesa de CSRF). Nada aqui manda Bearer.
 */
export const CLIENT_HEADER = "X-Motoka-Client";
export const CLIENT_VALUE = "painel";

export const TOKEN_PATH = "/web/auth/token";
export const REFRESH_PATH = "/web/auth/refresh";
export const LOGOUT_PATH = "/web/auth/logout";

const REQUEST_TIMEOUT_MS = 15_000;
export const LOGOUT_TIMEOUT_MS = 5_000;

const sessionSchema = z.object({
  access_token: z.string().check(z.minLength(1)),
  token_type: z.optional(z.string()),
});

export interface WebSession {
  /** Só o access token. Um refresh token no corpo (que a API não manda) seria ignorado. */
  readonly accessToken: string;
}

/** 200 sem `access_token`: contrato quebrado, não é uma sessão. Classificado como indisponível. */
export class SessionContractError extends Error {
  constructor() {
    super("SESSION_CONTRACT");
    this.name = "SessionContractError";
  }
}

export interface AuthApi {
  login(username: string, password: string): Promise<WebSession>;
  refresh(): Promise<WebSession>;
  logout(): Promise<void>;
}

async function send(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { ...(init.headers as Record<string, string> | undefined), [CLIENT_HEADER]: CLIENT_VALUE },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut = (error as { name?: unknown } | null)?.name === "TimeoutError";
    throw new ApiError({ status: null, timedOut });
  }
}

async function readSession(response: Response): Promise<WebSession> {
  if (!response.ok) throw await apiErrorFromResponse(response);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new SessionContractError();
  }
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) throw new SessionContractError();
  return { accessToken: parsed.data.access_token };
}

export const webAuthApi: AuthApi = {
  /** W1: form `username` + `password`. Sem `device_token`: não há push no web. */
  async login(username, password) {
    const form = new URLSearchParams({ username, password });
    const response = await send(
      TOKEN_PATH,
      {
        body: form.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      },
      REQUEST_TIMEOUT_MS,
    );
    return readSession(response);
  },

  /** W2: sem corpo, o cookie é a credencial. */
  async refresh() {
    const response = await send(REFRESH_PATH, { headers: { Accept: "application/json" } }, REQUEST_TIMEOUT_MS);
    return readSession(response);
  },

  /** W3: 204, idempotente no servidor. */
  async logout() {
    const response = await send(LOGOUT_PATH, {}, LOGOUT_TIMEOUT_MS);
    if (!response.ok) throw await apiErrorFromResponse(response);
  },
};
