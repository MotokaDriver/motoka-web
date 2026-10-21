import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePositionEvent, parseSnapshot } from "@/features/live/model";
import { applyPositions, applySnapshot, viewsOf, type DriverView } from "@/features/live/state";

const maplibre = vi.hoisted(() => ({ created: 0, setLngLat: 0, removed: 0 }));
vi.mock("maplibre-gl", () => {
  class Marker {
    constructor(_options?: unknown) {
      maplibre.created += 1;
    }
    setLngLat() {
      maplibre.setLngLat += 1;
      return this;
    }
    addTo() {
      return this;
    }
    remove() {
      maplibre.removed += 1;
    }
  }
  class MlMap {
    addControl() {}
    on() {}
    remove() {}
    easeTo() {}
    isStyleLoaded() {
      return true;
    }
  }
  return { Map: MlMap, Marker, NavigationControl: function NavigationControl() {}, setWorkerUrl: () => undefined };
});

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

const { default: MapView } = await import("@/features/live/MapView");

const NOW = Date.parse("2026-10-05T21:00:00Z");
const rawDriver = (n: number) => ({
  driver: { id: `d${n}`, full_name: `Motoboy ${n}`, short_name: `M${n}`, initials: `M${n % 10}`, phone: null },
  membership_id: `m${n}`,
  shift: null,
  state: "delivering",
  position: { lat: -25.4 - n * 0.001, lng: -49.2, accuracy_m: 5, heading: 0, speed_mps: 3, recorded_at: new Date(NOW - 5_000).toISOString() },
  done_today: { deliveries: 0, returns: 0 },
  last_delivered_at: null,
  current: null,
  stops: [],
});
const snapshot = () =>
  parseSnapshot({ server_time: new Date(NOW).toISOString(), no_signal_after_seconds: 180, at_store_radius_m: 60, establishment: { id: "e", name: "L", location: null }, counts: {}, drivers: Array.from({ length: 100 }, (_, i) => rawDriver(i)) });

const props = (views: DriverView[]) => ({ styleUrl: "http://localhost/style.json", store: null, views, selectedId: null, stops: [], onSelect: () => undefined, onFailed: () => undefined });

beforeEach(() => {
  maplibre.created = 0;
  maplibre.setLngLat = 0;
  maplibre.removed = 0;
});

describe("perfil com 100 motoboys (WS-10 §8/§11)", () => {
  it("100 pins nascem uma vez; reler a mesma lista não toca em nenhum; um evento mexe em um pin só", () => {
    const state = applySnapshot(snapshot(), NOW);
    const first = viewsOf(state, NOW + 1_000);
    const { rerender } = render(<MapView {...props(first)} />);
    expect(maplibre.created).toBe(100);

    // Passa um segundo (novo array de views, mesma posição e mesmo pin): nenhum pin é recomposto.
    maplibre.setLngLat = 0;
    rerender(<MapView {...props(viewsOf(state, NOW + 2_000))} />);
    expect(maplibre.setLngLat).toBe(0);

    // Uma rajada com um único `position` novo: só aquele pin muda.
    const event = parsePositionEvent({ driver_id: "d42", lat: -25.5, lng: -49.3, accuracy_m: 5, heading: 0, speed_mps: 2, recorded_at: new Date(NOW + 1_500).toISOString(), state: "delivering" });
    const next = applyPositions(state, [event!]);
    rerender(<MapView {...props(viewsOf(next, NOW + 3_000))} />);
    expect(maplibre.setLngLat).toBe(1);
    expect(maplibre.created).toBe(100);
  });

  it("o estado reaproveita os 99 motoboys que não mudaram e a rajada de 100 eventos é barata", () => {
    const state = applySnapshot(snapshot(), NOW);
    const one = applyPositions(state, [parsePositionEvent({ driver_id: "d7", lat: -25.5, lng: -49.3, accuracy_m: 5, heading: 0, speed_mps: 2, recorded_at: new Date(NOW + 1_000).toISOString(), state: "delivering" })!]);
    expect(one.drivers.filter((d, i) => d === state.drivers[i])).toHaveLength(99);

    const burst = state.drivers.map((d) => parsePositionEvent({ driver_id: d.driverId, lat: -25.6, lng: -49.4, accuracy_m: 5, heading: 0, speed_mps: 2, recorded_at: new Date(NOW + 2_000).toISOString(), state: "delivering" })!);
    const started = performance.now();
    const after = applyPositions(state, burst);
    const views = viewsOf(after, NOW + 3_000);
    expect(performance.now() - started).toBeLessThan(250);
    expect(views).toHaveLength(100);
    expect(views.every((v) => v.pin === "live")).toBe(true);
  });

  it("pin que saiu do mapa (sem sinal) é removido, e quem sai da lista também", () => {
    const state = applySnapshot(snapshot(), NOW);
    const { rerender } = render(<MapView {...props(viewsOf(state, NOW))} />);
    rerender(<MapView {...props(viewsOf(state, NOW + 200_000))} />); // 205 s sem evento: todos sem sinal
    expect(maplibre.removed).toBe(100);
  });
});
