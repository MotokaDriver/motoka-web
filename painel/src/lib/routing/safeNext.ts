import { KNOWN_PATHS, Paths, withTrailingSlash } from "./routes";

export const RETURN_KEY = "de";

const PROBE_ORIGIN = "https://painel.invalid";

/**
 * Destino do `?de=` do login, contra open redirect (§5.3). `raw` é o valor já decodificado uma vez
 * (`URLSearchParams.get`). Aceita só um caminho do painel:
 * - começa com uma única `/`, sem `\`, sem esquema e sem caractere de controle;
 * - sem `//` codificado que sobrou do duplo encode;
 * - sem `de` aninhado;
 * - o caminho está na lista fechada de rotas conhecidas.
 * A query do destino é mantida. Qualquer outra coisa devolve `null` (o chamador vai para a home).
 */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("\\")) return null;
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return null;
  }
  if (/%2f|%5c/i.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PROBE_ORIGIN) return null;
  if (url.searchParams.has(RETURN_KEY)) return null;

  const path = withTrailingSlash(url.pathname);
  if (!KNOWN_PATHS.has(path)) return null;
  return `${path}${url.search}`;
}

/** Para onde o login leva depois de entrar. */
export function nextAfterLogin(raw: string | null | undefined): string {
  return safeNext(raw) ?? Paths.home;
}

/** URL do login guardando a rota atual (só caminhos conhecidos; o resto vira o login puro). */
export function loginUrlFor(pathname: string, search: string): string {
  const target = `${withTrailingSlash(pathname)}${search}`;
  if (!safeNext(target)) return Paths.login;
  return `${Paths.login}?${new URLSearchParams({ [RETURN_KEY]: target }).toString()}`;
}
