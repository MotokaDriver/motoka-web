// @ts-check
// Lista os `error_code` da API sem texto no catálogo do painel (§5.6). O catálogo fica atrás da API
// em silêncio (memória do projeto): rode a cada WN e na revisão. Caminho da API por env
// (MOTOKA_API_DIR, padrão ../../motoka-api). Sem o checkout da API, avisa e sai com 0 (CI).
// Mesma extração do comentário de motoka_app/lib/src/core/errors/api_error_codes.dart.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.resolve(process.env.MOTOKA_API_DIR ?? path.join(root, "../../motoka-api"));
const appsDir = path.join(apiDir, "src/apps");

if (!fs.existsSync(appsDir)) {
  console.log(`check-error-codes: ${appsDir} não existe; nada a conferir.`);
  process.exit(0);
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function exceptionFiles(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...exceptionFiles(full));
    else if (entry.name === "exceptions.py") found.push(full);
  }
  return found;
}

const apiCodes = new Set();
for (const file of exceptionFiles(appsDir)) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(/error_code(?:\s*:\s*str)?\s*=\s*"([A-Z0-9_]+)"/g)) apiCodes.add(match[1]);
}

const catalog = fs.readFileSync(path.join(root, "src/lib/errors/catalog.ts"), "utf8");
const known = new Set([...catalog.matchAll(/^\s{2}([A-Z0-9_]+):/gm)].map((m) => m[1]));

const missing = [...apiCodes].filter((code) => !known.has(code)).sort();
console.log(`check-error-codes: ${apiCodes.size} códigos na API, ${known.size} no catálogo do painel.`);
if (missing.length > 0) {
  console.log(`Sem texto no painel (caem no fallback por status):\n- ${missing.join("\n- ")}`);
  process.exitCode = process.env.CHECK_ERROR_CODES_STRICT ? 1 : 0;
}
