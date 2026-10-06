// @ts-check
// Mede o JS do primeiro carregamento do login: a soma gzip dos scripts `/_next/*.js` do
// `out/entrar/index.html`, sem os `noModule` (polyfill de navegador antigo). Mesmo método da revisão do
// WN-1/WN-2. Teto de aceite: 220 KiB (WN-plano §15.5). Uso: `yarn build && yarn size:login`.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out");
const ROUTES = ["entrar", "equipe", "pedidos"];
const LIMIT_KIB = 220;

/** @param {string} route */
function measure(route) {
  const html = fs.readFileSync(path.join(out, route, "index.html"), "utf8");
  let bytes = 0;
  let files = 0;
  for (const match of html.matchAll(/<script([^>]*)src="(\/_next\/[^"]+\.js)[^"]*"[^>]*>/g)) {
    if (/noModule/i.test(match[0])) continue;
    bytes += zlib.gzipSync(fs.readFileSync(path.join(out, match[2]))).length;
    files += 1;
  }
  return { files, kib: bytes / 1024, kb: bytes / 1000 };
}

/** "Acompanhar pedido" (/r/): HTML + JS + CSS na primeira carga, teto de 30 KiB gz (WN-6). */
const R_LIMIT_KIB = 30;
function measureR() {
  const files = [path.join(out, "r", "index.html"), path.join(out, "_static", "r", "r.js"), path.join(out, "_static", "r", "r.css")];
  const bytes = files.reduce((sum, file) => sum + zlib.gzipSync(fs.readFileSync(file)).length, 0);
  return bytes / 1024;
}

let failed = false;
for (const route of ROUTES) {
  const { files, kib, kb } = measure(route);
  const login = route === "entrar";
  console.log(`${route.padEnd(8)} ${kib.toFixed(1)} KiB gz (${kb.toFixed(1)} kB, ${files} scripts)${login ? ` · teto ${LIMIT_KIB} KiB` : ""}`);
  if (login && kib > LIMIT_KIB) failed = true;
}
const rKib = measureR();
console.log(`r        ${rKib.toFixed(1)} KiB gz (HTML + JS + CSS) · teto ${R_LIMIT_KIB} KiB`);
if (rKib > R_LIMIT_KIB) failed = true;
if (failed) {
  console.error(`Um teto de bundle foi estourado (login ${LIMIT_KIB} KiB, /r/ ${R_LIMIT_KIB} KiB).`);
  process.exit(1);
}
