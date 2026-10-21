// @ts-check
// Validação das variáveis de build do painel (DN-14). Usada pelo next.config.ts e pelo pós-build,
// para que a CSP e o bundle saiam sempre dos mesmos valores. Nenhuma delas é segredo.

const APP_ENVS = /** @type {const} */ (["dev", "e2e", "preview", "prod"]);
const ALLOWED_DOMAINS = ["motokadriver.com"];

/**
 * @param {string} name
 * @param {string} raw
 * @param {{ allowLocalhost: boolean }} options
 * @returns {string} origem + caminho, sem barra final
 */
export function validatePublicUrl(name, raw, { allowLocalhost }) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} inválida: "${raw}"`);
  }
  if (url.username || url.password) {
    throw new Error(`${name} não pode conter credenciais.`);
  }
  if (url.search || url.hash) {
    throw new Error(`${name} não pode ter query nem fragmento.`);
  }
  const host = url.hostname.toLowerCase();
  const isLocal = url.protocol === "http:" && (host === "localhost" || host === "127.0.0.1");
  if (isLocal) {
    if (!allowLocalhost) throw new Error(`${name}: http://localhost não é aceito em prod.`);
  } else {
    if (url.protocol !== "https:") throw new Error(`${name} deve usar https: "${raw}"`);
    const allowed = ALLOWED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
    if (!allowed) {
      throw new Error(`${name}: host "${host}" fora da allowlist (${ALLOWED_DOMAINS.join(", ")}).`);
    }
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

/**
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} source
 */
export function resolveBuildEnv(source) {
  const appEnv = (source.NEXT_PUBLIC_APP_ENV ?? "dev").trim();
  if (!APP_ENVS.includes(/** @type {any} */ (appEnv))) {
    throw new Error(`NEXT_PUBLIC_APP_ENV inválida: "${appEnv}" (use ${APP_ENVS.join(", ")}).`);
  }
  const allowLocalhost = appEnv !== "prod";
  const defaultApi = appEnv === "prod" ? "" : "http://localhost:8000";
  const rawApi = (source.NEXT_PUBLIC_API_URL ?? "").trim() || defaultApi;
  if (!rawApi) throw new Error("NEXT_PUBLIC_API_URL é obrigatória no build de prod.");
  const apiUrl = validatePublicUrl("NEXT_PUBLIC_API_URL", rawApi, { allowLocalhost });
  if (new URL(apiUrl).pathname !== "/") {
    throw new Error("NEXT_PUBLIC_API_URL é só a origem da API (sem /v1).");
  }
  const googleMapsKey = validateGoogleMapsKey((source.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim());
  const googleTilesUrl = validateGoogleTilesUrl((source.NEXT_PUBLIC_GOOGLE_TILES_URL ?? "").trim(), { prod: appEnv === "prod" });
  return { appEnv, apiUrl: new URL(apiUrl).origin, googleMapsKey, googleTilesUrl };
}

/**
 * Origens dos tiles para a CSP (img-src e connect-src): a base do Google só quando há chave; sem chave, nenhuma.
 * @param {{ googleMapsKey: string, googleTilesUrl: string }} env
 * @returns {string[]}
 */
export function tileOriginsFor(env) {
  return env.googleMapsKey ? [env.googleTilesUrl] : [];
}

/** Host fixo da Map Tiles API do Google (WN-3b, D-W3b-03). */
export const GOOGLE_TILES_ORIGIN = "https://tile.googleapis.com";

/**
 * Chave de navegador do Google Maps Platform (WN-3b, D-W3b-02): pública por natureza, restrita por referrer e por
 * API no console. Vazia = sem mapa ("Mapa não configurado"). O formato fechado barra lixo colado na variável.
 * @param {string} raw
 */
function validateGoogleMapsKey(raw) {
  if (raw && !/^[A-Za-z0-9_-]{20,80}$/.test(raw)) throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY com formato inválido.");
  return raw;
}

/**
 * Base dos tiles (D-W3b-03): em prod é sempre o host do Google; fora de prod aceita `http://localhost` (E2E sem
 * rede, mock na 8790). Só a origem: sem credenciais, caminho, query ou fragmento.
 * @param {string} raw
 * @param {{ prod: boolean }} options
 * @returns {string} origem
 */
function validateGoogleTilesUrl(raw, { prod }) {
  if (!raw) return GOOGLE_TILES_ORIGIN;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_GOOGLE_TILES_URL inválida: "${raw}"`);
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_GOOGLE_TILES_URL é só a origem (sem credenciais, caminho ou query).");
  }
  if (url.origin === GOOGLE_TILES_ORIGIN) return url.origin;
  if (prod) throw new Error(`NEXT_PUBLIC_GOOGLE_TILES_URL: em prod os tiles vêm só de ${GOOGLE_TILES_ORIGIN}.`);
  if (url.protocol !== "http:" || url.hostname !== "localhost") {
    throw new Error("NEXT_PUBLIC_GOOGLE_TILES_URL: fora de prod, só o host do Google ou http://localhost.");
  }
  return url.origin;
}
