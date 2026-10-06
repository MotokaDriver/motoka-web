import { apiFetch } from "@/features/session/runtime";
import { ApiError, isUuid } from "@/lib/api/errors";
import { parseActivity, parseCards, parseDetail, parseIssued, parseTest, type ActivityPage, type Card, type Detail, type IntegrationType, type Issued, type TestResult } from "./model";

/** `/v1/integrations`. O tipo vem de uma lista fechada, nunca de texto livre (vira caminho). */
const CONNECTABLE: readonly IntegrationType[] = ["open_delivery", "saipos", "cardapio_web"];

function path(type: IntegrationType, rest = ""): string {
  if (!CONNECTABLE.includes(type)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  return `/integrations/${type}${rest}`;
}

export const fetchCards = async (signal?: AbortSignal): Promise<readonly Card[]> => parseCards(await apiFetch<unknown>("/integrations", { signal }));

/** `null` quando a loja ainda não salvou nada para o tipo (404 `INTEGRATION_NOT_FOUND`): a tela mostra o formulário vazio. */
export async function fetchDetail(type: IntegrationType, signal?: AbortSignal): Promise<Detail | null> {
  try {
    return parseDetail(await apiFetch<unknown>(path(type), { signal }));
  } catch (failure) {
    if (failure instanceof ApiError && failure.code === "INTEGRATION_NOT_FOUND") return null;
    throw failure;
  }
}

export interface SaveInput {
  readonly merchantId: string | null;
  readonly webhookUrl: string | null;
  /** String decimal ("0.00"). */
  readonly deliveryPrice: string;
}

export const saveIntegration = async (type: IntegrationType, input: SaveInput): Promise<Detail> =>
  parseDetail(
    await apiFetch<unknown>(path(type), {
      method: "PUT",
      body: { external_merchant_id: input.merchantId, webhook_url: input.webhookUrl, delivery_price: input.deliveryPrice },
    }),
  );

/** A única resposta com o secret inteiro. Quem chama guarda só no estado do componente. */
export const issueCredentials = async (type: IntegrationType): Promise<Issued> => parseIssued(await apiFetch<unknown>(path(type, "/credentials"), { method: "POST" }));

export const testConnection = async (type: IntegrationType): Promise<TestResult> => parseTest(await apiFetch<unknown>(path(type, "/test"), { method: "POST" }));

export const disconnectIntegration = async (type: IntegrationType): Promise<void> => {
  await apiFetch<unknown>(path(type), { method: "DELETE" });
};

export const fetchActivity = async (cursor: string | null, signal?: AbortSignal): Promise<ActivityPage> =>
  parseActivity(await apiFetch<unknown>("/integrations/activity", { query: { cursor }, signal }));

// --- OAuth e vínculo de entregadores (Cardápio Web, WS-15) ---------------------------------

/** Passo 1 do PKCE: a API gera o `state` e o `code_verifier` (fica no cofre dela) e devolve a URL do portal do parceiro. */
export async function startAuthorization(type: IntegrationType): Promise<{ authorizeUrl: string; expiresIn: number }> {
  const body = await apiFetch<unknown>(path(type, "/authorize"), { method: "POST" });
  const raw = body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (typeof raw.authorize_url !== "string" || raw.authorize_url === "") throw new ApiError({ status: 200, code: "RESPONSE_UNREADABLE" });
  return { authorizeUrl: raw.authorize_url, expiresIn: typeof raw.expires_in === "number" ? raw.expires_in : 600 };
}

/** Passo 2: troca o `code` (a API confere o `state`, o prazo e o uso único). */
/** `connected` conectou; `incomplete` autorizou, mas faltou a loja; outro valor, a conexão não concluiu. */
export type CompleteState = "connected" | "incomplete" | "other";

export async function completeAuthorization(type: IntegrationType, code: string, state: string): Promise<CompleteState> {
  const body = await apiFetch<unknown>(path(type, "/authorize/complete"), { method: "POST", body: { code, state } });
  const result = body !== null && typeof body === "object" ? (body as { state?: unknown }).state : null;
  return result === "connected" ? "connected" : result === "incomplete" ? "incomplete" : "other";
}

export async function syncProvider(type: IntegrationType): Promise<number> {
  const body = await apiFetch<unknown>(path(type, "/sync"), { method: "POST" });
  return body !== null && typeof body === "object" && typeof (body as { queued?: unknown }).queued === "number" ? (body as { queued: number }).queued : 0;
}

export interface TeamDriver {
  readonly driverId: string;
  readonly name: string;
  readonly externalDriverId: string | null;
  readonly externalDriverName: string | null;
}

export interface ExternalDriver {
  readonly id: string;
  readonly name: string;
}

/** Vínculo de quem já saiu da equipe: a loja só pode remover. */
export interface OrphanLink {
  readonly driverId: string;
  readonly externalDriverId: string;
  readonly externalDriverName: string | null;
}

export interface ProviderDrivers {
  readonly team: readonly TeamDriver[];
  readonly orphans: readonly OrphanLink[];
  readonly external: readonly ExternalDriver[];
}

export async function fetchProviderDrivers(type: IntegrationType, signal?: AbortSignal): Promise<ProviderDrivers> {
  const body = await apiFetch<unknown>(path(type, "/drivers"), { signal });
  const raw = body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const list = (value: unknown): Array<Record<string, unknown>> => (Array.isArray(value) ? value.filter((v): v is Record<string, unknown> => v !== null && typeof v === "object") : []);
  const text = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
  return {
    team: list(raw.team).map((m) => ({ driverId: text(m.driver_id), name: text(m.name), externalDriverId: text(m.external_driver_id) || null, externalDriverName: text(m.external_driver_name) || null })),
    orphans: list(raw.orphans).map((o) => ({ driverId: text(o.driver_id), externalDriverId: text(o.external_driver_id), externalDriverName: text(o.external_driver_name) || null })),
    external: list(raw.external).map((e) => ({ id: text(e.id), name: text(e.name) })),
  };
}

function linkPath(type: IntegrationType, driverId: string): string {
  if (!isUuid(driverId)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  return path(type, `/driver-links/${driverId}`);
}

export async function putDriverLink(type: IntegrationType, driverId: string, externalDriverId: string): Promise<void> {
  await apiFetch<unknown>(linkPath(type, driverId), { method: "PUT", body: { external_driver_id: externalDriverId } });
}

export async function deleteDriverLink(type: IntegrationType, driverId: string): Promise<void> {
  await apiFetch<unknown>(linkPath(type, driverId), { method: "DELETE" });
}
