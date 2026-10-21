import { addDays, isValidDay, weekStart as mondayOf } from "@/lib/time/saoPaulo";

/** Datas e rótulos da escala. Tudo em dia civil `YYYY-MM-DD` de São Paulo (DN-20). */

const WEEKDAY_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;
const WEEKDAY_LONG = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"] as const;
const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;

function parts(day: string): { y: number; m: number; d: number } {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

/** 0 = segunda … 6 = domingo. */
export function weekdayIndex(day: string): number {
  const { y, m, d } = parts(day);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const weekdayShort = (index: number): string => WEEKDAY_SHORT[index] ?? "";
export const weekdayLong = (index: number): string => WEEKDAY_LONG[index] ?? "";
export const dayOfMonth = (day: string): number => parts(day).d;
export const monthShort = (day: string): string => MONTH_SHORT[parts(day).m - 1] ?? "";

export function capitalized(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

/** "5–11 out" no mesmo mês, "28 set – 4 out" entre meses. */
export function weekRangeLabel(start: string): string {
  const end = addDays(start, 6);
  if (monthShort(start) === monthShort(end)) return `${dayOfMonth(start)}–${dayOfMonth(end)} ${monthShort(end)}`;
  return `${dayOfMonth(start)} ${monthShort(start)} – ${dayOfMonth(end)} ${monthShort(end)}`;
}

/** "Esta semana", "Próxima semana", "Semana passada" ou o intervalo. */
export function weekSelectorLabel(start: string, today: string): string {
  const delta = Math.round(
    (Date.parse(`${start}T00:00:00Z`) - Date.parse(`${mondayOf(today)}T00:00:00Z`)) / 604_800_000,
  );
  if (delta === 0) return "Esta semana";
  if (delta === 1) return "Próxima semana";
  if (delta === -1) return "Semana passada";
  return weekRangeLabel(start);
}

/** `?semana=` só vale se for uma segunda-feira real; senão, a semana atual (D-W5-19). */
export function resolveWeek(raw: string | null, today: string): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && isValidDay(raw) && weekdayIndex(raw) === 0) return raw;
  return mondayOf(today);
}

export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** "18h–23h", ou "18h30–23h" com minutos. */
export function shiftTimeLabel(start: string, end: string): string {
  const part = (time: string) => {
    const [h = "0", m = "0"] = time.split(":");
    const hour = Number(h) || 0;
    const minute = Number(m) || 0;
    return minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, "0")}`;
  };
  return `${part(start)}–${part(end)}`;
}

/** Lua para turno que começa de 17h às 4h59, sol no resto. */
export function isNightShift(start: string): boolean {
  const hour = Number(start.split(":")[0]);
  return Number.isNaN(hour) ? false : hour >= 17 || hour < 5;
}

/** Faixa da regra de cobertura (WS-01 D-W01-12): almoço 11–15, noite 18–23. */
export function shiftBandLabel(hour: number): string | null {
  if (hour >= 11 && hour < 15) return "Turno do almoço 11–15";
  if (hour >= 18 && hour < 23) return "Turno da noite 18–23";
  return null;
}

/** "Ter 29 · 18:06". `day` e `time` vêm de `spDay`/`spTime`. */
export function nowLabel(day: string, time: string): string {
  return `${weekdayShort(weekdayIndex(day))} ${dayOfMonth(day)} · ${time}`;
}

/** A semana exibida é a atual (a faixa "Agora" só existe nela). */
export const isCurrentWeekOf = (weekStart: string, today: string): boolean => mondayOf(today) === weekStart;

/** Semana passada: só leitura. */
export const isPastWeekOf = (weekStart: string, today: string): boolean => weekStart < mondayOf(today);
