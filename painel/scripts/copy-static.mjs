// @ts-check
// Copia as páginas sem framework (DN-16 convite, DN-17 /r/) de static-pages/ para out/, gravando a
// URL da API na <meta name="motoka-api">. A pasta não se chama `static/` porque o Next copia uma
// pasta `static/` da raiz do projeto para o export (recurso legado).
import fs from "node:fs";
import path from "node:path";

export const API_PLACEHOLDER = "__MOTOKA_API__";
const PAGES = ["convite", "r"];

/**
 * @param {string} html
 * @param {string} apiBase origem da API + "/v1"
 */
export function injectApiMeta(html, apiBase) {
  if (!/^https?:\/\/[^\s/"<>]+\/v1$/.test(apiBase)) throw new Error(`Base da API inválida: ${apiBase}`);
  return html.replaceAll(API_PLACEHOLDER, apiBase);
}

/**
 * @param {string} sourceDir static-pages/
 * @param {string} outDir
 * @param {string} apiBase
 */
export function copyStaticPages(sourceDir, outDir, apiBase) {
  for (const page of PAGES) {
    const from = path.join(sourceDir, page);
    if (!fs.existsSync(from)) continue;
    // O HTML vai para out/<página>/; o resto para out/_static/<página>/, fora do alcance da
    // reescrita `/<página>/* -> /<página>/` do _redirects.
    const htmlDir = path.join(outDir, page);
    const assetDir = path.join(outDir, "_static", page);
    for (const dir of [htmlDir, assetDir]) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }
    for (const entry of fs.readdirSync(from)) {
      const content = fs.readFileSync(path.join(from, entry), "utf8");
      if (entry.endsWith(".html")) fs.writeFileSync(path.join(htmlDir, entry), injectApiMeta(content, apiBase));
      else fs.writeFileSync(path.join(assetDir, entry), content);
    }
  }
}
