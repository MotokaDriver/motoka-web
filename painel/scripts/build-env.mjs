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
  const rawMap = (source.NEXT_PUBLIC_MAP_STYLE_URL ?? "").trim();
  const mapStyleUrl = rawMap
    ? validateMapStyleUrl(rawMap)
    : "";
  return { appEnv, apiUrl: new URL(apiUrl).origin, mapStyleUrl };
}

/**
 * O estilo do mapa vem de um provedor de tiles (WN-3): só https, sem credenciais.
 * @param {string} raw
 */
function validateMapStyleUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_MAP_STYLE_URL inválida: "${raw}"`);
  }
  if (url.protocol !== "https:") throw new Error("NEXT_PUBLIC_MAP_STYLE_URL deve usar https.");
  if (url.username || url.password) {
    throw new Error("NEXT_PUBLIC_MAP_STYLE_URL não pode conter credenciais.");
  }
  return url.href;
}
