/**
 * URLs montadas com dados (§6.2): esquema em allowlist, host conferido quando o link é nosso,
 * texto sempre em `encodeURIComponent`. Nada aqui aceita `javascript:` ou `data:`.
 */

/** Só dígitos; celular BR com DDD vira +55. `null` quando não parece telefone. */
export function phoneDigits(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  return `55${digits}`;
}

export function telLink(raw: string): string | null {
  const digits = phoneDigits(raw);
  return digits ? `tel:+${digits}` : null;
}

/** `https://wa.me/<telefone>?text=…`, ou sem telefone para o usuário escolher o contato. */
export function whatsappLink(text: string, phone?: string | null): string | null {
  const encoded = encodeURIComponent(text);
  if (phone === undefined || phone === null) return `https://wa.me/?text=${encoded}`;
  const digits = phoneDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : null;
}

/**
 * Valida uma URL que a API devolveu e que o painel vai mostrar ou abrir (link do convite, link de
 * rastreio): `https:` (ou `http://localhost` fora de prod) e o host exatamente o esperado.
 */
export function trustedUrl(
  raw: string,
  expectedHost: string,
  { allowLocalhost = false }: { allowLocalhost?: boolean } = {},
): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const local = allowLocalhost && url.protocol === "http:" && url.hostname === "localhost";
  if (url.protocol !== "https:" && !local) return null;
  if (url.host !== expectedHost) return null;
  return url.href;
}
