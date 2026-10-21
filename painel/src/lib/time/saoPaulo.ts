/**
 * Datas do painel sempre no fuso de São Paulo, explícito via `Intl` (DN-20). O navegador pode estar
 * em qualquer fuso, e o Brasil não tem horário de verão desde 2019: nunca se assume UTC−3 fixo.
 */
export const SP_TIME_ZONE = "America/Sao_Paulo";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const shortDayFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
});

/** Dia civil em São Paulo, `YYYY-MM-DD`. */
export function spDay(instant: Date): string {
  return dayFormatter.format(instant);
}

/** `HH:mm` em São Paulo. */
export function spTime(instant: Date): string {
  return timeFormatter.format(instant);
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Soma dias a um dia civil, sem passar por fuso (aritmética em UTC puro). */
export function addDays(day: string, amount: number): string {
  const match = ISO_DAY.exec(day);
  if (!match) throw new Error(`Dia inválido: ${day}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + amount));
  return date.toISOString().slice(0, 10);
}

/** `true` só para um dia civil que existe (`2026-02-30` é falso). */
export function isValidDay(day: string): boolean {
  const match = ISO_DAY.exec(day);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === day;
}

/** Segunda-feira da semana do dia (a semana do painel começa na segunda). */
export function weekStart(day: string): string {
  const match = ISO_DAY.exec(day);
  if (!match) throw new Error(`Dia inválido: ${day}`);
  const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  const sinceMonday = (weekday + 6) % 7;
  return addDays(day, -sinceMonday);
}

/** Segunda-feira da semana atual em São Paulo. */
export function currentWeekStart(now: Date): string {
  return weekStart(spDay(now));
}

/** "hoje 18:41", "ontem 23:50" ou "03/10 09:12", tudo no fuso de São Paulo. */
export function relativeDayTime(instant: Date, now: Date): string {
  const day = spDay(instant);
  const today = spDay(now);
  const time = spTime(instant);
  if (day === today) return `hoje ${time}`;
  if (day === addDays(today, -1)) return `ontem ${time}`;
  return `${shortDayFormatter.format(instant)} ${time}`;
}
