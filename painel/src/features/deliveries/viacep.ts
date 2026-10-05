/**
 * ViaCEP (`connect-src` já liberado na CSP). Sem credenciais e sem cookies: é um host de terceiros.
 * Nenhuma falha vira erro na tela do pedido: busca de rua é um atalho, o endereço segue digitável.
 */
const HOST = "https://viacep.com.br/ws";

export interface StreetSuggestion {
  readonly street: string;
  readonly neighborhood: string;
  readonly zip: string;
}

export interface ZipResult {
  readonly street: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { credentials: "omit", cache: "no-store", signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("viacep");
  return response.json();
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** Busca reversa `/ws/{UF}/{cidade}/{rua}/json/` (a partir de 3 letras), até 8 sugestões. */
export async function searchStreet(state: string, city: string, street: string, signal?: AbortSignal): Promise<StreetSuggestion[]> {
  if (!/^[A-Za-z]{2}$/.test(state) || city.trim().length < 3 || street.trim().length < 3) return [];
  const url = `${HOST}/${state.toUpperCase()}/${encodeURIComponent(city.trim())}/${encodeURIComponent(street.trim())}/json/`;
  const body = await getJson(url, signal);
  if (!Array.isArray(body)) return [];
  return body.slice(0, 8).map((item: Record<string, unknown>) => ({
    street: text(item.logradouro),
    neighborhood: text(item.bairro),
    zip: text(item.cep),
  })).filter((s) => s.street !== "");
}

/** CEP de 8 dígitos; `null` quando não existe. */
export async function lookupZip(zip: string, signal?: AbortSignal): Promise<ZipResult | null> {
  const digits = zip.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const body = (await getJson(`${HOST}/${digits}/json/`, signal)) as Record<string, unknown>;
  if (!body || body.erro === true || body.erro === "true") return null;
  return { street: text(body.logradouro), neighborhood: text(body.bairro), city: text(body.localidade), state: text(body.uf) };
}
