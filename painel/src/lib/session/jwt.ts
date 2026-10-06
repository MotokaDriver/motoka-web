/**
 * Claims do access token que o painel lê. O JWT é decodificado só para saber de quem é a sessão e
 * quando ela vence; quem autoriza é a API (§5.2). A assinatura não é verificada aqui.
 */
export interface AccessClaims {
  readonly sub: string;
  /** Epoch em segundos. */
  readonly exp: number | null;
  readonly roles: readonly string[];
}

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** `null` para um token malformado ou sem `sub`. */
export function decodeAccessToken(token: string): AccessClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const claims = payload as Record<string, unknown>;
  const sub = claims.sub;
  if (typeof sub !== "string" || sub.length === 0) return null;
  const exp = typeof claims.exp === "number" && Number.isFinite(claims.exp) ? claims.exp : null;
  const roles = Array.isArray(claims.roles)
    ? claims.roles.filter((role): role is string => typeof role === "string")
    : [];
  return { sub, exp, roles };
}
