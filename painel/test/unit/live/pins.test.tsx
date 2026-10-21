import { act, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePositionEvent, parseSnapshot } from "@/features/live/model";
import { applyPositions, applySnapshot, viewsOf, type DriverView } from "@/features/live/state";

const maplibre = vi.hoisted(() => ({ created: 0, setLngLat: 0, removed: 0, maps: 0, mapsRemoved: 0, handlers: new Map<string, (event: unknown) => void>(), setTiles: [] as string[][] }));
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
    constructor() {
      maplibre.maps += 1;
    }
    addControl() {}
    on(type: string, handler: (event: unknown) => void) {
      maplibre.handlers.set(type, handler);
    }
    getSource() {
      return { setTiles: (urls: string[]) => maplibre.setTiles.push(urls) };
    }
    remove() {
      maplibre.mapsRemoved += 1;
    }
    easeTo() {}
    isStyleLoaded() {
      return true;
    }
  }
  return { Map: MlMap, Marker, NavigationControl: function NavigationControl() {}, setWorkerUrl: () => undefined };
});

vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

// A sessão de tiles (WN-3b) é controlada pelo teste: o mapa só nasce quando ela resolve.
const tiles = vi.hoisted(() => ({ calls: 0, resolve: null as ((value: { session: string; expiry: number }) => void) | null, pending: null as Promise<{ session: string; expiry: number }> | null }));
vi.mock("@/features/live/googleTiles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/live/googleTiles")>()),
  getSession: (_config: unknown, options?: { stale?: string }) => {
    tiles.calls += 1;
    if (options?.stale) return Promise.resolve({ session: `depois-de-${options.stale}`, expiry: Date.now() + 14 * 86_400_000 });
    // Como o cache do módulo: pedidos juntos dividem a mesma promise.
    tiles.pending ??= new Promise((resolve) => (tiles.resolve = resolve));
    return tiles.pending;
  },
  fetchCopyright: async () => "",
}));
const resolveSession = () => act(async () => tiles.resolve?.({ session: "s1", expiry: Date.now() + 14 * 86_400_000 }));

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

const props = (views: DriverView[]) => ({ tiles: { key: "e2e-fake-key-0000000000", base: "http://localhost:8790" }, store: null, views, selectedId: null, stops: [], onSelect: () => undefined, onFailed: () => undefined });

beforeEach(() => {
  maplibre.created = 0;
  maplibre.setLngLat = 0;
  maplibre.removed = 0;
  maplibre.maps = 0;
  maplibre.mapsRemoved = 0;
  maplibre.handlers.clear();
  maplibre.setTiles = [];
  tiles.calls = 0;
  tiles.pending = null;
  tiles.resolve = null;
});

describe("perfil com 100 motoboys (WS-10 §8/§11)", () => {
  it("100 pins nascem uma vez; reler a mesma lista não toca em nenhum; um evento mexe em um pin só", async () => {
    const state = applySnapshot(snapshot(), NOW);
    const first = viewsOf(state, NOW + 1_000);
    const { rerender } = render(<MapView {...props(first)} />);
    await resolveSession();
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

  it("pin que saiu do mapa (sem sinal) é removido, e quem sai da lista também", async () => {
    const state = applySnapshot(snapshot(), NOW);
    const { rerender } = render(<MapView {...props(viewsOf(state, NOW))} />);
    await resolveSession();
    rerender(<MapView {...props(viewsOf(state, NOW + 200_000))} />); // 205 s sem evento: todos sem sinal
    expect(maplibre.removed).toBe(100);
  });
});

describe("mapa depois da sessão de tiles (WN-3b, D-W3b-06)", () => {
  it("a sessão resolve depois do mount e os pins aparecem sem evento novo (estado ready)", async () => {
    const state = applySnapshot(snapshot(), NOW);
    render(<MapView {...props(viewsOf(state, NOW + 1_000))} />);
    expect(maplibre.maps).toBe(0);
    expect(maplibre.created).toBe(0);
    // Nenhum rerender com views novas: só a sessão chega.
    await resolveSession();
    expect(maplibre.maps).toBe(1);
    expect(maplibre.created).toBe(100);
  });

  it("StrictMode (dois mounts seguidos): um fetch de sessão, o mapa sobe uma vez e fica de pé", async () => {
    const state = applySnapshot(snapshot(), NOW);
    render(
      <StrictMode>
        <MapView {...props(viewsOf(state, NOW + 1_000))} />
      </StrictMode>,
    );
    expect(tiles.calls).toBe(2);
    await resolveSession();
    await waitFor(() => expect(maplibre.created).toBe(100));
    // O primeiro mount foi descartado antes da sessão: só o segundo cria o mapa.
    expect(maplibre.maps).toBe(1);
    expect(maplibre.mapsRemoved).toBe(0);
  });

  it("falha na sessão: onFailed(\"error\") e nenhum mapa", async () => {
    const onFailed = vi.fn();
    tiles.pending = Promise.reject(new Error("403"));
    tiles.pending.catch(() => undefined);
    render(<MapView {...props([])} onFailed={onFailed} />);
    await waitFor(() => expect(onFailed).toHaveBeenCalledWith("error"));
    expect(maplibre.maps).toBe(0);
  });

  it("tile 401/403 renova a sessão uma vez (setTiles); recusado de novo, desiste; 429 é cota", async () => {
    const onFailed = vi.fn();
    render(<MapView {...props([])} onFailed={onFailed} />);
    await resolveSession();
    const emit = (status: number, session: string) => act(async () => maplibre.handlers.get("error")?.({ error: { status, url: `http://localhost:8790/v1/2dtiles/1/1/1?session=${session}&key=k` } }));
    await emit(403, "s1");
    expect(maplibre.setTiles).toEqual([["http://localhost:8790/v1/2dtiles/{z}/{x}/{y}?session=depois-de-s1&key=e2e-fake-key-0000000000"]]);
    expect(onFailed).not.toHaveBeenCalled();
    // Resposta atrasada da sessão antiga: não conta.
    await emit(401, "s1");
    expect(onFailed).not.toHaveBeenCalled();
    await emit(403, "depois-de-s1");
    expect(onFailed).toHaveBeenLastCalledWith("error");
    await emit(429, "depois-de-s1");
    expect(onFailed).toHaveBeenLastCalledWith("quota");
  });
});
