// @ts-check
// Ativos do mapa (WN-3, DN-11): o worker do MapLibre fica no mesmo site (`worker-src 'self'`, sem
// `blob:`). Roda no pós-build. Os tiles do Google (WN-3b) têm host fixo: a CSP sai do build-env, sem baixar estilo.
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
