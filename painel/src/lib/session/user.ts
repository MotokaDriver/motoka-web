import { type Infer, z } from "@/lib/zod";
import { ApiError, apiErrorFromResponse, isUuid } from "@/lib/api/errors";
import { API_BASE } from "@/lib/env";

/**
 * O que o painel lê de `GET /v1/users/{id}` (não existe `/users/me`: o id vem do `sub` do JWT).
 * O schema é tolerante a campos novos e só exige o que o painel usa.
 */
const addressSchema = z.nullish(
  z.object({
    street: z.nullish(z.string()),
    number: z.nullish(z.union([z.number(), z.string()])),
    neighborhood: z.nullish(z.string()),
    city: z.nullish(z.string()),
    state: z.nullish(z.string()),
  }),
);

export const panelUserSchema = z.object({
  id: z.string().check(z.minLength(1)),
  full_name: z.string(),
  type: z.string(),
  email: z.nullish(z.string()),
  phone: z.nullish(z.string()),
  document_number: z.nullish(z.string()),
  corporate_reason: z.nullish(z.string()),
  address: addressSchema,
});

export type PanelUser = Infer<typeof panelUserSchema>;

export const ESTABLISHMENT = "establishment";

/** Mesmo critério do app: a razão social, senão o nome. */
export function storeName(user: PanelUser): string {
  const corporate = user.corporate_reason?.trim();
  return corporate ? corporate : user.full_name.trim();
}

/** "Rua, número", ou `null` sem endereço (a linha some do rodapé). */
export function storeAddress(user: PanelUser): string | null {
  const street = user.address?.street?.trim();
  if (!street) return null;
  const number = user.address?.number;
  return number !== null && number !== undefined && `${number}`.trim() !== ""
    ? `${street}, ${number}`
    : street;
}

/** Primeira letra da primeira e da última palavra ("Pizzaria do Zé" → "PZ"). */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) return "?";
  if (words.length === 1) return first.charAt(0).toUpperCase();
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/** `GET /v1/users/{sub}` com o access recém-obtido, sem o fluxo de refresh do `apiFetch`. */
export async function fetchPanelUser(accessToken: string, sub: string): Promise<PanelUser> {
  // O `sub` vira caminho da API: só um UUID (ressalva 12).
  if (!isUuid(sub)) throw new ApiError({ status: 400, code: "PANEL_INVALID_SUBJECT" });
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/users/${encodeURIComponent(sub)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError({ status: null });
  }
  if (!response.ok) throw await apiErrorFromResponse(response);
  const parsed = panelUserSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new ApiError({ status: response.status, code: "PANEL_USER_UNREADABLE" });
  return parsed.data;
}
