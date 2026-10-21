import { apiFetch } from "@/features/session/runtime";
import { ApiError, isUuid } from "@/lib/api/errors";

/** `/v1/users/{id}` (telefone, endereço). O id vem da sessão e só vira caminho se for UUID. */
function userPath(id: string, rest = ""): string {
  if (!isUuid(id)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  return `/users/${id}${rest}`;
}

export interface Address {
  readonly postalCode: string;
  readonly street: string;
  readonly number: string;
  readonly complement: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
}

type Raw = Record<string, unknown>;
const text = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

export function parseAddress(value: unknown): Address {
  const raw: Raw = value !== null && typeof value === "object" ? (value as Raw) : {};
  return {
    postalCode: text(raw.postal_code),
    street: text(raw.street),
    number: text(raw.number),
    complement: text(raw.complement),
    neighborhood: text(raw.neighborhood),
    city: text(raw.city),
    state: text(raw.state),
  };
}

export const fetchAddress = async (userId: string, signal?: AbortSignal): Promise<Address> => parseAddress(await apiFetch<unknown>(userPath(userId, "/address"), { signal }));

export const updateAddress = async (userId: string, address: Address): Promise<Address> =>
  parseAddress(
    await apiFetch<unknown>(userPath(userId, "/address"), {
      method: "PUT",
      body: {
        postal_code: address.postalCode.replace(/\D/g, ""),
        street: address.street.trim(),
        number: Number(address.number),
        ...(address.complement.trim() ? { complement: address.complement.trim() } : {}),
        neighborhood: address.neighborhood.trim(),
        city: address.city.trim(),
        state: address.state.trim().toUpperCase(),
      },
    }),
  );

/** `PATCH /users/{id}`: o corpo é discriminado por `type`; o painel é só de loja. */
export async function updatePhone(userId: string, phoneDigits: string): Promise<void> {
  await apiFetch<unknown>(userPath(userId), { method: "PATCH", body: { type: "establishment", phone: phoneDigits } });
}

/** Troca de e-mail, como no app: código `update_email` no novo endereço, confirmação, e só então o PUT. */
export async function requestEmailCode(email: string): Promise<void> {
  await apiFetch<unknown>("/users/email-code", { method: "POST", body: { email: email.trim(), type: "update_email" } });
}

export async function confirmEmailCode(code: string): Promise<void> {
  await apiFetch<unknown>("/users/confirm-email-code", { method: "POST", body: { code } });
}

export async function updateEmail(userId: string, email: string): Promise<void> {
  await apiFetch<unknown>(userPath(userId, "/email"), { method: "PUT", body: { email: email.trim() } });
}

/** `PUT /users/{id}/password`: a API confere a senha atual e a confirmação. */
export async function updatePassword(userId: string, input: { current: string; next: string; confirm: string }): Promise<void> {
  await apiFetch<unknown>(userPath(userId, "/password"), {
    method: "PUT",
    body: { old_password: input.current, password: input.next, confirm_password: input.confirm },
  });
}

/** `DELETE /users/{id}`: exclui a conta (a API desativa e anonimiza). */
export async function deleteAccount(userId: string): Promise<void> {
  await apiFetch<unknown>(userPath(userId), { method: "DELETE" });
}
