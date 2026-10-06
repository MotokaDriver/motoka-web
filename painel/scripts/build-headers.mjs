// @ts-check
// Gera out/_headers a partir de headers.template e das variáveis de build (§6.1).
// {UIR} e {HSTS} só existem em prod (ressalva 7): nos builds de dev/E2E servidos em
// http://localhost, upgrade-insecure-requests promoveria a API local para https e o HSTS ficaria
// gravado no localhost.

export const MAX_RULES = 100;
export const MAX_LINE = 2000;

/**
 * @param {string} template
 * @param {{ appEnv: string, apiUrl: string, tileOrigins?: string[] }} env
 * @returns {string}
 */
export function renderHeaders(template, env) {
  const prod = env.appEnv === "prod";
  const tiles = (env.tileOrigins ?? []).map((origin) => ` ${origin}`).join("");
  const lines = template
    .split(/\r?\n/)
    .filter((line) => !line.startsWith("#"))
    .map((line) =>
      line
        .replaceAll("{API}", new URL(env.apiUrl).origin)
        .replaceAll("{TILES}", tiles)
        .replaceAll("{UIR}", prod ? "; upgrade-insecure-requests" : "")
        .replaceAll("{HSTS}", prod ? "Strict-Transport-Security: max-age=31536000; includeSubDomains" : ""),
    )
    .filter((line) => line.trim() !== "");
  const output = `${lines.join("\n")}\n`;
  validateHeaders(output);
  return output;
}

/**
 * Limites do Workers Static Assets: 100 regras e 2.000 caracteres por linha.
 * @param {string} headers
 */
export function validateHeaders(headers) {
  const lines = headers.split("\n").filter(Boolean);
  const rules = lines.filter((line) => !/^\s/.test(line));
  if (rules.length > MAX_RULES) throw new Error(`_headers com ${rules.length} regras (máx. ${MAX_RULES}).`);
  for (const line of lines) {
    if (line.length > MAX_LINE) throw new Error(`_headers com linha de ${line.length} caracteres (máx. ${MAX_LINE}).`);
    if (/[{}]/.test(line)) throw new Error(`_headers com marcador não substituído: ${line}`);
  }
}
