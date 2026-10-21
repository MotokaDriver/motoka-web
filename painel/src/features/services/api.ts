import { apiFetch } from "@/features/session/runtime";
import { ApiError, isUuid } from "@/lib/api/errors";
import {
  parseCards,
  parseNegotiation,
  parseNegotiations,
  parseOrder,
  parseOrderDrivers,
  parsePayment,
  parseOrderList,
  parseReview,
  type Negotiation,
  type Order,
  type OrderType,
  type Payment,
  type Review,
  type OrderList,
  type SavedCard,
} from "./model";

/** `/v1/orders` e `/v1/users/{id}/bank-cards`. `API_BASE` já traz o `/v1`. */

function orderPath(id: string, rest = ""): string {
  if (!isUuid(id)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  return `/orders/${id}${rest}`;
}

export interface OrdersQuery {
  readonly status: readonly string[];
  /** Só serviços que começam a partir deste instante (ISO). */
  readonly startFrom?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/** `GET /orders`: sempre os da própria loja (a API filtra pelo usuário). Ordem crescente por início. */
export const fetchOrders = async (query: OrdersQuery, signal?: AbortSignal): Promise<OrderList> =>
  parseOrderList(
    await apiFetch<unknown>("/orders", {
      query: { status: query.status, start_date: query.startFrom, order_by: "start_date", limit: query.limit ?? 50, offset: query.offset ?? 0 },
      signal,
    }),
  );

export const fetchOrder = async (id: string, signal?: AbortSignal): Promise<Order> => parseOrder(await apiFetch<unknown>(orderPath(id), { signal }));

export const fetchOrderDrivers = async (id: string, signal?: AbortSignal) =>
  parseOrderDrivers(await apiFetch<unknown>(orderPath(id, "/drivers"), { query: { status: "accepted", limit: 100 }, signal }));

export const fetchNegotiations = async (id: string, signal?: AbortSignal): Promise<readonly Negotiation[]> =>
  parseNegotiations(await apiFetch<unknown>(orderPath(id, "/negotiations"), { query: { limit: 100 }, signal }));

export interface OrderInput {
  readonly establishmentId: string;
  readonly requestedDrivers: number;
  readonly startDate: string;
  readonly endDate: string;
  readonly type: OrderType;
  readonly value: string | null;
  readonly pricePerDelivery: string | null;
}

function orderBody(input: OrderInput): Record<string, unknown> {
  return {
    requested_drivers: input.requestedDrivers,
    start_date: input.startDate,
    end_date: input.endDate,
    type: input.type,
    ...(input.type !== "per_delivery" ? { value: input.value } : {}),
    ...(input.type !== "fixed_value" ? { price_per_delivery: input.pricePerDelivery } : {}),
  };
}

/** `POST /orders/review`: a taxa e o total vêm do servidor. */
export const reviewOrder = async (input: OrderInput, signal?: AbortSignal): Promise<Review> =>
  parseReview(
    await apiFetch<unknown>("/orders/review", {
      method: "POST",
      body: {
        requested_drivers: input.requestedDrivers,
        type: input.type,
        value: input.type === "per_delivery" ? "0.00" : input.value,
        ...(input.type !== "fixed_value" ? { price_per_delivery: input.pricePerDelivery } : {}),
      },
      signal,
    }),
  );

export const createOrder = async (input: OrderInput): Promise<Order> =>
  parseOrder(await apiFetch<unknown>("/orders", { method: "POST", body: { ...orderBody(input), establishment_id: input.establishmentId } }));

export const cancelOrder = async (id: string): Promise<void> => {
  await apiFetch<unknown>(orderPath(id), { method: "DELETE" });
};

export interface OfferInput {
  readonly value: string;
  readonly valuePerDelivery: string | null;
}

const offerBody = (input: OfferInput) => ({ value: input.value, ...(input.valuePerDelivery !== null ? { value_per_delivery: input.valuePerDelivery } : {}) });

function negotiationPath(orderId: string, negotiationId: string, rest = ""): string {
  if (!isUuid(negotiationId)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  return orderPath(orderId, `/negotiations/${negotiationId}${rest}`);
}

export const offerNegotiation = async (orderId: string, negotiationId: string, input: OfferInput): Promise<Negotiation> =>
  parseNegotiation(await apiFetch<unknown>(negotiationPath(orderId, negotiationId, "/offers"), { method: "POST", body: offerBody(input) }));

export const acceptNegotiation = async (orderId: string, negotiationId: string): Promise<Negotiation> =>
  parseNegotiation(await apiFetch<unknown>(negotiationPath(orderId, negotiationId, "/accept"), { method: "POST" }));

export const rejectNegotiation = async (orderId: string, negotiationId: string): Promise<Negotiation> =>
  parseNegotiation(await apiFetch<unknown>(negotiationPath(orderId, negotiationId, "/reject"), { method: "POST" }));

export const cancelNegotiation = async (orderId: string, negotiationId: string): Promise<Negotiation> =>
  parseNegotiation(await apiFetch<unknown>(negotiationPath(orderId, negotiationId, "/cancel"), { method: "POST" }));

export type PayWith = { readonly method: "pix" } | { readonly method: "credit_card"; readonly bankCardId: string };

export const payOrder = async (orderId: string, how: PayWith): Promise<Payment> =>
  parsePayment(
    await apiFetch<unknown>(orderPath(orderId, "/payments"), {
      method: "POST",
      body: how.method === "pix" ? { payment_method: "pix" } : { payment_method: "credit_card", payment_metadata: { bank_card_id: how.bankCardId } },
    }),
  );

export const fetchPayment = async (orderId: string, signal?: AbortSignal): Promise<Payment> =>
  parsePayment(await apiFetch<unknown>(orderPath(orderId, "/payments"), { signal }));

function cardsPath(userId: string, rest = ""): string {
  if (!isUuid(userId)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  return `/users/${userId}/bank-cards${rest}`;
}

export const fetchCards = async (userId: string, signal?: AbortSignal): Promise<readonly SavedCard[]> =>
  parseCards(await apiFetch<unknown>(cardsPath(userId), { signal }));

export const deleteCard = async (userId: string, cardId: string): Promise<void> => {
  if (!isUuid(cardId)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  await apiFetch<unknown>(cardsPath(userId, `/${cardId}`), { method: "DELETE" });
};
