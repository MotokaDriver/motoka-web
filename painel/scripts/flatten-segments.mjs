// @ts-check
// O export do Next 16 grava os payloads de prefetch por segmento em pastas
// (`ao-vivo/__next.!KGFwcCk/!KHNoZWxsKQ/ao-vivo/__PAGE__.txt`), mas o cliente pede o nome com
// pontos (`ao-vivo/__next.!KGFwcCk.!KHNoZWxsKQ.ao-vivo.__PAGE__.txt`). O `next start` resolve isso;
// um host de arquivos estáticos não. Este passo grava uma cópia com o nome que o cliente pede,
// sem o 404 (e o erro de console) em cada prefetch de link da sidebar.
import fs from "node:fs";
import path from "node:path";

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
 * @returns {number} quantos arquivos foram gravados
 */
export function flattenSegments(outDir) {
  let written = 0;
  /** @param {string} dir */
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name.startsWith("__next.")) {
        for (const file of listFiles(full)) {
          const relative = path.relative(full, file).split(path.sep).join(".");
          fs.copyFileSync(file, path.join(dir, `${entry.name}.${relative}`));
          written += 1;
        }
      } else if (!entry.name.startsWith("_next") && !entry.name.startsWith("_csp")) {
        walk(full);
      }
    }
  };
  walk(outDir);
  return written;
}
