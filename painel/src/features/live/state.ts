import type { DriverState, LiveDriver, LivePosition, LiveSnapshot, PositionEvent } from "./model";

/**
 * Estado do mapa ao vivo (redutor puro, WS-10 §7): o L1 dá o retrato, o stream aplica `position` e o
 * relógio do cliente envelhece o pin. Com o stream aberto o servidor NÃO manda evento quando os pontos
 * param: quem decide `stale` e `no_signal` entre eventos é este módulo, pelo `recorded_at`.
 */

/** Sem `position` por mais de 120 s o pin fica `stale` (requisito do cliente, WS-03c/WN-3). */
export const PIN_STALE_MS = 120_000;

export interface LiveState {
  readonly snapshot: LiveSnapshot | null;
  /** `server_time - relógio local` na hora do snapshot: o "há N s" não depende do relógio da máquina. */
  readonly offsetMs: number;
  readonly drivers: readonly LiveDriver[];
  /** Um `position` de motoboy que o snapshot não conhece: a lista mudou, relê o L1. */
  readonly needsResync: boolean;
}

export const EMPTY_LIVE: LiveState = { snapshot: null, offsetMs: 0, drivers: [], needsResync: false };

export function applySnapshot(snapshot: LiveSnapshot, localNow: number): LiveState {
  return { snapshot, offsetMs: Date.parse(snapshot.serverTime) - localNow, drivers: snapshot.drivers, needsResync: false };
}

const isNewer = (next: LivePosition, current: LivePosition | null): boolean =>
  current === null || Date.parse(next.recordedAt) >= Date.parse(current.recordedAt);

/**
 * Aplica eventos `position` (já coalescidos: o último de cada motoboy). Fora de ordem não volta no
 * tempo; motoboy desconhecido pede releitura do L1.
 */
export function applyPositions(state: LiveState, events: readonly PositionEvent[]): LiveState {
  if (events.length === 0) return state;
  let drivers = state.drivers;
  let needsResync = state.needsResync;
  for (const event of events) {
    const index = drivers.findIndex((d) => d.driverId === event.driverId);
    if (index < 0) {
      needsResync = true;
      continue;
    }
    const current = drivers[index] as LiveDriver;
    if (!isNewer(event.position, current.position)) continue;
    // Um `position` de quem estava "sem sinal" muda o estado: o evento traz o estado novo.
    const next: LiveDriver = { ...current, position: event.position, state: event.state === "unknown" ? current.state : event.state };
    drivers = [...drivers.slice(0, index), next, ...drivers.slice(index + 1)];
  }
  return drivers === state.drivers && needsResync === state.needsResync ? state : { ...state, drivers, needsResync };
}

export const serverNow = (state: LiveState, localNow: number): number => localNow + state.offsetMs;

export type PinKind = "live" | "stale" | null;

export interface DriverView {
  readonly driver: LiveDriver;
  /** Estado mostrado: o do servidor, ou `no_signal` quando os pontos pararam. */
  readonly display: DriverState;
  readonly ageMs: number | null;
  /** `null` = sem pin no mapa (sem posição, sem sinal, turno não iniciado). */
  readonly pin: PinKind;
}

const ON_MAP: ReadonlySet<DriverState> = new Set(["delivering", "returning", "at_store", "unknown"]);

export function viewOf(state: LiveState, driver: LiveDriver, localNow: number): DriverView {
  const noSignalMs = (state.snapshot?.noSignalAfterSeconds ?? 180) * 1000;
  const recorded = driver.position ? Date.parse(driver.position.recordedAt) : Number.NaN;
  const ageMs = Number.isNaN(recorded) ? null : Math.max(0, serverNow(state, localNow) - recorded);
  let display = driver.state;
  if (ON_MAP.has(display) && (ageMs === null || ageMs > noSignalMs)) display = "no_signal";
  const onMap = ON_MAP.has(display) && driver.position !== null && ageMs !== null;
  return { driver, display, ageMs, pin: onMap ? (ageMs > PIN_STALE_MS ? "stale" : "live") : null };
}

export function viewsOf(state: LiveState, localNow: number): DriverView[] {
  return state.drivers.map((driver) => viewOf(state, driver, localNow));
}

export interface LiveCounts {
  readonly onShift: number;
  readonly delivering: number;
  readonly returning: number;
  readonly atStore: number;
  /** Inclui `not_started`: a pílula do WS-10 conta "Sem sinal" assim (cada estado também tem a sua conta). */
  readonly noSignal: number;
  readonly notStarted: number;
  readonly doneToday: number;
}

/** Contagens derivadas do estado local (R7): pílula, chips e cartões batem entre si. */
export function countsOf(views: readonly DriverView[], doneToday: number): LiveCounts {
  const by = (state: DriverState) => views.filter((v) => v.display === state).length;
  return {
    onShift: views.length,
    delivering: by("delivering"),
    returning: by("returning"),
    atStore: by("at_store"),
    noSignal: by("no_signal") + by("not_started"),
    notStarted: by("not_started"),
    doneToday,
  };
}

/** "há menos de 1 min", "há 3 min": rótulo de leitor de tela (muda por minuto, não por segundo). */
export function coarseAge(ageMs: number | null): string {
  if (ageMs === null) return "sem posição";
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return "há menos de 1 min";
  return `há ${minutes} min`;
}

/** "há 12 s" / "há 3 min" visual. */
export function fineAge(ageMs: number | null): string {
  if (ageMs === null) return "sem posição";
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 60) return `há ${seconds} s`;
  return `há ${Math.floor(seconds / 60)} min`;
}

const ORDER: Record<DriverState, number> = { no_signal: 0, not_started: 0, delivering: 1, returning: 2, at_store: 3, unknown: 4 };

/** Ordem da lateral: sem sinal, entregando, voltando, na loja. */
export const sortViews = (views: readonly DriverView[]): DriverView[] =>
  [...views].sort((a, b) => ORDER[a.display] - ORDER[b.display] || a.driver.shortName.localeCompare(b.driver.shortName, "pt-BR"));
