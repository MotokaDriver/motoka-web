// @ts-check
// Verificação do out/ antes de publicar (DN-05, §6.4, WN-0 critério 1). Qualquer achado falha o
// build: script inline executável, atributo on*=, `javascript:`, padrão de segredo, ou arquivo
// obrigatório ausente.
import fs from "node:fs";
import path from "node:path";
import { listHtml } from "./csp-externalize.mjs";

const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const EVENT_ATTR_RE = /<[a-z][^>]*\son[a-z]+\s*=/i;
const JS_URL_RE = /(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/i;
// `client_secret` em qualquer forma é vazamento (JSON, JSON escapado no payload RSC, query, env), menos o acesso por
// propriedade (`t.client_secret`): é o nome do campo da API que a tela de Integrações (WN-4b) lê na resposta de credenciais.
export const SECRET_RES = [/(?<![.\w])client_secret/i, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /AKIA[0-9A-Z]{16}/, /sk_live_[0-9a-zA-Z]+/];

const REQUIRED = [
  "index.html",
  "404.html",
  "entrar/index.html",
  "ao-vivo/index.html",
  "convite/index.html",
  "_static/convite/convite.js",
  "r/index.html",
  "theme-init.js",
  ".well-known/assetlinks.json",
  ".well-known/apple-app-site-association",
  "_headers",
  "_redirects",
];

/**
 * @param {string} html
 * @returns {string[]} problemas encontrados
 */
export function inspectHtml(html) {
  /** @type {string[]} */
  const problems = [];
  let match;
  SCRIPT_RE.lastIndex = 0;
  while ((match = SCRIPT_RE.exec(html))) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = (/\btype\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "").toLowerCase();
    const executable = type === "" || type === "module" || type.includes("javascript");
    if (executable && body.trim() !== "") problems.push("script inline");
  }
  if (EVENT_ATTR_RE.test(html)) problems.push("atributo on*=");
  if (JS_URL_RE.test(html)) problems.push("URL javascript:");
  return problems;
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listFiles(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(full));
    else found.push(full);
  }
  return found;
}

/**
 * @param {string} outDir
 * @returns {{ html: number, files: number }}
 */
export function verifyOut(outDir) {
  /** @type {string[]} */
  const problems = [];
  for (const required of REQUIRED) {
    if (!fs.existsSync(path.join(outDir, required))) problems.push(`ausente: ${required}`);
  }
  const htmlFiles = listHtml(outDir);
  for (const file of htmlFiles) {
    for (const problem of inspectHtml(fs.readFileSync(file, "utf8"))) {
      problems.push(`${path.relative(outDir, file)}: ${problem}`);
    }
  }
  const textFiles = listFiles(outDir).filter((file) => /\.(html|js|mjs|json|txt|css|map)$/.test(file) || !path.extname(file));
  for (const file of textFiles) {
    const content = fs.readFileSync(file, "utf8");
    for (const re of SECRET_RES) {
      if (re.test(content)) problems.push(`${path.relative(outDir, file)}: padrão de segredo ${re}`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Verificação do out/ falhou:\n- ${problems.join("\n- ")}`);
  }
  return { html: htmlFiles.length, files: textFiles.length };
}
