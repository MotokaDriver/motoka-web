import { ApiError } from "@/lib/api/errors";

/**
 * Integrações (`/v1/integrations`, WS-12/13/14). O segredo (`client_secret`) só existe na resposta de "Gerar credenciais"
 * e fica no estado do componente que o pediu: nunca nestes modelos, no cache de queries, em storage, em log ou em URL.
 */

export type IntegrationType = "open_delivery" | "saipos" | "cardapio_web" | "ifood" | "nuvemshop" | "unknown";
/** `incomplete`: autorizou no parceiro, mas faltou um dado para operar (o Cardápio Web sem a loja). */
export type CardStatus = "connected" | "available" | "soon" | "incomplete";
export type IntegrationState = "disconnected" | "connected" | "error";

export interface Card {
  readonly type: IntegrationType;
  readonly status: CardStatus;
  readonly state: IntegrationState | null;
  readonly lastOutboundOkAt: string | null;
  readonly needsAttention: boolean;
}

export interface Health {
  readonly lastTokenAt: string | null;
  readonly lastInboundAt: string | null;
  readonly lastOutboundOkAt: string | null;
  readonly pendingEvents: number;
  readonly deadEvents24h: number;
}

export interface Detail {
  readonly type: IntegrationType;
  readonly status: CardStatus;
  readonly state: IntegrationState;
  readonly externalMerchantId: string | null;
  readonly webhookUrl: string | null;
  readonly deliveryPrice: string;
  readonly operatorBaseUrl: string;
  readonly tokenUrl: string;
  readonly clientId: string | null;
  /** Só o fim do secret: nunca o secret. */
  readonly secretHint: string | null;
  readonly credentialVersion: number;
  readonly credentialRotatedAt: string | null;
  readonly health: Health;
}

export interface Issued {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly secretHint: string;
  readonly tokenUrl: string;
}

export interface TestResult {
  readonly ok: boolean;
  readonly error: string | null;
  readonly httpStatus: number | null;
  readonly lastTokenAt: string | null;
  readonly lastOutboundOkAt: string | null;
}

export type ActivityKind =
  | "received"
  | "sent"
  | "error"
  | "dead_letter"
  | "credential_rotated"
  | "connected"
  | "disconnected"
  | "accepted"
  | "rejected"
  | "origin_unconfirmed"
  | "driver_removed"
  | "origin_discarded"
  | "reauth_required"
  | "reauth_expired"
  | "attention"
  | "unknown";

export interface Activity {
  readonly id: string;
  readonly type: IntegrationType;
  readonly kind: ActivityKind;
  readonly deliveryId: string | null;
  readonly deliveryNumber: number | null;
  /** Motivo de um aviso de atenção, só dos valores conhecidos (`meta.reason`); o resto do `meta` nunca é lido. */
  readonly reason: AttentionReason | null;
  readonly createdAt: string;
}

export type AttentionReason = "driver_not_linked" | "finished_before_pickup" | "merchant_missing";

export interface ActivityPage {
  readonly items: readonly Activity[];
  readonly nextCursor: string | null;
}

type Raw = Record<string, unknown>;
const isRaw = (value: unknown): value is Raw => value !== null && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const strOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const int = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0);

function unreadable(): never {
  throw new ApiError({ status: 200, code: "RESPONSE_UNREADABLE" });
}

const TYPES: readonly string[] = ["open_delivery", "saipos", "cardapio_web", "ifood", "nuvemshop"];
const parseType = (value: unknown): IntegrationType => (TYPES.includes(str(value)) ? (str(value) as IntegrationType) : "unknown");
const parseStatus = (value: unknown): CardStatus => (value === "connected" ? "connected" : value === "available" ? "available" : value === "incomplete" ? "incomplete" : "soon");
const parseState = (value: unknown): IntegrationState => (value === "connected" ? "connected" : value === "error" ? "error" : "disconnected");

export function parseCards(value: unknown): readonly Card[] {
  if (!Array.isArray(value)) return unreadable();
  return value.filter(isRaw).map((raw) => ({
    type: parseType(raw.type),
    status: parseStatus(raw.status),
    state: raw.state == null ? null : parseState(raw.state),
    lastOutboundOkAt: strOrNull(raw.last_outbound_ok_at),
    needsAttention: raw.needs_attention === true,
  }));
}

export function parseDetail(value: unknown): Detail {
  if (!isRaw(value)) return unreadable();
  const health = isRaw(value.health) ? value.health : {};
  const price = typeof value.delivery_price === "number" ? value.delivery_price.toFixed(2) : str(value.delivery_price);
  return {
    type: parseType(value.type),
    status: parseStatus(value.status),
    state: parseState(value.state),
    externalMerchantId: strOrNull(value.external_merchant_id),
    webhookUrl: strOrNull(value.webhook_url),
    deliveryPrice: /^\d+(\.\d+)?$/.test(price) ? price : "0.00",
    operatorBaseUrl: str(value.operator_base_url),
    tokenUrl: str(value.token_url),
    clientId: strOrNull(value.client_id),
    secretHint: strOrNull(value.secret_hint),
    credentialVersion: int(value.credential_version),
    credentialRotatedAt: strOrNull(value.credential_rotated_at),
    health: {
      lastTokenAt: strOrNull(health.last_token_at),
      lastInboundAt: strOrNull(health.last_inbound_at),
      lastOutboundOkAt: strOrNull(health.last_outbound_ok_at),
      pendingEvents: int(health.pending_events),
      deadEvents24h: int(health.dead_events_24h),
    },
  };
}

export function parseIssued(value: unknown): Issued {
  if (!isRaw(value) || typeof value.client_secret !== "string" || value.client_secret === "") return unreadable();
  return { clientId: str(value.client_id), clientSecret: value.client_secret, secretHint: str(value.secret_hint), tokenUrl: str(value.token_url) };
}

export function parseTest(value: unknown): TestResult {
  if (!isRaw(value)) return unreadable();
  return {
    ok: value.ok === true,
    error: strOrNull(value.error),
    httpStatus: typeof value.http_status === "number" ? value.http_status : null,
    lastTokenAt: strOrNull(value.last_token_at),
    lastOutboundOkAt: strOrNull(value.last_outbound_ok_at),
  };
}

const KINDS: readonly string[] = ["received", "sent", "error", "dead_letter", "credential_rotated", "connected", "disconnected", "accepted", "rejected", "origin_unconfirmed", "driver_removed", "origin_discarded", "reauth_required", "reauth_expired", "attention"];

function parseReason(value: unknown): AttentionReason | null {
  return value === "driver_not_linked" || value === "finished_before_pickup" || value === "merchant_missing" ? value : null;
}

export function parseActivity(value: unknown): ActivityPage {
  if (!isRaw(value)) return unreadable();
  const items = (Array.isArray(value.items) ? value.items : []).filter(isRaw).map(
    (raw): Activity => ({
      id: str(raw.id),
      type: parseType(raw.type),
      kind: (KINDS.includes(str(raw.kind)) ? str(raw.kind) : "unknown") as ActivityKind,
      deliveryId: strOrNull(raw.delivery_id),
      deliveryNumber: typeof raw.delivery_number === "number" ? raw.delivery_number : null,
      reason: parseReason(isRaw(raw.meta) ? raw.meta.reason : null),
      createdAt: str(raw.created_at),
    }),
  );
  return { items, nextCursor: strOrNull(value.next_cursor) };
}
