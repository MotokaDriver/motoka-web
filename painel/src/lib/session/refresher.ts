import { ApiError } from "@/lib/api/errors";
import type { AuthApi } from "./authApi";
import type { CrossTabLock } from "./crossTab";
import { decodeAccessToken, type AccessClaims } from "./jwt";
import { USER_CHANGED_CODE } from "./messages";

export type RefreshOutcome =
  /** `claims` é `null` para um token sem `sub` (contrato quebrado). */
  | { readonly kind: "renewed"; readonly accessToken: string; readonly claims: AccessClaims | null }
  /** A sessão acabou. `code` é o `error_code` (vazio quando a resposta não tinha). */
  | { readonly kind: "rejected"; readonly code: string | null }
  /** Rede, timeout, 429, 5xx ou 200 ilegível: nada foi decidido, nunca desloga. */
  | { readonly kind: "unavailable" }
  /** 400 `WEB_AUTH_ORIGIN_NOT_ALLOWED`: deploy com a lista de origens errada. */
  | { readonly kind: "misconfigured" };

export const ORIGIN_NOT_ALLOWED = "WEB_AUTH_ORIGIN_NOT_ALLOWED";

/** Classificação do erro do W2 (porte de `CookieSessionRefresher._classify`). */
export function classifyRefreshError(error: unknown): RefreshOutcome {
  if (!(error instanceof ApiError) || error.status === null) return { kind: "unavailable" };
  if (error.status === 400 && error.code === ORIGIN_NOT_ALLOWED) return { kind: "misconfigured" };
  if (error.status === 429 || error.status >= 500) return { kind: "unavailable" };
  return { kind: "rejected", code: error.code };
}

/**
 * W2 dentro do lock entre abas. `currentSub` é lido **dentro** do lock: se outra aba entrou com
 * outra loja, o refresh responde com o token dela, e esta aba é encerrada em vez de mostrar a loja
 * X agindo como a loja Y.
 */
export async function refreshSession(
  api: AuthApi,
  lock: CrossTabLock,
  currentSub: () => string | null,
): Promise<RefreshOutcome> {
  return lock.run(async () => {
    let accessToken: string;
    try {
      ({ accessToken } = await api.refresh());
    } catch (error) {
      return classifyRefreshError(error);
    }
    const claims = decodeAccessToken(accessToken);
    const current = currentSub();
    if (claims && current !== null && current !== claims.sub) {
      return { kind: "rejected", code: USER_CHANGED_CODE };
    }
    return { kind: "renewed", accessToken, claims };
  });
}
