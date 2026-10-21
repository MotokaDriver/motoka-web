import { ApiError } from "@/lib/api/errors";
import { addDays, spDay, spTime } from "@/lib/time/saoPaulo";
import type { CreateShiftsInput } from "./api";
import { dayOfMonth, monthShort, weekdayShort } from "./dates";
import {
  currencyToDecimal,
  isPositive,
  isUndefinedDeal,
  usesDailyRate,
  usesPerDeliveryRate,
  type CreatedShifts,
  type Deal,
  type Member,
  type PayType,
} from "./model";

/** Regras do formulário "Adicionar turno" (spec 4.3), puras e testáveis sem DOM. */

export const MAX_SHIFT_MINUTES = 16 * 60;
export const END_EQUALS_START = "O horário de fim precisa ser diferente do início.";
export const TOO_LONG = "O turno pode ter no máximo 16 horas.";
export const INVALID_TIME = "Use o formato HH:MM, de 00:00 a 23:59.";
export const ENDS_NEXT_DAY = "Termina no dia seguinte.";

export type PayMode = "member" | "custom";

export interface AddShiftForm {
  readonly membershipId: string | null;
  /** 0 = segunda … 6 = domingo. */
  readonly days: readonly number[];
  readonly start: string;
  readonly end: string;
  readonly repeatWeekly: boolean;
  readonly remindLocation: boolean;
  readonly payMode: PayMode;
  readonly customType: PayType;
  /** Texto como o campo mostra ("R$ 90,00"). */
  readonly customDaily: string;
  readonly customPerDelivery: string;
  readonly customRain: number | null;
}

export type DayAvailability = "available" | "started" | "startsNextWeek";

export function initialForm(members: readonly Member[], membershipId?: string | null, day?: number | null): AddShiftForm {
  const initial = membershipId ?? (members.length === 1 ? (members[0]?.id ?? null) : null);
  const member = members.find((m) => m.id === initial);
  return {
    membershipId: initial,
    days: day === null || day === undefined ? [] : [day],
    start: "18:00",
    end: "23:00",
    repeatWeekly: true,
    remindLocation: true,
    // Combinado indefinido não serve de "combinado": o formulário abre em "Outro valor".
    payMode: member && isUndefinedDeal(member.deal) ? "custom" : "member",
    customType: "fixed_plus_per_delivery",
    customDaily: "",
    customPerDelivery: "",
    customRain: null,
  };
}

export function minutesOf(text: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(text);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const duration = (start: number, end: number): number => (end > start ? end - start : end + 24 * 60 - start);

export function timeError(form: Pick<AddShiftForm, "start" | "end">): string | null {
  const start = minutesOf(form.start);
  const end = minutesOf(form.end);
  if (start === null || end === null) return INVALID_TIME;
  if (start === end) return END_EQUALS_START;
  if (duration(start, end) > MAX_SHIFT_MINUTES) return TOO_LONG;
  return null;
}

export function crossesMidnight(form: Pick<AddShiftForm, "start" | "end">): boolean {
  const start = minutesOf(form.start);
  const end = minutesOf(form.end);
  return start !== null && end !== null && end < start;
}

/** O turno do dia (0 = segunda) da semana exibida já começou, pelo relógio de São Paulo? */
export function dayStarted(weekStart: string, day: number, start: string, now: Date): boolean {
  if (minutesOf(start) === null) return false;
  return `${addDays(weekStart, day)}T${start}` <= `${spDay(now)}T${spTime(now)}`;
}

export function availability(form: AddShiftForm, weekStart: string, day: number, now: Date): DayAvailability {
  if (!dayStarted(weekStart, day, form.start, now)) return "available";
  return form.repeatWeekly ? "startsNextWeek" : "started";
}

/** Tira os dias que ficaram desabilitados depois de mudar horário ou repetição. */
export function dropDisabledDays(form: AddShiftForm, weekStart: string, now: Date): AddShiftForm {
  const kept = form.days.filter((d) => availability(form, weekStart, d, now) !== "started");
  return kept.length === form.days.length ? form : { ...form, days: kept };
}

export function customDeal(form: AddShiftForm): Deal {
  return {
    payType: form.customType,
    dailyRate: usesDailyRate(form.customType) ? currencyToDecimal(form.customDaily) : null,
    perDeliveryRate: usesPerDeliveryRate(form.customType) ? currencyToDecimal(form.customPerDelivery) : null,
    rainBonusPercent: form.customRain,
  };
}

export function dealIsValid(deal: Deal): boolean {
  return (!usesDailyRate(deal.payType) || isPositive(deal.dailyRate)) && (!usesPerDeliveryRate(deal.payType) || isPositive(deal.perDeliveryRate));
}

export function payValid(form: AddShiftForm, member: Member | undefined): boolean {
  if (form.payMode === "member") return member !== undefined && !isUndefinedDeal(member.deal);
  return dealIsValid(customDeal(form));
}

export function canSubmit(form: AddShiftForm, member: Member | undefined): boolean {
  return form.membershipId !== null && form.days.length > 0 && timeError(form) === null && payValid(form, member);
}

export const submitLabel = (form: AddShiftForm): string =>
  form.days.length === 1 ? "Salvar 1 turno" : `Salvar ${form.days.length} turnos`;

/** Mudou alguma coisa? O drawer pergunta antes de descartar. */
export function isDirty(form: AddShiftForm, member: Member | undefined): boolean {
  // "Outro valor" é o estado de abertura só para membro sem combinado.
  const customByChoice = form.payMode === "custom" && member !== undefined && !isUndefinedDeal(member.deal);
  return (
    form.days.length > 0 ||
    form.start !== "18:00" ||
    form.end !== "23:00" ||
    customByChoice ||
    form.customDaily !== "" ||
    form.customPerDelivery !== ""
  );
}

export function toInput(form: AddShiftForm, weekStart: string): CreateShiftsInput {
  return {
    membershipId: form.membershipId ?? "",
    weekdays: form.days,
    startTime: form.start,
    endTime: form.end,
    weekStart,
    repeatWeekly: form.repeatWeekly,
    remindLocation: form.remindLocation,
    pay: form.payMode === "custom" ? customDeal(form) : null,
  };
}

export interface SubmitFailure {
  readonly message: string;
  /** Dias que a API recusou (ocupado em outra loja, já começou). */
  readonly errorDays: readonly number[];
}

/** Mensagem fixa do catálogo mais "Dias: Seg, Ter." quando a API apontou `weekdays` (o `message` é dado). */
export function submitFailure(error: ApiError): SubmitFailure {
  let message = error.text();
  const days: number[] = [];
  if (error.code === "TEAM_SHIFT_DRIVER_BUSY" || error.code === "TEAM_SHIFT_IN_PAST") {
    for (const field of error.fieldErrors) {
      const day = Number.parseInt(field.detail, 10);
      if (field.field === "weekdays" && day >= 0 && day <= 6 && !days.includes(day)) days.push(day);
    }
    if (days.length > 0) {
      days.sort((a, b) => a - b);
      message = `${message} Dias: ${days.map((d) => weekdayShort(d)).join(", ")}.`;
    }
  }
  return { message, errorDays: days };
}

/** "3 turnos salvos para Diego." e, se "Repetir" moveu dias, "Seg começa em 6 out." */
export function successMessage(created: CreatedShifts, member: Member | undefined, weekStart: string): string {
  const name = member?.driver.shortName.trim().split(/\s+/)[0] ?? "o motoboy";
  const head = created.count === 1 ? `1 turno salvo para ${name}.` : `${created.count} turnos salvos para ${name}.`;
  const moved = created.items
    .filter((item) => item.validFrom > addDays(weekStart, item.weekday))
    .map((item) => `${weekdayShort(item.weekday)} começa em ${dayOfMonth(item.validFrom)} ${monthShort(item.validFrom)}`);
  return moved.length === 0 ? head : `${head} ${moved.join(", ")}.`;
}
