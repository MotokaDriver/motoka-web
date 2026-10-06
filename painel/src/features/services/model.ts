import { ApiError } from "@/lib/api/errors";

/**
 * Serviços avulsos (`/v1/orders`, WN-7). O painel não calcula valor: tudo é a string decimal que a API mandou
 * (a prévia `/orders/review` traz taxa e total). `payment.amount` vem como número (float) e só vira texto.
 */

export type OrderStatus = "pending_payment" | "paid" | "waiting_for_drivers" | "pending_service_start" | "service_started" | "finished" | "cancelled" | "unknown";
export type OrderType = "fixed_value" | "per_delivery" | "fixed_plus_per_delivery";

export interface Order {
  readonly id: string;
  readonly status: OrderStatus;
  readonly type: OrderType;
  readonly startDate: string;
  readonly endDate: string;
  readonly requestedDrivers: number;
  readonly assignedDrivers: number;
  readonly value: string | null;
  readonly pricePerDelivery: string | null;
  /** Taxa do app; "0.00" com cupom de isenção: nesse caso não há pagamento. */
  readonly internalFee: string;
  readonly rainBonusPercent: number | null;
  readonly valueWithRain: string | null;
  readonly pricePerDeliveryWithRain: string | null;
  readonly cancellationReason: string | null;
}

export interface OrderList {
  readonly count: number;
  readonly total: number;
  readonly items: readonly Order[];
}

export type OfferStatus = "pending" | "accepted" | "rejected" | "superseded" | "unknown";

export interface Offer {
  readonly id: string;
  readonly createdAt: string;
  /** Quem fez a oferta: `establishment` ou `driver`. */
  readonly createdBy: string;
  readonly status: OfferStatus;
  readonly value: string | null;
  readonly valuePerDelivery: string | null;
  readonly valueWithRain: string | null;
  readonly valuePerDeliveryWithRain: string | null;
}

export interface Negotiation {
  readonly id: string;
  readonly orderId: string;
  readonly status: string;
  readonly driver: { readonly id: string; readonly fullName: string; readonly rating: number | null } | null;
  readonly offers: readonly Offer[];
}

export interface OrderDriver {
  readonly id: string;
  readonly status: string;
  readonly fullName: string;
  readonly rating: number | null;
  readonly agreedValue: string | null;
  readonly agreedValuePerDelivery: string | null;
}

export interface Review {
  readonly value: string;
  readonly pricePerDelivery: string | null;
  readonly totalValue: string;
  readonly serviceCharge: string;
  readonly amountToPay: string;
  readonly rainBonusPercent: number | null;
  readonly valueWithRain: string | null;
  readonly pricePerDeliveryWithRain: string | null;
}

export type PaymentStatus = "created" | "processing" | "pending" | "paid" | "failed" | "cancelled" | "refunded" | "expired" | "unknown";

export interface Payment {
  readonly id: string;
  readonly status: PaymentStatus;
  readonly method: "pix" | "credit_card" | "unknown";
  readonly amount: string;
  readonly copyPaste: string | null;
  /** Já como `data:` URL (a CSP libera `data:` em `img-src`); `null` se a API não mandou ou mandou algo estranho. */
  readonly qrImage: string | null;
  readonly expiresAt: string | null;
  readonly paidAt: string | null;
  /** Status do gateway (`payment_metadata.gateway_status`), só para escolher o texto da falha; nunca vai para a tela. */
  readonly gatewayStatus: string | null;
}

export interface SavedCard {
  readonly id: string;
  readonly mask: string;
  readonly type: string;
}

type Raw = Record<string, unknown>;

function unreadable(): never {
  throw new ApiError({ status: 200, code: "RESPONSE_UNREADABLE" });
}

const obj = (value: unknown): Raw => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : unreadable());
const maybe = (value: unknown): Raw | null => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null);
const list = (value: unknown): Raw[] => (Array.isArray(value) ? value.filter((v): v is Raw => v !== null && typeof v === "object") : []);
const str = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const strOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const int = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0);
const numOrNull = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Decimal da API (string, ou número em alguns campos) → "12.50"; `null` se vazio ou ilegível. */
export function decimal(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(2) : null;
  const text = str(value).trim();
  return /^-?\d+(\.\d+)?$/.test(text) ? text : null;
}

const STATUSES: readonly string[] = ["pending_payment", "paid", "waiting_for_drivers", "pending_service_start", "service_started", "finished", "cancelled"];
const TYPES: readonly string[] = ["fixed_value", "per_delivery", "fixed_plus_per_delivery"];

export function parseOrder(value: unknown): Order {
  const raw = obj(value);
  const id = str(raw.id);
  if (id === "") return unreadable();
  const status = str(raw.status).toLowerCase();
  const type = str(raw.type).toLowerCase();
  return {
    id,
    status: (STATUSES.includes(status) ? status : "unknown") as OrderStatus,
    type: (TYPES.includes(type) ? type : "fixed_value") as OrderType,
    startDate: str(raw.start_date),
    endDate: str(raw.end_date),
    requestedDrivers: int(raw.requested_drivers),
    assignedDrivers: int(raw.assigned_drivers),
    value: decimal(raw.value),
    pricePerDelivery: decimal(raw.price_per_delivery),
    internalFee: decimal(raw.internal_fee) ?? "0.00",
    rainBonusPercent: numOrNull(raw.rain_bonus_percent),
    valueWithRain: decimal(raw.value_with_rain_bonus),
    pricePerDeliveryWithRain: decimal(raw.price_per_delivery_with_rain_bonus),
    cancellationReason: strOrNull(raw.cancellation_reason),
  };
}

export function parseOrderList(value: unknown): OrderList {
  const raw = obj(value);
  const items = list(raw.items).map(parseOrder);
  return { count: items.length, total: int(raw.total) || items.length, items };
}

const OFFER_STATUSES: readonly string[] = ["pending", "accepted", "rejected", "superseded"];

function parseOffer(raw: Raw): Offer {
  const status = str(raw.status).toLowerCase();
  return {
    id: str(raw.id),
    createdAt: str(raw.created_at),
    createdBy: str(raw.created_by).toLowerCase(),
    status: (OFFER_STATUSES.includes(status) ? status : "unknown") as OfferStatus,
    value: decimal(raw.value),
    valuePerDelivery: decimal(raw.value_per_delivery),
    valueWithRain: decimal(raw.value_with_rain_bonus),
    valuePerDeliveryWithRain: decimal(raw.value_per_delivery_with_rain_bonus),
  };
}

export function parseNegotiation(value: unknown): Negotiation {
  const raw = obj(value);
  const driver = maybe(raw.driver);
  return {
    id: str(raw.id),
    orderId: str(raw.order_id),
    status: str(raw.status).toLowerCase(),
    driver: driver ? { id: str(driver.id), fullName: str(driver.full_name), rating: numOrNull(driver.rating) } : null,
    offers: list(raw.offers).map(parseOffer),
  };
}

export const parseNegotiations = (value: unknown): readonly Negotiation[] => list(obj(value).items).map(parseNegotiation);

export function parseOrderDrivers(value: unknown): readonly OrderDriver[] {
  return list(obj(value).items).map((raw) => {
    const driver = maybe(raw.driver);
    return {
      id: str(raw.id),
      status: str(raw.status).toLowerCase(),
      fullName: str(driver?.full_name),
      rating: numOrNull(driver?.rating),
      agreedValue: decimal(raw.agreed_value),
      agreedValuePerDelivery: decimal(raw.agreed_value_per_delivery),
    };
  });
}

export function parseReview(value: unknown): Review {
  const raw = obj(value);
  return {
    value: decimal(raw.value) ?? "0.00",
    pricePerDelivery: decimal(raw.price_per_delivery),
    totalValue: decimal(raw.total_value) ?? "0.00",
    serviceCharge: decimal(raw.service_charge) ?? "0.00",
    amountToPay: decimal(raw.amount_to_pay) ?? "0.00",
    rainBonusPercent: numOrNull(raw.rain_bonus_percent),
    valueWithRain: decimal(raw.value_with_rain_bonus),
    pricePerDeliveryWithRain: decimal(raw.price_per_delivery_with_rain_bonus),
  };
}

const PAYMENT_STATUSES: readonly string[] = ["created", "processing", "pending", "paid", "failed", "cancelled", "refunded", "expired"];
/** O QR chega em base64 puro; só vira imagem se for base64 de verdade (nada de montar `data:` com texto livre). */
const BASE64 = /^[A-Za-z0-9+/=\r\n]+$/;

export function parsePayment(value: unknown): Payment {
  const raw = obj(value);
  const status = str(raw.status).toLowerCase();
  const method = str(raw.payment_method).toLowerCase();
  const qr = strOrNull(raw.qr_code_base64);
  const qrBody = qr?.replace(/^data:image\/png;base64,/, "") ?? null;
  return {
    id: str(raw.id),
    status: (PAYMENT_STATUSES.includes(status) ? status : "unknown") as PaymentStatus,
    method: method === "pix" ? "pix" : method === "credit_card" ? "credit_card" : "unknown",
    amount: decimal(raw.amount) ?? "0.00",
    copyPaste: strOrNull(raw.copy_paste),
    qrImage: qrBody && BASE64.test(qrBody) ? `data:image/png;base64,${qrBody}` : null,
    expiresAt: strOrNull(raw.expires_at),
    paidAt: strOrNull(raw.paid_at),
    gatewayStatus: (strOrNull(maybe(raw.payment_metadata)?.gateway_status) ?? strOrNull(maybe(raw.payment_metadata)?.efibank_status))?.toLowerCase() ?? null,
  };
}

export function parseCards(value: unknown): readonly SavedCard[] {
  return list(obj(value).items).map((raw) => ({ id: str(raw.id), mask: str(raw.mask), type: str(raw.type) }));
}
