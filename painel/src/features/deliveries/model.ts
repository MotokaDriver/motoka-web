import { ApiError } from "@/lib/api/errors";
import type { Tone } from "@/ui/Chip";

/**
 * Modelos de `/v1/deliveries` (`deliveries/application/dto.py`). Enums em minúsculas, dinheiro como
 * string decimal, instantes ISO UTC. Valor desconhecido nunca quebra a tela (status vira "Status
 * desconhecido", origem vira "Outra origem").
 */

export type DeliveryStatus =
  | "awaiting_acceptance"
  | "rejected"
  | "preparing"
  | "ready"
  | "picked_up"
  | "on_the_way"
  | "arrived"
  | "problem"
  | "returning"
  | "returned"
  | "delivered"
  | "cancelled"
  | "unknown";

export type Origin = "manual" | "open_delivery" | "saipos" | "cardapio_web" | "ifood" | "nuvemshop" | "unknown";
export type Channel = "whatsapp" | "phone" | "counter";
export type CodeMode = "motoka" | "origin" | "none";
export type TrackingMode = "motoka" | "none";
export type PaymentType = "online" | "offline";
export type PaymentMethod = "credit_card" | "debit_card" | "cash" | "pix" | "meal_voucher" | "other";
export type GeocodeStatus = "pending" | "ok" | "failed" | "provided" | "not_configured";
export type Actor = "establishment" | "driver" | "origin" | "system";
export type ProblemReason = "no_one_to_receive" | "address_not_found" | "payment_issue" | "customer_refused" | "other";

export interface DriverRef {
  readonly id: string;
  readonly shortName: string;
  readonly initials: string;
}

export interface Tracking {
  readonly mode: TrackingMode;
  readonly sentAt: string | null;
  readonly openedCount: number;
  readonly expired: boolean;
}

export interface Cancellation {
  readonly by: Actor;
  readonly at: string;
  readonly reason: string | null;
  readonly afterPickup: boolean;
}

export interface Problem {
  readonly reason: ProblemReason;
  readonly reportedAt: string | null;
  /** Texto digitado pelo motoboy: dado, vai como texto puro, nunca como mensagem do backend. */
  readonly description: string | null;
}

export interface DeliveryItem {
  readonly id: string;
  readonly number: number;
  readonly origin: Origin;
  readonly channel: Channel | null;
  readonly externalDisplayId: string | null;
  readonly status: DeliveryStatus;
  readonly customerName: string | null;
  readonly addressLine: string | null;
  readonly neighborhood: string | null;
  readonly driver: DriverRef | null;
  readonly suggestedDriver: { readonly id: string; readonly shortName: string } | null;
  readonly tracking: Tracking;
  readonly cancellation: Cancellation | null;
  readonly problem: Problem | null;
  readonly codeLocked: boolean;
  readonly geocodeStatus: GeocodeStatus;
  readonly needsAttention: boolean;
  readonly createdAt: string;
  readonly estimatedReadyAt: string | null;
  readonly readyAt: string | null;
  /** Prazo de aceite de um pedido de integração (`awaiting_acceptance`). */
  readonly acceptDeadlineAt: string | null;
  /** O sistema de origem não confirmou o aceite: a loja confere lá e pode cancelar (WS-13, B4). */
  readonly originUnconfirmed: boolean;
  /** O motoboy previsto para o aceite (sugestão do servidor). */
  readonly previewedDriver: DriverRef | null;
}

export interface Address {
  readonly street: string | null;
  readonly number: string | null;
  readonly neighborhood: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly zipCode: string | null;
  readonly complement: string | null;
  readonly reference: string | null;
}

export interface Payment {
  readonly type: PaymentType;
  readonly method: PaymentMethod | null;
  readonly amountToCollect: string | null;
  readonly changeFor: string | null;
}

export interface DeliveryEvent {
  readonly seq: number;
  readonly type: string;
  readonly toStatus: DeliveryStatus | null;
  readonly actor: Actor;
  readonly recordedAt: string;
}

export interface AfterCancel {
  readonly acknowledgedAt: string | null;
  readonly charged: boolean | null;
  readonly chargedAmount: string | null;
}

export interface DeliveryDetail extends DeliveryItem {
  readonly customerPhone: string | null;
  readonly phoneLocalizer: string | null;
  readonly address: Address;
  readonly payment: Payment;
  readonly deliveryFee: string | null;
  readonly notes: string | null;
  readonly code: { readonly mode: CodeMode; readonly value: string | null; readonly failedAttempts: number; readonly locked: boolean };
  readonly trackingUrl: string | null;
  readonly flags: { readonly deliveredAfterCancel: boolean; readonly latePickup: boolean };
  readonly afterCancel: AfterCancel | null;
  readonly events: readonly DeliveryEvent[];
}

export interface DeliveryList {
  readonly total: number;
  readonly items: readonly DeliveryItem[];
  readonly counts: { readonly open: number; readonly all: number };
}

export interface CustomerAddress extends Address {
  readonly lat: number | null;
  readonly lng: number | null;
  readonly lastUsedAt: string | null;
}

export interface CustomerLookup {
  readonly phone: string;
  readonly name: string | null;
  readonly addresses: readonly CustomerAddress[];
}

// --- Parsers -------------------------------------------------------------------------------

type Raw = Record<string, unknown>;

function unreadable(): never {
  throw new ApiError({ status: 200, code: "RESPONSE_UNREADABLE" });
}

function obj(value: unknown): Raw {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return unreadable();
  return value as Raw;
}

const maybeObj = (value: unknown): Raw | null => (value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null);
const list = (value: unknown): Raw[] => (Array.isArray(value) ? value.filter((v): v is Raw => v !== null && typeof v === "object") : []);
const str = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const strOrNull = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const numOrNull = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const money = (value: unknown): string | null => (value == null ? null : str(value));

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const text = str(value).toLowerCase();
  return (allowed as readonly string[]).includes(text) ? (text as T) : fallback;
}

function id(value: unknown): string {
  const text = str(value);
  return text === "" ? unreadable() : text;
}

const STATUSES = ["awaiting_acceptance", "rejected", "preparing", "ready", "picked_up", "on_the_way", "arrived", "problem", "returning", "returned", "delivered", "cancelled"] as const;
const ORIGINS = ["manual", "open_delivery", "saipos", "cardapio_web", "ifood", "nuvemshop"] as const;
const ACTORS = ["establishment", "driver", "origin", "system"] as const;

const parseStatus = (value: unknown): DeliveryStatus => oneOf<DeliveryStatus>(value, STATUSES, "unknown");

export function parseDriverRef(value: unknown): DriverRef | null {
  const raw = maybeObj(value);
  if (!raw) return null;
  return { id: id(raw.id), shortName: str(raw.short_name), initials: str(raw.initials) };
}

function parseAddress(value: unknown): Address {
  const raw = maybeObj(value) ?? {};
  return {
    street: strOrNull(raw.street),
    number: raw.number == null ? null : str(raw.number),
    neighborhood: strOrNull(raw.neighborhood),
    city: strOrNull(raw.city),
    state: strOrNull(raw.state),
    zipCode: strOrNull(raw.zip_code),
    complement: strOrNull(raw.complement),
    reference: strOrNull(raw.reference),
  };
}

export function parseItem(raw: Raw): DeliveryItem {
  const customer = maybeObj(raw.customer) ?? {};
  const tracking = maybeObj(raw.tracking) ?? {};
  const cancellation = maybeObj(raw.cancellation);
  const problem = maybeObj(raw.problem);
  const suggested = maybeObj(raw.suggested_driver);
  return {
    id: id(raw.id),
    number: num(raw.number),
    origin: oneOf<Origin>(raw.origin, ORIGINS, "unknown"),
    channel: oneOf<Channel | "">(raw.channel, ["whatsapp", "phone", "counter", ""], "") || null,
    externalDisplayId: strOrNull(raw.external_display_id),
    status: parseStatus(raw.status),
    customerName: strOrNull(customer.name),
    addressLine: strOrNull(customer.address_line),
    neighborhood: strOrNull(customer.neighborhood),
    driver: parseDriverRef(raw.driver),
    suggestedDriver: suggested ? { id: id(suggested.id), shortName: str(suggested.short_name) } : null,
    tracking: {
      mode: oneOf<TrackingMode>(tracking.mode, ["motoka", "none"], "motoka"),
      sentAt: strOrNull(tracking.sent_at),
      openedCount: num(tracking.opened_count),
      expired: tracking.expired === true,
    },
    cancellation: cancellation
      ? { by: oneOf<Actor>(cancellation.by, ACTORS, "system"), at: str(cancellation.at), reason: strOrNull(cancellation.reason), afterPickup: cancellation.after_pickup === true }
      : null,
    problem: problem
      ? {
          reason: oneOf<ProblemReason>(problem.reason, ["no_one_to_receive", "address_not_found", "payment_issue", "customer_refused", "other"], "other"),
          reportedAt: strOrNull(problem.reported_at),
          description: strOrNull(problem.description),
        }
      : null,
    codeLocked: raw.code_locked === true,
    // `not_configured` (deploy sem chave do geocodificador) não é falha do endereço.
    geocodeStatus: oneOf<GeocodeStatus>(raw.geocode_status, ["pending", "ok", "failed", "provided", "not_configured"], "pending"),
    needsAttention: raw.needs_attention === true,
    createdAt: str(raw.created_at),
    estimatedReadyAt: strOrNull(raw.estimated_ready_at),
    readyAt: strOrNull(raw.ready_at),
    acceptDeadlineAt: strOrNull(raw.accept_deadline_at),
    originUnconfirmed: raw.origin_unconfirmed === true,
    previewedDriver: parseDriverRef(raw.previewed_driver),
  };
}

export function parseDetail(value: unknown): DeliveryDetail {
  const raw = obj(value);
  const item = parseItem(raw);
  const customer = maybeObj(raw.customer) ?? {};
  const payment = maybeObj(raw.payment) ?? {};
  const code = maybeObj(raw.code) ?? {};
  const flags = maybeObj(raw.flags) ?? {};
  const afterCancel = maybeObj(raw.after_cancel);
  return {
    ...item,
    // O detalhe traz nome e telefone no `customer`; o endereço em texto vem montado do `address`.
    customerPhone: strOrNull(customer.phone),
    phoneLocalizer: strOrNull(customer.phone_localizer),
    address: parseAddress(customer.address),
    payment: {
      type: oneOf<PaymentType>(payment.type, ["online", "offline"], "online"),
      method: oneOf<PaymentMethod | "">(payment.method, ["credit_card", "debit_card", "cash", "pix", "meal_voucher", "other", ""], "") || null,
      amountToCollect: money(payment.amount_to_collect),
      changeFor: money(payment.change_for),
    },
    deliveryFee: money(raw.delivery_fee),
    notes: strOrNull(raw.notes),
    code: {
      mode: oneOf<CodeMode>(code.mode, ["motoka", "origin", "none"], "none"),
      value: strOrNull(code.value),
      failedAttempts: num(code.failed_attempts),
      locked: code.locked === true,
    },
    trackingUrl: strOrNull(raw.tracking_url),
    flags: { deliveredAfterCancel: flags.delivered_after_cancel === true, latePickup: flags.late_pickup === true },
    afterCancel: afterCancel
      ? { acknowledgedAt: strOrNull(afterCancel.acknowledged_at), charged: typeof afterCancel.charged === "boolean" ? afterCancel.charged : null, chargedAmount: money(afterCancel.charged_amount) }
      : null,
    events: list(raw.events).map((e) => ({
      seq: num(e.seq),
      type: str(e.type),
      toStatus: e.to_status == null ? null : parseStatus(e.to_status),
      actor: oneOf<Actor>(e.actor, ACTORS, "system"),
      recordedAt: str(e.recorded_at),
    })),
  };
}

export function parseList(value: unknown): DeliveryList {
  const raw = obj(value);
  const counts = maybeObj(raw.counts) ?? {};
  return {
    total: num(raw.total),
    items: list(raw.items).map(parseItem),
    counts: { open: num(counts.open), all: num(counts.all) },
  };
}

export function parseLookup(value: unknown): CustomerLookup {
  const raw = obj(value);
  return {
    phone: str(raw.phone),
    name: strOrNull(raw.name),
    addresses: list(raw.addresses).map((a) => {
      const loc = maybeObj(a.location);
      return { ...parseAddress(a), lat: loc ? numOrNull(loc.lat) : null, lng: loc ? numOrNull(loc.lng) : null, lastUsedAt: strOrNull(a.last_used_at) };
    }),
  };
}

// --- Rótulos ---------------------------------------------------------------------------------

export const STATUS: Record<DeliveryStatus, { label: string; tone: Tone }> = {
  awaiting_acceptance: { label: "Aguardando aceite", tone: "warning" },
  rejected: { label: "Recusado", tone: "neutral" },
  preparing: { label: "Em preparo", tone: "neutral" },
  ready: { label: "Pronto p/ retirar", tone: "warning" },
  picked_up: { label: "Retirado", tone: "info" },
  on_the_way: { label: "A caminho", tone: "info" },
  arrived: { label: "Chegou", tone: "warning" },
  problem: { label: "Problema", tone: "error" },
  returning: { label: "Voltando", tone: "warning" },
  returned: { label: "Devolvido", tone: "neutral" },
  delivered: { label: "Entregue", tone: "success" },
  cancelled: { label: "Cancelado", tone: "error" },
  unknown: { label: "Status desconhecido", tone: "neutral" },
};

export const TERMINAL: ReadonlySet<DeliveryStatus> = new Set(["rejected", "returned", "delivered", "cancelled"]);

export interface OriginInfo {
  readonly label: string;
  readonly color: string;
  /** Rótulo do código de entrega ("Código do iFood"). */
  readonly codeLabel: string;
  /** Quem conhece o código: o Motoka, a origem ou só a plataforma (iFood). */
  readonly pinFrom: "motoka" | "origin" | "platform";
}

export const ORIGIN_INFO: Record<Origin, OriginInfo> = {
  manual: { label: "Manual", color: "#8E8E93", codeLabel: "Código de entrega", pinFrom: "motoka" },
  ifood: { label: "iFood", color: "#EA1D2C", codeLabel: "Código do iFood", pinFrom: "platform" },
  saipos: { label: "Saipos", color: "#F08A24", codeLabel: "Código do cliente", pinFrom: "origin" },
  cardapio_web: { label: "Cardápio Web", color: "#8B6CF6", codeLabel: "Código do cliente", pinFrom: "origin" },
  open_delivery: { label: "Open Delivery", color: "#2BB3A3", codeLabel: "Código do cliente", pinFrom: "origin" },
  nuvemshop: { label: "Nuvemshop", color: "#8E8E93", codeLabel: "Código do cliente", pinFrom: "origin" },
  unknown: { label: "Outra origem", color: "#8E8E93", codeLabel: "Código de entrega", pinFrom: "origin" },
};

export const CHANNEL_LABEL: Record<Channel, string> = { whatsapp: "WhatsApp", phone: "Telefone", counter: "Balcão" };

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  credit_card: "cartão na maquininha",
  debit_card: "débito na maquininha",
  cash: "dinheiro",
  pix: "Pix",
  meal_voucher: "vale-refeição",
  other: "outra forma",
};

export const PROBLEM_LABEL: Record<ProblemReason, string> = {
  no_one_to_receive: "Ninguém para receber",
  address_not_found: "Endereço não encontrado",
  payment_issue: "Problema no pagamento",
  customer_refused: "Cliente recusou",
  other: "Outro motivo",
};

/** Dica do código por origem (spec §4.5, `PIN_HINT`). */
export function pinHint(info: OriginInfo): string {
  if (info.pinFrom === "motoka") return "Gerado pelo Motoka e mostrado no link do cliente. O motoboy digita na entrega para confirmar.";
  if (info.pinFrom === "platform") return "O cliente vê o código no app do iFood. O motoboy digita na entrega e o Motoka confirma no iFood.";
  return `O cliente recebe o código da loja. O motoboy digita na entrega e o Motoka confere com a ${info.label} antes de concluir.`;
}

export const isOpen = (status: DeliveryStatus): boolean => !TERMINAL.has(status);

/** Cobrança: "Cobrar R$ 41,00 · dinheiro · troco para R$ 50,00". */
export function paymentLabel(payment: Payment, origin: Origin, format: (v: string | null) => string | null): string {
  if (payment.type === "online") return origin === "ifood" ? "Pago no iFood · nada a cobrar" : "Pago online · nada a cobrar";
  const parts = [`Cobrar ${format(payment.amountToCollect) ?? "valor a confirmar"}`];
  if (payment.method) parts.push(PAYMENT_METHOD_LABEL[payment.method]);
  if (payment.method === "cash" && payment.changeFor) parts.push(`troco para ${format(payment.changeFor) ?? ""}`.trim());
  return parts.join(" · ");
}
