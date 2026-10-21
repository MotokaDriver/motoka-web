import { ApiError } from "@/lib/api/errors";

/**
 * Acertos do turno (WS-11, `teams/application/dto.py`). **O painel não calcula nada**: todo valor é a string
 * decimal que o servidor mandou, e só passa por `formatMoney` para ganhar "R$" e vírgula. A chave Pix inteira
 * só vem no detalhe (S6), de um motoboy ainda ativo na equipe; nunca vai para log, toast, storage ou URL.
 */

export type SettlementStatus = "pending_driver" | "pending_store" | "disputed" | "confirmed" | "paid" | "unknown";
export type SettlementKind = "shift" | "supplement";

export interface SettlementDriver {
  readonly id: string;
  readonly fullName: string;
  readonly shortName: string;
  readonly initials: string;
}

export interface SettlementSummary {
  readonly id: string;
  readonly kind: SettlementKind;
  readonly sequence: number;
  readonly status: SettlementStatus;
  readonly occurrenceDate: string;
  readonly driver: SettlementDriver | null;
  readonly deliveriesCount: number;
  readonly returnsCount: number;
  readonly pendingCount: number;
  /** `null` com o combinado incompleto. */
  readonly total: string | null;
  readonly dealIncomplete: boolean;
}

export interface SettlementList {
  readonly count: number;
  readonly total: string;
  readonly items: readonly SettlementSummary[];
  readonly week: { readonly weekStart: string; readonly total: string; readonly units: number } | null;
  readonly needsActionCount: number;
}

export interface SettlementLine {
  readonly deliveryId: string;
  readonly number: number;
  /** `delivery`, `return` ou `pending`. */
  readonly kind: string;
  readonly reason: string | null;
  readonly occurredAt: string | null;
  readonly addressLine: string | null;
  readonly amount: string | null;
}

export interface HistoryEntry {
  readonly action: string;
  readonly actorRole: string;
  readonly at: string;
  readonly totalSeen: string | null;
  /** Motivo da contestação ou do ajuste: texto digitado por uma pessoa, vai como texto puro. */
  readonly note: string | null;
}

export interface PayoutKey {
  readonly type: string;
  readonly masked: string;
  /** Só na S6, com o motoboy ainda ativo na equipe. */
  readonly value: string | null;
}

export interface SettlementDetail extends SettlementSummary {
  readonly sessionId: string;
  readonly version: number;
  readonly establishmentName: string;
  readonly scheduled: { readonly start: string; readonly end: string } | null;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly deal: { readonly payType: string; readonly dailyRate: string | null; readonly perDeliveryRate: string | null; readonly rainBonusPercent: number | null };
  readonly daily: string | null;
  readonly deliveries: { readonly count: number; readonly unit: string | null; readonly amount: string | null };
  readonly returns: { readonly count: number; readonly unit: string | null; readonly amount: string | null };
  readonly subtotal: string | null;
  readonly rain: { readonly percent: number | null; readonly applied: boolean; readonly amount: string | null };
  readonly adjustment: { readonly amount: string; readonly note: string | null };
  readonly pending: ReadonlyArray<{ readonly deliveryId: string; readonly number: number; readonly reason: string }>;
  readonly excluded: ReadonlyArray<{ readonly deliveryId: string; readonly number: number }>;
  readonly lines: readonly SettlementLine[];
  readonly driverDecision: string | null;
  readonly driverConfirmedTotal: string | null;
  readonly confirmedOverDispute: boolean;
  readonly confirmedAt: string | null;
  readonly paidAt: string | null;
  readonly paidNote: string | null;
  readonly history: readonly HistoryEntry[];
  readonly payoutKey: PayoutKey | null;
  readonly frozen: boolean;
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
const money = (value: unknown): string | null => (value == null ? null : str(value));
const int = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0);

const STATUSES = ["pending_driver", "pending_store", "disputed", "confirmed", "paid"] as const;
const parseStatus = (value: unknown): SettlementStatus => {
  const text = str(value).toLowerCase();
  return (STATUSES as readonly string[]).includes(text) ? (text as SettlementStatus) : "unknown";
};

function parseDriver(value: unknown): SettlementDriver | null {
  const raw = maybe(value);
  if (!raw) return null;
  const fullName = str(raw.full_name);
  return { id: str(raw.id), fullName, shortName: str(raw.short_name) || fullName, initials: str(raw.initials) };
}

export function parseSummary(raw: Raw): SettlementSummary {
  const id = str(raw.id);
  if (id === "") return unreadable();
  return {
    id,
    kind: str(raw.kind).toLowerCase() === "supplement" ? "supplement" : "shift",
    sequence: int(raw.sequence),
    status: parseStatus(raw.status),
    occurrenceDate: str(raw.occurrence_date),
    driver: parseDriver(raw.driver),
    deliveriesCount: int(raw.deliveries_count),
    returnsCount: int(raw.returns_count),
    pendingCount: int(raw.pending_count),
    total: money(raw.total),
    dealIncomplete: raw.deal_incomplete === true,
  };
}

export function parseList(value: unknown): SettlementList {
  const raw = obj(value);
  const week = maybe(raw.week);
  return {
    count: int(raw.count),
    total: str(raw.total) || "0.00",
    items: list(raw.items).map(parseSummary),
    week: week ? { weekStart: str(week.week_start), total: str(week.total) || "0.00", units: int(week.units) } : null,
    needsActionCount: int(raw.needs_action_count),
  };
}

export function parseDetail(value: unknown): SettlementDetail {
  const raw = obj(value);
  const summary = parseSummary({
    ...raw,
    deliveries_count: obj(raw.deliveries).count,
    returns_count: obj(raw.returns).count,
    pending_count: list(raw.pending).length,
  });
  const establishment = maybe(raw.establishment) ?? {};
  const scheduled = maybe(raw.scheduled);
  const deal = maybe(raw.deal) ?? {};
  const deliveries = maybe(raw.deliveries) ?? {};
  const returns = maybe(raw.returns) ?? {};
  const rain = maybe(raw.rain) ?? {};
  const adjustment = maybe(raw.adjustment) ?? {};
  const daily = maybe(raw.daily) ?? {};
  const key = maybe(raw.payout_key);
  return {
    ...summary,
    sessionId: str(raw.session_id),
    version: int(raw.version),
    establishmentName: str(establishment.name),
    scheduled: scheduled ? { start: str(scheduled.start_time), end: str(scheduled.end_time) } : null,
    startedAt: str(raw.started_at),
    endedAt: str(raw.ended_at),
    deal: {
      payType: str(deal.pay_type),
      dailyRate: money(deal.daily_rate),
      perDeliveryRate: money(deal.per_delivery_rate),
      rainBonusPercent: typeof deal.rain_bonus_percent === "number" ? deal.rain_bonus_percent : null,
    },
    daily: money(daily.amount),
    deliveries: { count: int(deliveries.count), unit: money(deliveries.unit), amount: money(deliveries.amount) },
    returns: { count: int(returns.count), unit: money(returns.unit), amount: money(returns.amount) },
    subtotal: money(raw.subtotal),
    rain: { percent: typeof rain.percent === "number" ? rain.percent : null, applied: rain.applied === true, amount: money(rain.amount) },
    adjustment: { amount: str(adjustment.amount) || "0.00", note: strOrNull(adjustment.note) },
    pending: list(raw.pending).map((p) => ({ deliveryId: str(p.delivery_id), number: int(p.number), reason: str(p.reason) })),
    excluded: list(raw.excluded).map((e) => ({ deliveryId: str(e.delivery_id), number: int(e.number) })),
    lines: list(raw.lines).map((l) => ({
      deliveryId: str(l.delivery_id),
      number: int(l.number),
      kind: str(l.kind),
      reason: strOrNull(l.reason),
      occurredAt: strOrNull(l.occurred_at),
      addressLine: strOrNull(l.address_line),
      amount: money(l.amount),
    })),
    driverDecision: strOrNull(raw.driver_decision),
    driverConfirmedTotal: money(raw.driver_confirmed_total),
    confirmedOverDispute: raw.confirmed_over_dispute === true,
    confirmedAt: strOrNull(raw.confirmed_at),
    paidAt: strOrNull(raw.paid_at),
    paidNote: strOrNull(raw.paid_note),
    history: list(raw.history).map((h) => ({
      action: str(h.action),
      actorRole: str(h.actor_role),
      at: str(h.at),
      totalSeen: money(h.total_seen),
      note: strOrNull(h.note),
    })),
    payoutKey: key ? { type: str(key.type), masked: str(key.masked), value: strOrNull(key.value) } : null,
    frozen: raw.frozen === true,
  };
}
