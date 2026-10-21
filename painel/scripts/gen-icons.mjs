// @ts-check
// Gera src/icons/registry.ts com só os ícones usados (DN-10): Material Symbols Rounded, peso 400,
// de @material-symbols/svg-400. Sem fonte de ícones e sem host externo na CSP.
// Uso: yarn icons (depois de mudar scripts/icons.json).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "node_modules/@material-symbols/svg-400/rounded");
/** @type {{ outline: string[], filled: string[], extra: string[], extraFilled: string[] }} */
const list = JSON.parse(fs.readFileSync(path.join(root, "scripts/icons.json"), "utf8"));

/** @param {string} file */
function pathsOf(file) {
  const svg = fs.readFileSync(path.join(source, file), "utf8");
  if (!svg.includes('viewBox="0 -960 960 960"')) throw new Error(`viewBox inesperado em ${file}`);
  const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
  if (paths.length === 0) throw new Error(`sem <path> em ${file}`);
  return paths;
}

const outline = Object.fromEntries(list.outline.map((name) => [name, pathsOf(`${name}.svg`)]));
const filled = Object.fromEntries(list.filled.map((name) => [name, pathsOf(`${name}-fill.svg`)]));

const out = `// GERADO por scripts/gen-icons.mjs. Não edite à mão: mude scripts/icons.json e rode \`yarn icons\`.
// Material Symbols Rounded (peso 400), Apache-2.0, Google.
export const ICONS = ${JSON.stringify(outline, null, 2)} as const;

export const FILLED_ICONS: Partial<Record<keyof typeof ICONS, readonly string[]>> = ${JSON.stringify(filled, null, 2)};

export type IconName = keyof typeof ICONS;
`;
fs.writeFileSync(path.join(root, "src/icons/registry.ts"), out);

// Ícones só da tela Minha equipe: ficam fora do primeiro carregamento (login) e são registrados por
// features/team/icons.ts (aceite do WN-1: login <= 220 KB gz).
const extra = Object.fromEntries(list.extra.map((name) => [name, pathsOf(`${name}.svg`)]));
const extraFilled = Object.fromEntries(list.extraFilled.map((name) => [name, pathsOf(`${name}-fill.svg`)]));
const extraOut = `// GERADO por scripts/gen-icons.mjs. Não edite à mão: mude scripts/icons.json e rode \`yarn icons\`.
export const EXTRA_ICONS = ${JSON.stringify(extra, null, 2)} as const;

export const EXTRA_FILLED_ICONS: Record<string, readonly string[]> = ${JSON.stringify(extraFilled, null, 2)};
`;
fs.writeFileSync(path.join(root, "src/icons/extra.ts"), extraOut);
console.log(`${list.outline.length} ícones, ${list.filled.length} preenchidos.`);
