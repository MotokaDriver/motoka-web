// @ts-check
// Pós-build do painel (WN-0): roda depois do `next build`.
// 1. externaliza os scripts inline do Next (CSP `script-src 'self'`, DN-05) e grava os
//    payloads de prefetch com o nome que o cliente pede (flatten-segments.mjs);
// 2. copia o convite e o /r/ com a URL da API (DN-16, DN-17);
// 3. gera _headers (variante prod ou não-prod) e copia _redirects;
// 4. verifica o out/ (sem inline, sem on*=, sem javascript:, sem segredo, 404.html presente).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBuildEnv } from "./build-env.mjs";
import { renderHeaders } from "./build-headers.mjs";
import { copyMaplibreWorker, loadTileOrigins, parseExtraOrigins } from "./map-assets.mjs";
import { copyStaticPages } from "./copy-static.mjs";
import { externalizeOut } from "./csp-externalize.mjs";
import { flattenSegments } from "./flatten-segments.mjs";
import { verifyOut } from "./verify-out.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out");

if (!fs.existsSync(path.join(outDir, "index.html"))) {
  throw new Error("out/ não existe: rode o `next build` antes do pós-build.");
}

const env = resolveBuildEnv(process.env);

const csp = externalizeOut(outDir);
const segments = flattenSegments(outDir);
copyStaticPages(path.join(root, "static-pages"), outDir, `${env.apiUrl}/v1`);
// Mapa (WN-3): worker no mesmo site e hosts do estilo na CSP (tiles, glyphs, sprite).
const mapVersion = copyMaplibreWorker(root, outDir);
const tileOrigins = [...new Set([...(env.mapStyleUrl ? await loadTileOrigins(env.mapStyleUrl) : []), ...parseExtraOrigins(process.env.MAP_EXTRA_ORIGINS)])].sort();
fs.writeFileSync(
  path.join(outDir, "_headers"),
  renderHeaders(fs.readFileSync(path.join(root, "headers.template"), "utf8"), {
    appEnv: env.appEnv,
    apiUrl: env.apiUrl,
    tileOrigins,
  }),
);
fs.copyFileSync(path.join(root, "_redirects"), path.join(outDir, "_redirects"));
const checked = verifyOut(outDir);

console.log(
  `pós-build (${env.appEnv}): ${csp.scripts} scripts inline externalizados em ${csp.pages} páginas; ` +
    `${segments} payloads de segmento; ${checked.html} HTML verificados; API ${env.apiUrl}; MapLibre ${mapVersion}` +
    `${tileOrigins.length ? `; tiles ${tileOrigins.join(", ")}` : "; sem estilo de mapa"}.`,
);
