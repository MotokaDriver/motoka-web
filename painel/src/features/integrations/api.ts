import { apiFetch } from "@/features/session/runtime";
import { ApiError } from "@/lib/api/errors";
import { parseActivity, parseCards, parseDetail, parseIssued, parseTest, type ActivityPage, type Card, type Detail, type IntegrationType, type Issued, type TestResult } from "./model";

/** `/v1/integrations`. O tipo vem de uma lista fechada, nunca de texto livre (vira caminho). */
const CONNECTABLE: readonly IntegrationType[] = ["open_delivery", "saipos"];

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
