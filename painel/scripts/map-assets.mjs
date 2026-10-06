// @ts-check
// Ativos do mapa (WN-3, DN-11): o worker do MapLibre fica no mesmo site (`worker-src 'self'`, sem
// `blob:`) e os hosts do estilo (tiles, glyphs, sprite) entram na CSP. Roda no pós-build.
import fs from "node:fs";
import path from "node:path";

/** Arquivos do `dist/` que o worker precisa (ele importa o `shared`). */
const WORKER_FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

/**
 * @param {string} root painel/
 * @returns {string} versão instalada do pacote
 */
export function maplibreVersion(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "node_modules/maplibre-gl/package.json"), "utf8"));
  return String(pkg.version);
}

/**
 * Copia o worker para `out/_maplibre/<versão>/` e confere que a versão bate com a travada no
 * `package.json` do painel. Falha o build se faltar arquivo.
 * @param {string} root painel/
 * @param {string} outDir
 * @returns {string} versão
 */
export function copyMaplibreWorker(root, outDir) {
  const version = maplibreVersion(root);
  const locked = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).dependencies["maplibre-gl"];
  if (locked !== version) throw new Error(`maplibre-gl: package.json trava ${locked}, mas o instalado é ${version}.`);
  const target = path.join(outDir, "_maplibre", version);
  fs.rmSync(path.join(outDir, "_maplibre"), { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  for (const file of WORKER_FILES) {
    const from = path.join(root, "node_modules/maplibre-gl/dist", file);
    if (!fs.existsSync(from)) throw new Error(`maplibre-gl: ${file} não existe em dist/.`);
    fs.copyFileSync(from, path.join(target, file));
  }
  return version;
}

/** @param {unknown} value @param {string} base @returns {string | null} origem http(s) ou null */
function originOf(value, base) {
  if (typeof value !== "string" || value === "") return null;
  try {
    const url = new URL(value.replace(/\{[^}]*\}/g, "x"), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Origens que o estilo usa: o próprio estilo, `tiles` e `url` das fontes, `glyphs` e `sprite`.
 * @param {any} style JSON do estilo
 * @param {string} styleUrl
 * @returns {string[]} origens únicas, ordenadas
 */
export function styleOrigins(style, styleUrl) {
  const origins = new Set([originOf(styleUrl, styleUrl)]);
  origins.add(originOf(style?.glyphs, styleUrl));
  const sprites = Array.isArray(style?.sprite) ? style.sprite.map((/** @type {any} */ s) => s?.url) : [style?.sprite];
  for (const sprite of sprites) origins.add(originOf(sprite, styleUrl));
  for (const source of Object.values(style?.sources ?? {})) {
    const s = /** @type {any} */ (source);
    origins.add(originOf(s?.url, styleUrl));
    for (const tile of Array.isArray(s?.tiles) ? s.tiles : []) origins.add(originOf(tile, styleUrl));
  }
  return [...origins].filter((o) => o !== null).sort();
}

/**
 * Baixa o estilo no build e devolve as origens para a CSP. Estilo que não baixa ou não é JSON falha o
 * build: a CSP sairia sem os hosts e o mapa quebraria em produção.
 * @param {string} styleUrl
 * @param {typeof fetch} fetchImpl
 */
export async function loadTileOrigins(styleUrl, fetchImpl = fetch) {
  // Estilo local (E2E, só fora de prod: o build-env recusa http em prod): sem rede no build, só a origem.
  if (new URL(styleUrl).hostname === "localhost") return [new URL(styleUrl).origin];
  const response = await fetchImpl(styleUrl, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`NEXT_PUBLIC_MAP_STYLE_URL respondeu ${response.status}.`);
  let style;
  try {
    style = await response.json();
  } catch {
    throw new Error("NEXT_PUBLIC_MAP_STYLE_URL não devolveu um estilo em JSON.");
  }
  const origins = new Set(styleOrigins(style, styleUrl));
  // Fonte com `url` é um TileJSON: os `tiles` de dentro dele podem estar em outro host (CDN). O build baixa cada um
  // e soma os hosts; um TileJSON que não baixa falha o build (a CSP sairia incompleta).
  for (const source of Object.values(style?.sources ?? {})) {
    const url = /** @type {any} */ (source)?.url;
    if (typeof url !== "string" || !/^https?:/.test(url)) continue;
    const meta = await fetchImpl(new URL(url, styleUrl).href, { headers: { Accept: "application/json" } });
    if (!meta.ok) throw new Error(`TileJSON ${url} respondeu ${meta.status}.`);
    /** @type {any} */
    let tilejson;
    try {
      tilejson = await meta.json();
    } catch {
      throw new Error(`TileJSON ${url} não devolveu JSON.`);
    }
    for (const tile of Array.isArray(tilejson?.tiles) ? tilejson.tiles : []) {
      const origin = originOf(tile, url);
      if (origin) origins.add(origin);
    }
  }
  return [...origins].sort();
}

/**
 * Origens extras da CSP para o que o build não enxerga (CDN de tiles que só aparece em tempo de execução).
 * `MAP_EXTRA_ORIGINS`: lista separada por vírgula, só https, sem caminho. Documentada no README.
 * @param {string | undefined} raw
 * @returns {string[]}
 */
export function parseExtraOrigins(raw) {
  return (raw ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      let url;
      try {
        url = new URL(item);
      } catch {
        throw new Error(`MAP_EXTRA_ORIGINS inválida: "${item}"`);
      }
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error(`MAP_EXTRA_ORIGINS aceita só origens https sem caminho: "${item}"`);
      }
      return url.origin;
    });
}
