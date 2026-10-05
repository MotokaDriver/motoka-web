import { API_BASE } from "@/lib/env";
import type { RefreshOutcome } from "@/lib/session/refresher";
import { ApiError, apiErrorFromResponse } from "./errors";

export const REQUEST_TIMEOUT_MS = 15_000;

/** O que o cliente HTTP precisa da sessão (o `SessionStore` cumpre). */
export interface SessionPort {
  getAccessToken(): string | null;
  refreshForRetry(failedAccessToken: string): Promise<RefreshOutcome>;
  expire(code: string | null): void;
}

export interface ApiRequest {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Serializado como JSON. */
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, string | number | boolean | null | undefined>>;
  /** Repassado do TanStack Query: cancela a requisição quando a query é descartada. */
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

/** 401 que vale um refresh: token vencido, inválido ou 401 sem código (header ausente). */
const REFRESHABLE_401 = new Set([null, "AUTH_TOKEN_EXPIRED", "AUTH_TOKEN_INVALID", "AUTH_ERROR", "HTTP_ERROR"]);

function buildUrl(path: string, query: ApiRequest["query"]): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
    throw new Error(`Caminho de API inválido: ${path}`);
  }
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Cliente HTTP do painel (§5.1). Rotas fora de `/web/auth` vão com Bearer e
 * `credentials: 'omit'`: o cookie de refresh nunca sai daqui. Num 401 de token, um refresh
 * single-flight e **uma** repetição; um segundo 401, ou um refresh recusado, encerra a sessão.
 * Rede, 5xx e 429 nunca deslogam.
 */
export function createApiClient(session: SessionPort) {
  async function send(path: string, request: ApiRequest, accessToken: string): Promise<Response> {
    const timeout = AbortSignal.timeout(request.timeoutMs ?? REQUEST_TIMEOUT_MS);
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };
    if (request.body !== undefined) headers["Content-Type"] = "application/json";
    try {
      return await fetch(buildUrl(path, request.query), {
        method: request.method ?? "GET",
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        credentials: "omit",
        cache: "no-store",
        signal,
      });
    } catch (error) {
      if (request.signal?.aborted) throw error;
      const timedOut = (error as { name?: unknown } | null)?.name === "TimeoutError";
      throw new ApiError({ status: null, timedOut });
    }
  }

  async function parse<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError({ status: response.status, code: "RESPONSE_UNREADABLE" });
    }
  }

  return async function apiFetch<T>(path: string, request: ApiRequest = {}): Promise<T> {
    const accessToken = session.getAccessToken();
    if (!accessToken) throw new ApiError({ status: 401, code: "PANEL_NO_SESSION" });

    const first = await send(path, request, accessToken);
    if (first.ok) return parse<T>(first);

    const error = await apiErrorFromResponse(first);
    if (error.status !== 401 || !REFRESHABLE_401.has(error.code)) throw error;

    const outcome = await session.refreshForRetry(accessToken);
    if (outcome.kind === "rejected") {
      session.expire(outcome.code);
      throw error;
    }
    if (outcome.kind !== "renewed") {
      // Não deu para decidir (rede, 5xx, 429, origem): não desloga, mostra como falta de conexão.
      throw new ApiError({ status: null });
    }
    const renewed = session.getAccessToken();
    if (!renewed) throw error;

    const second = await send(path, request, renewed);
    if (second.ok) return parse<T>(second);
    const secondError = await apiErrorFromResponse(second);
    if (secondError.status === 401) session.expire(secondError.code);
    throw secondError;
  };
}

export type ApiFetch = ReturnType<typeof createApiClient>;
