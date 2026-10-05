// @ts-check
// CSP sem nonce (DN-05): tira os <script> inline que o Next grava em todo HTML exportado
// (`self.__next_f.push(...)`) e os grava como arquivos do próprio site em /_csp/<sha256>.js.
// Cada script vira um <script src> síncrono na MESMA posição, o que preserva a ordem de execução.
// Scripts de dados (type="application/json" e afins) não executam e ficam como estão.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const EXECUTABLE_TYPES = new Set(["", "text/javascript", "application/javascript", "module"]);

/**
 * @param {string} attrs
 * @returns {string} o `type` em minúsculas, ou "" sem type
 */
function scriptType(attrs) {
  const match = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  return (match ? match[1] ?? match[2] ?? match[3] ?? "" : "").trim().toLowerCase();
}

/**
 * Regrava um HTML. Devolve o HTML novo e os arquivos a criar (nome → conteúdo).
 * @param {string} html
 * @returns {{ html: string, files: Map<string, string> }}
 */
export function externalizeScripts(html) {
  /** @type {Map<string, string>} */
  const files = new Map();
  const out = html.replace(SCRIPT_RE, (whole, attrs, body) => {
    if (/\bsrc\s*=/i.test(attrs)) return whole;
    const type = scriptType(attrs);
    if (!EXECUTABLE_TYPES.has(type)) return whole;
    if (body.trim() === "") return "";
    const hash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 32);
    const name = `${hash}.js`;
    files.set(name, body);
    // Sem async/defer: síncrono, como o inline que substitui. Mantém type="module" se houver.
    const keep = type === "module" ? ' type="module"' : "";
    const id = /\bid\s*=\s*"([^"]*)"/i.exec(attrs);
    const idAttr = id ? ` id="${id[1]}"` : "";
    return `<script src="/_csp/${name}"${keep}${idAttr}></script>`;
  });
  return { html: out, files };
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
export function listHtml(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listHtml(full));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

/**
 * Aplica a externalização em todo `out/**\/*.html`.
 * @param {string} outDir
 * @param {{ skip?: (file: string) => boolean }} [options]
 * @returns {{ pages: number, scripts: number }}
 */
export function externalizeOut(outDir, options = {}) {
  const cspDir = path.join(outDir, "_csp");
  fs.mkdirSync(cspDir, { recursive: true });
  let pages = 0;
  let scripts = 0;
  for (const file of listHtml(outDir)) {
    if (options.skip?.(file)) continue;
    const { html, files } = externalizeScripts(fs.readFileSync(file, "utf8"));
    if (files.size === 0) continue;
    for (const [name, body] of files) fs.writeFileSync(path.join(cspDir, name), body);
    fs.writeFileSync(file, html);
    pages += 1;
    scripts += files.size;
  }
  return { pages, scripts };
}
