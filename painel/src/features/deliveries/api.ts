import { apiFetch } from "@/features/session/runtime";
import { ApiError, isUuid } from "@/lib/api/errors";
import {
  parseDetail,
  parseList,
  parseLookup,
  type CustomerLookup,
  type DeliveryDetail,
  type DeliveryList,
} from "./model";

/** `/v1/deliveries/*` (E1–E16 da WS-02). `API_BASE` já traz o `/v1`. Todo id passa por `isUuid`. */
const BASE = "/deliveries";

function idPath(id: string): string {
  if (!isUuid(id)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  return `${BASE}/${id}`;
}

export const PAGE_SIZE = 100;

export interface ListParams {
  readonly scope: "open" | "all";
  /** Dia de SP; só com `scope=all`. "Em aberto" nunca manda `date` (pedido que atravessa a meia-noite). */
  readonly date?: string;
  readonly offset?: number;
  readonly limit?: number;
}

export const fetchList = async (params: ListParams, signal?: AbortSignal): Promise<DeliveryList> =>
  parseList(
    await apiFetch<unknown>(BASE, {
      query: {
        scope: params.scope,
        date: params.scope === "all" ? params.date : undefined,
        limit: params.limit ?? PAGE_SIZE,
        offset: params.offset ?? 0,
      },
      signal,
    }),
  );

export const fetchDelivery = async (id: string, signal?: AbortSignal): Promise<DeliveryDetail> =>
  parseDetail(await apiFetch<unknown>(idPath(id), { signal }));

export const lookupCustomer = async (phone: string, signal?: AbortSignal): Promise<CustomerLookup> =>
  parseLookup(await apiFetch<unknown>(`${BASE}/customers/lookup`, { method: "POST", body: { phone }, signal }));

async function act(id: string, path: string, body: Record<string, unknown>): Promise<DeliveryDetail> {
  return parseDetail(await apiFetch<unknown>(`${idPath(id)}/${path}`, { method: "POST", body }));
}

export const markReady = (id: string, actionId: string) => act(id, "ready", { action_id: actionId });
export const retryDelivery = (id: string, actionId: string) => act(id, "retry", { action_id: actionId });
export const confirmReturn = (id: string, actionId: string) => act(id, "confirm-return", { action_id: actionId });
export const cancelDelivery = (id: string, actionId: string, reason: string) =>
  act(id, "cancel", { action_id: actionId, reason });
export const confirmDelivery = (id: string, actionId: string, reason: string, description: string | null) =>
  act(id, "confirm-delivery", { action_id: actionId, reason, ...(description ? { description } : {}) });
export const assignDriver = (id: string, actionId: string, driverId: string) => {
  if (!isUuid(driverId)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  return act(id, "assign", { action_id: actionId, driver_id: driverId });
};
/** E10: corrigir o endereço até a retirada (o corpo é o `AddressIn` do E1 mais o `action_id`). */
export const updateAddress = async (
  id: string,
  actionId: string,
  address: { street: string; number: string; neighborhood: string | null; city: string; state: string; zipCode: string | null; complement: string | null; reference: string | null },
): Promise<DeliveryDetail> =>
  parseDetail(
    await apiFetch<unknown>(`${idPath(id)}/address`, {
      method: "PUT",
      body: {
        action_id: actionId,
        street: address.street.trim(),
        number: address.number.trim(),
        neighborhood: address.neighborhood,
        city: address.city.trim(),
        state: address.state.trim().toUpperCase(),
        zip_code: address.zipCode,
        complement: address.complement,
        reference: address.reference,
      },
    }),
  );

export const unassignDriver = (id: string, actionId: string) => act(id, "unassign", { action_id: actionId });
export const afterCancelAck = (id: string, charged: boolean, amount: string | null) =>
  act(id, "after-cancel-ack", { charged, ...(charged && amount ? { charged_amount: amount } : {}) });

/** E11: a loja enviou o link do cliente (idempotente). */
export async function trackingLinkSent(id: string): Promise<void> {
  await apiFetch<unknown>(`${idPath(id)}/tracking-link/sent`, { method: "POST" });
}

export interface CreateDeliveryInput {
  readonly clientRequestId: string;
  readonly channel: "whatsapp" | "phone" | "counter";
  readonly customerName: string;
  readonly customerPhone: string | null;
  readonly address: {
    readonly street: string;
    readonly number: string;
    readonly neighborhood: string | null;
    readonly city: string;
    readonly state: string;
    readonly zipCode: string | null;
    readonly complement: string | null;
    readonly reference: string | null;
    readonly lat: number | null;
    readonly lng: number | null;
  };
  readonly payment: {
    readonly type: "online" | "offline";
    readonly method: string | null;
    readonly amountToCollect: string | null;
    readonly changeFor: string | null;
  };
  readonly deliveryFee: string | null;
  readonly driver: { readonly mode: "auto" | "manual" | "none"; readonly driverId: string | null };
  readonly sendTrackingLink: boolean;
}

export async function createDelivery(input: CreateDeliveryInput): Promise<DeliveryDetail> {
  const a = input.address;
  return parseDetail(
    await apiFetch<unknown>(BASE, {
      method: "POST",
      body: {
        client_request_id: input.clientRequestId,
        channel: input.channel,
        customer: { name: input.customerName.trim(), phone: input.customerPhone },
        address: {
          street: a.street.trim(),
          number: a.number.trim(),
          neighborhood: a.neighborhood,
          city: a.city.trim(),
          state: a.state.trim().toUpperCase(),
          zip_code: a.zipCode,
          complement: a.complement,
          reference: a.reference,
          ...(a.lat !== null && a.lng !== null ? { lat: a.lat, lng: a.lng } : {}),
        },
        payment: {
          type: input.payment.type,
          method: input.payment.method,
          amount_to_collect: input.payment.amountToCollect,
          change_for: input.payment.changeFor,
        },
        delivery_fee: input.deliveryFee,
        driver: { mode: input.driver.mode, driver_id: input.driver.driverId },
        send_tracking_link: input.sendTrackingLink,
      },
    }),
  );
}
