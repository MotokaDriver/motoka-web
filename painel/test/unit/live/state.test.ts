import { describe, expect, it } from "vitest";
import { parsePositionEvent, parseSnapshot } from "@/features/live/model";
import { PIN_STALE_MS, applyPositions, applySnapshot, coarseAge, countsOf, fineAge, sortViews, viewOf, viewsOf } from "@/features/live/state";

const SERVER = Date.parse("2026-10-05T21:00:00Z");

const rawDriver = (id: string, over: Record<string, unknown> = {}) => ({
  driver: { id, full_name: `Motoboy ${id}`, short_name: id, initials: id.slice(0, 2).toUpperCase(), phone: "5541999990077" },
  membership_id: `m-${id}`,
  shift: { shift_id: "s", occurrence_date: "2026-10-05", starts_at: "2026-10-05T20:00:00Z", ends_at: "2026-10-05T23:00:00Z" },
  session: { id: "x", started_at: "2026-10-05T20:00:00Z" },
  state: "delivering",
  position: { lat: -25.4, lng: -49.2, accuracy_m: 8, heading: 90, speed_mps: 5, recorded_at: new Date(SERVER - 10_000).toISOString() },
  done_today: { deliveries: 2, returns: 0 },
  last_delivered_at: null,
  current: { delivery_id: "e1", number: 184, status: "on_the_way" },
  stops: [],
  ...over,
});

const snapshot = (drivers: unknown[]) =>
  parseSnapshot({
    server_time: new Date(SERVER).toISOString(),
    no_signal_after_seconds: 180,
    at_store_radius_m: 60,
    establishment: { id: "est", name: "Padaria", location: { lat: -25.43, lng: -49.27 } },
    counts: { on_shift: drivers.length, done_today: { deliveries: 7, returns: 1 } },
    drivers,
  });

const event = (id: string, secondsAgo: number, state = "delivering") =>
  parsePositionEvent({ driver_id: id, lat: -25.41, lng: -49.21, accuracy_m: 5, heading: 0, speed_mps: 1, recorded_at: new Date(SERVER - secondsAgo * 1000).toISOString(), state })!;

describe("snapshot e relógio do servidor", () => {
  it("o 'há N s' usa o relógio do servidor, não o da máquina", () => {
    const state = applySnapshot(snapshot([rawDriver("d1")]), SERVER + 3_600_000); // máquina 1 h adiantada
    const view = viewOf(state, state.drivers[0]!, SERVER + 3_600_000 + 5_000);
    expect(view.ageMs).toBe(15_000);
    expect(fineAge(view.ageMs)).toBe("há 15 s");
    expect(coarseAge(view.ageMs)).toBe("há menos de 1 min");
  });

  it("snapshot ilegível lança", () => {
    expect(() => parseSnapshot({})).toThrow();
    expect(() => parseSnapshot({ server_time: "ontem", drivers: [] })).toThrow();
  });
});

describe("pin: stale depois de 120 s e sem sinal depois de 180 s, decididos pelo cliente", () => {
  const state = applySnapshot(snapshot([rawDriver("d1")]), SERVER);
  const at = (afterSeconds: number) => viewOf(state, state.drivers[0]!, SERVER + afterSeconds * 1000);

  it("fresco, stale, e sem sinal (sem pin) conforme o relógio anda sem nenhum evento", () => {
    expect(at(0)).toMatchObject({ pin: "live", display: "delivering" });
    expect(at(100).pin).toBe("live"); // 110 s de idade
    expect(at(111)).toMatchObject({ pin: "stale", display: "delivering" }); // 121 s
    expect(PIN_STALE_MS).toBe(120_000);
    expect(at(171)).toMatchObject({ pin: null, display: "no_signal" }); // 181 s
  });

  it("um position novo traz o pin de volta", () => {
    const next = applyPositions(state, [event("d1", 1)]);
    expect(viewOf(next, next.drivers[0]!, SERVER + 171_000)).toMatchObject({ pin: "stale" });
    const fresh = applyPositions(state, [event("d1", 0)]);
    expect(viewOf(fresh, fresh.drivers[0]!, SERVER + 5_000)).toMatchObject({ pin: "live", display: "delivering" });
  });

  it("sem posição, turno não iniciado e sem sinal do servidor não têm pin", () => {
    const s = applySnapshot(snapshot([rawDriver("a", { position: null }), rawDriver("b", { state: "not_started", position: null }), rawDriver("c", { state: "no_signal" })]), SERVER);
    const views = viewsOf(s, SERVER);
    expect(views.map((v) => [v.display, v.pin])).toEqual([["no_signal", null], ["not_started", null], ["no_signal", null]]);
  });
});

describe("eventos position", () => {
  it("fora de ordem não volta no tempo; motoboy desconhecido pede resync", () => {
    const state = applySnapshot(snapshot([rawDriver("d1")]), SERVER);
    const newer = applyPositions(state, [event("d1", 2)]);
    const older = applyPositions(newer, [event("d1", 30)]);
    expect(older).toBe(newer);
    expect(applyPositions(state, [event("fantasma", 1)]).needsResync).toBe(true);
    expect(applyPositions(state, [])).toBe(state);
  });

  it("o evento traz o estado novo (quem estava sem sinal volta a entregando)", () => {
    const state = applySnapshot(snapshot([rawDriver("d1", { state: "no_signal" })]), SERVER);
    const next = applyPositions(state, [event("d1", 1, "delivering")]);
    expect(next.drivers[0]?.state).toBe("delivering");
  });

  it("position com dado inválido não vira evento", () => {
    expect(parsePositionEvent({ driver_id: "d1" })).toBeNull();
    expect(parsePositionEvent({ lat: 1, lng: 2 })).toBeNull();
  });
});

describe("contagens e ordem", () => {
  it("contagens derivadas do estado local batem com a lista; ordem: sem sinal, entregando, voltando, na loja", () => {
    const s = applySnapshot(
      snapshot([rawDriver("a"), rawDriver("b", { state: "returning" }), rawDriver("c", { state: "at_store" }), rawDriver("d", { state: "not_started", position: null }), rawDriver("e", { position: null })]),
      SERVER,
    );
    const views = viewsOf(s, SERVER);
    expect(countsOf(views, 7)).toEqual({ onShift: 5, delivering: 1, returning: 1, atStore: 1, idle: 0, noSignal: 2, notStarted: 1, doneToday: 7 });
    expect(sortViews(views).map((v) => v.driver.driverId)).toEqual(["d", "e", "a", "b", "c"]);
  });
});

describe("estado idle (DW-43)", () => {
  it("idle conta, filtra e fica no mapa; estado desconhecido cai em unknown", () => {
    const s = applySnapshot(snapshot([rawDriver("a", { state: "idle" }), rawDriver("b", { state: "futuro_novo" })]), SERVER);
    const views = viewsOf(s, SERVER);
    expect(views.map((v) => v.display)).toEqual(["idle", "unknown"]);
    expect(countsOf(views, 0).idle).toBe(1);
    expect(sortViews(views).map((v) => v.driver.driverId)).toEqual(["a", "b"]);
  });
});
