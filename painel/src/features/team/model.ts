import { ApiError } from "@/lib/api/errors";

/**
 * Modelos de `/v1/teams/me/*` (E1–E16, `teams/application/dto.py`). Enums em minúsculas, dinheiro como
 * string decimal, datas `YYYY-MM-DD` e horas `HH:MM` de São Paulo. O parser é tolerante a maiúsculas
 * (D-W5-10) e a valor desconhecido: o painel nunca quebra por um enum novo.
 */

export type PayType = "fixed_value" | "per_delivery" | "fixed_plus_per_delivery";
export const PAY_TYPES: ReadonlyArray<{ value: PayType; label: string }> = [
  { value: "fixed_value", label: "Diária" },
  { value: "per_delivery", label: "Por entrega" },
  { value: "fixed_plus_per_delivery", label: "Diária + por entrega" },
];

export const usesDailyRate = (type: PayType): boolean => type !== "per_delivery";
export const usesPerDeliveryRate = (type: PayType): boolean => type !== "fixed_value";

export interface Deal {
  readonly payType: PayType;
  readonly dailyRate: string | null;
  readonly perDeliveryRate: string | null;
  readonly rainBonusPercent: number | null;
}

export type MemberStatus = "active" | "paused" | "removed" | "left" | "unknown";
export type TeamAccess = "team" | "full";
export type InviteStatus = "not_opened" | "opened" | "accepted" | "declined" | "expired" | "revoked" | "unknown";

export interface Driver {
  readonly id: string;
  readonly fullName: string;
  readonly shortName: string;
  readonly initials: string;
  readonly phone: string | null;
}

export interface Member {
  readonly id: string;
  readonly driver: Driver;
  readonly status: MemberStatus;
  readonly access: TeamAccess;
  readonly deal: Deal;
  readonly alsoInOtherTeam: boolean;
}

export interface Invite {
  readonly id: string;
  readonly inviteeName: string | null;
  readonly inviteePhone: string | null;
  readonly initials: string;
  readonly createdAt: string | null;
  readonly status: InviteStatus;
}

export interface ShiftSession {
  readonly startedAt: string | null;
  readonly endedAt: string | null;
}

export interface Occurrence {
  readonly shiftId: string;
  /** A série (`series_id`, igual a `shift_id`): é o que "Remover turno" apaga. */
  readonly seriesId: string;
  readonly membershipId: string;
  readonly driverId: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly remindLocation: boolean;
  /** `null` quando a API não disse: o menu esconde a linha de recorrência. */
  readonly repeatsWeekly: boolean | null;
  /** Vínculo pausado: o turno continua na série, mas não acontece (D-12). */
  readonly suspended: boolean;
  readonly session: ShiftSession | null;
}

export interface BusySlot {
  readonly driverId: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
}

export interface CoverageDay {
  readonly date: string;
  readonly lunch: number;
  readonly night: number;
}

export interface Schedule {
  readonly weekStart: string;
  readonly weekEnd: string;
  /** "Hoje" segundo a API (São Paulo). */
  readonly today: string;
  readonly members: readonly Member[];
  readonly pendingInvites: readonly Invite[];
  readonly occurrences: readonly Occurrence[];
  readonly busy: readonly BusySlot[];
  readonly coverage: readonly CoverageDay[];
}

export interface OnShiftDriver {
  readonly membershipId: string;
  readonly driver: Driver;
  readonly shiftId: string;
  readonly endsAt: string | null;
  readonly sessionStarted: boolean;
}

export interface InviteLink {
  readonly id: string;
  readonly url: string;
  readonly joinsLast24h: number;
}

export interface InviteCreated {
  readonly id: string;
  readonly url: string;
  readonly inviteeName: string;
  readonly inviteePhone: string;
}

export interface CreatedShift {
  readonly weekday: number;
  readonly validFrom: string;
}

export interface CreatedShifts {
  readonly count: number;
  readonly items: readonly CreatedShift[];
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

function list(value: unknown): Raw[] {
  return Array.isArray(value) ? value.filter((item): item is Raw => item !== null && typeof item === "object") : [];
}

const str = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const strOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);
const int = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? Math.trunc(value) : 0);
const lower = (value: unknown): string => str(value).toLowerCase();

function id(value: unknown): string {
  const text = str(value);
  return text === "" ? unreadable() : text;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const text = lower(value);
  return (allowed as readonly string[]).includes(text) ? (text as T) : fallback;
}

export function parseDeal(value: unknown): Deal {
  const raw = value !== null && typeof value === "object" ? (value as Raw) : {};
  const bonus = raw.rain_bonus_percent;
  return {
    // Valor desconhecido cai em `per_delivery`, o que a própria API usa para "a definir".
    payType: oneOf(raw.pay_type, ["fixed_value", "per_delivery", "fixed_plus_per_delivery"], "per_delivery"),
    dailyRate: raw.daily_rate == null ? null : str(raw.daily_rate),
    perDeliveryRate: raw.per_delivery_rate == null ? null : str(raw.per_delivery_rate),
    rainBonusPercent: typeof bonus === "number" ? Math.trunc(bonus) : null,
  };
}

/** Combinado "a definir": as duas tarifas nulas. */
export const isUndefinedDeal = (deal: Deal): boolean => deal.dailyRate === null && deal.perDeliveryRate === null;

/** Corpo do pedido: a tarifa que o tipo não usa vai `null` (a API responde `TEAM_DEAL_INVALID` se vier). */
export function dealBody(deal: Deal): Record<string, unknown> {
  return {
    pay_type: deal.payType,
    daily_rate: usesDailyRate(deal.payType) ? deal.dailyRate : null,
    per_delivery_rate: usesPerDeliveryRate(deal.payType) ? deal.perDeliveryRate : null,
    rain_bonus_percent: deal.rainBonusPercent,
  };
}

export function parseDriver(value: unknown): Driver {
  const raw = obj(value);
  const fullName = str(raw.full_name);
  return {
    id: id(raw.id),
    fullName,
    shortName: str(raw.short_name) || fullName,
    initials: str(raw.initials),
    phone: strOrNull(raw.phone),
  };
}

export function parseMember(value: unknown): Member {
  const raw = obj(value);
  return {
    id: id(raw.id),
    driver: parseDriver(raw.driver),
    status: oneOf(raw.status, ["active", "paused", "removed", "left"], "unknown"),
    // Valor desconhecido é tratado como o mais restrito.
    access: lower(raw.access) === "full" ? "full" : "team",
    deal: parseDeal(raw.deal),
    alsoInOtherTeam: raw.also_in_other_team === true,
  };
}

export function parseInvite(value: unknown): Invite {
  const raw = obj(value);
  return {
    id: id(raw.id),
    inviteeName: strOrNull(raw.invitee_name),
    inviteePhone: strOrNull(raw.invitee_phone),
    initials: str(raw.initials),
    createdAt: strOrNull(raw.created_at),
    status: oneOf(raw.status, ["not_opened", "opened", "accepted", "declined", "expired", "revoked"], "unknown"),
  };
}

function parseOccurrence(raw: Raw): Occurrence {
  const session = raw.session !== null && typeof raw.session === "object" ? (raw.session as Raw) : null;
  const shiftId = id(raw.shift_id);
  return {
    shiftId,
    seriesId: str(raw.series_id) || shiftId,
    membershipId: id(raw.membership_id),
    driverId: str(raw.driver_id),
    date: str(raw.date),
    startTime: str(raw.start_time).slice(0, 5),
    endTime: str(raw.end_time).slice(0, 5),
    remindLocation: raw.remind_location !== false,
    repeatsWeekly: typeof raw.repeats_weekly === "boolean" ? raw.repeats_weekly : null,
    suspended: raw.suspended === true,
    session: session ? { startedAt: strOrNull(session.started_at), endedAt: strOrNull(session.ended_at) } : null,
  };
}

export const isInProgress = (o: Occurrence): boolean => o.session !== null && o.session.endedAt === null;

export function parseSchedule(value: unknown): Schedule {
  const raw = obj(value);
  const weekStart = str(raw.week_start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return unreadable();
  return {
    weekStart,
    weekEnd: str(raw.week_end) || weekStart,
    today: str(raw.today) || weekStart,
    members: list(raw.members).map(parseMember),
    pendingInvites: list(raw.pending_invites).map(parseInvite),
    occurrences: list(raw.occurrences).map(parseOccurrence),
    busy: list(raw.busy).map((b) => ({
      driverId: str(b.driver_id),
      date: str(b.date),
      startTime: str(b.start_time).slice(0, 5),
      endTime: str(b.end_time).slice(0, 5),
    })),
    coverage: list(raw.coverage).map((c) => ({ date: str(c.date), lunch: int(c.lunch), night: int(c.night) })),
  };
}

export function parseOnShift(value: unknown): OnShiftDriver[] {
  return list(obj(value).items).map((raw) => ({
    membershipId: id(raw.membership_id),
    driver: parseDriver(raw.driver),
    shiftId: id(raw.shift_id),
    endsAt: strOrNull(raw.ends_at),
    sessionStarted: raw.session_started === true,
  }));
}

export function parseInvites(value: unknown): Invite[] {
  return list(obj(value).items).map(parseInvite);
}

export function parseInviteLink(value: unknown): InviteLink {
  const raw = obj(value);
  return { id: id(raw.id), url: id(raw.url), joinsLast24h: int(raw.joins_last_24h) };
}

export function parseInviteCreated(value: unknown): InviteCreated {
  const raw = obj(value);
  return {
    id: id(raw.id),
    url: id(raw.url),
    inviteeName: str(raw.invitee_name),
    inviteePhone: str(raw.invitee_phone),
  };
}

export function parseCreatedShifts(value: unknown): CreatedShifts {
  const raw = obj(value);
  const items = list(raw.items).map((item) => ({ weekday: int(item.weekday), validFrom: str(item.valid_from) }));
  return { count: typeof raw.count === "number" ? int(raw.count) : items.length, items };
}

// --- Regras ---------------------------------------------------------------------------------

export const isActive = (member: Member): boolean => member.status === "active";
export const isPaused = (member: Member): boolean => member.status === "paused";
export const inviteIsActive = (status: InviteStatus): boolean => status === "not_opened" || status === "opened";
export const inviteCanResend = (status: InviteStatus): boolean => inviteIsActive(status) || status === "expired";

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  not_opened: "Ainda não abriu",
  opened: "Abriu o convite",
  accepted: "Entrou",
  declined: "Recusou",
  expired: "Expirou",
  revoked: "Cancelado",
  unknown: "Sem status",
};

export const inviteDisplayName = (invite: Invite): string => invite.inviteeName ?? "Convite pelo link";

// --- Dinheiro, telefone e horário -----------------------------------------------------------

/** "58.00" → "R$ 58,00", sem passar por `number`. `null` se não for um decimal simples. */
export function formatMoney(value: string | null, dropZeroCents = false): string | null {
  if (value === null) return null;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;
  const integer = (match[2] ?? "0").replace(/^0+(?=\d)/, "");
  const cents = (match[3] ?? "").padEnd(2, "0").slice(0, 2);
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sign = match[1] ?? "";
  if (dropZeroCents && cents === "00") return `R$ ${sign}${grouped}`;
  return `R$ ${sign}${grouped},${cents}`;
}

/** O que o campo de dinheiro mostra para os dígitos digitados: "9000" → "R$ 90,00". */
export function currencyInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
  if (digits === "") return "";
  return formatMoney(`${digits.padStart(3, "0").slice(0, -2)}.${digits.padStart(3, "0").slice(-2)}`) ?? "";
}

/** "R$ 90,00" → "90.00" (só os dígitos). `null` se vazio. */
export function currencyToDecimal(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  if (digits === "") return null;
  const padded = digits.padStart(3, "0");
  const integer = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  return `${integer}.${padded.slice(-2)}`;
}

export const isPositive = (rate: string | null): boolean => rate !== null && Number(rate) > 0;

/** "Diária R$ 90 + R$ 6 por entrega", "R$ 6 por entrega", "A definir". */
export function dealLabel(deal: Deal): string {
  const daily = formatMoney(deal.dailyRate, true);
  const perDelivery = formatMoney(deal.perDeliveryRate, true);
  const parts = [
    ...(usesDailyRate(deal.payType) && daily ? [`Diária ${daily}`] : []),
    ...(usesPerDeliveryRate(deal.payType) && perDelivery ? [`${perDelivery} por entrega`] : []),
  ];
  if (parts.length === 0) return "A definir";
  const base = parts.join(" + ");
  return deal.rainBonusPercent === null ? base : `${base} · +${deal.rainBonusPercent}% na chuva`;
}

/** Celular BR para a tela: "(41) 99999-0077". Aceita com ou sem 55. */
export function formatPhone(raw: string | null): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return raw;
}

/** Máscara do campo de celular enquanto digita. */
export function phoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length === 0 ? "" : `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Máscara de horário: "1800" → "18:00". */
export function timeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

const PALETTE = ["#34C759", "#4A6FC5", "#D4922A", "#9B6BD6", "#2BB3A3"] as const;

/** Cor estável de uma pessoa (FNV-1a sobre o id): a mesma em toda sessão. */
export function entityColor(id: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i) & 0xff;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return PALETTE[hash % PALETTE.length] ?? PALETTE[0];
}
