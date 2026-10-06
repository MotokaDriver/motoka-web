"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import type { Map as MlMap, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { entityColor } from "@/features/team/model";
import type { LiveStop } from "./model";
import type { DriverView } from "./state";

// O worker sai no mesmo site (`worker-src 'self'`, sem `blob:`): o pós-build copia para /_maplibre/<versão>/.
maplibregl.setWorkerUrl(`/_maplibre/${process.env.NEXT_PUBLIC_MAPLIBRE_VERSION ?? ""}/maplibre-gl-worker.mjs`);

export interface MapViewProps {
  readonly styleUrl: string;
  readonly store: { readonly lat: number; readonly lng: number; readonly name: string } | null;
  readonly views: readonly DriverView[];
  readonly selectedId: string | null;
  /** Paradas do motoboy selecionado (só as que têm coordenadas). */
  readonly stops: readonly LiveStop[];
  readonly onSelect: (driverId: string) => void;
  readonly onFailed: () => void;
}

const BRAZIL_CENTER: [number, number] = [-52, -14];

function pinElement(view: DriverView): HTMLElement {
  const el = document.createElement("div");
  // Decorativo: a lateral "Equipe agora" é a alternativa acessível do mapa (todo dado do pin está no cartão).
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "width:34px;height:34px;border-radius:9999px;display:grid;place-items:center;font:700 12px system-ui,sans-serif;color:#fff;cursor:pointer;border:2px solid #fff;";
  paintPin(el, view, false);
  return el;
}

function paintPin(el: HTMLElement, view: DriverView, selected: boolean): void {
  const color = entityColor(view.driver.driverId);
  const stale = view.pin === "stale";
  el.textContent = view.driver.initials;
  el.style.background = stale ? "#6e6e7a" : color;
  el.style.opacity = stale ? "0.7" : "1";
  el.style.borderStyle = stale ? "dashed" : "solid";
  el.style.boxShadow = selected ? `0 0 0 4px ${color}` : "0 1px 4px rgba(0,0,0,.5)";
  el.style.zIndex = selected ? "2" : "1";
}

/** Mapa ao vivo (MapLibre). Carregado só em `/ao-vivo/`. Pins HTML na cor do motoboy, `stale` esmaecido e tracejado. */
export default function MapView({ styleUrl, store, views, selectedId, stops, onSelect, onFailed }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement; key: string }>());
  const stopMarkers = useRef(new Map<string, Marker>());
  const storeMarker = useRef<Marker | null>(null);
  const select = useRef(onSelect);
  const failed = useRef(onFailed);
  useEffect(() => {
    select.current = onSelect;
    failed.current = onFailed;
  });

  useEffect(() => {
    if (!container.current) return;
    let instance: MlMap;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: styleUrl,
        center: store ? [store.lng, store.lat] : BRAZIL_CENTER,
        zoom: store ? 13 : 4,
        attributionControl: { compact: true },
      });
    } catch {
      failed.current();
      return;
    }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    // Erro do estilo (não dos tiles soltos): o mapa não sobe, e a lateral segue funcionando.
    instance.on("error", (event) => {
      const message = String((event as { error?: { message?: string } }).error?.message ?? "");
      if (/style|Failed to fetch|NetworkError/i.test(message) && !instance.isStyleLoaded()) failed.current();
    });
    const pins = markers.current;
    const stopPins = stopMarkers.current;
    return () => {
      for (const { marker } of pins.values()) marker.remove();
      pins.clear();
      for (const marker of stopPins.values()) marker.remove();
      stopPins.clear();
      storeMarker.current?.remove();
      storeMarker.current = null;
      instance.remove();
      map.current = null;
    };
    // O mapa nasce uma vez por estilo; pins e loja são atualizados pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleUrl]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !store) return;
    storeMarker.current?.remove();
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.title = store.name;
    el.style.cssText = "width:30px;height:30px;border-radius:8px;background:#4a6fc5;border:2px solid #fff;display:grid;place-items:center;color:#fff;font:700 14px system-ui,sans-serif;";
    el.textContent = "L";
    storeMarker.current = new maplibregl.Marker({ element: el }).setLngLat([store.lng, store.lat]).addTo(instance);
  }, [store]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const present = new Set<string>();
    for (const view of views) {
      if (view.pin === null || !view.driver.position) continue;
      const id = view.driver.driverId;
      present.add(id);
      const position = view.driver.position;
      const current = markers.current.get(id);
      // Só mexe no pin que mudou (posição, estado do pin ou seleção): com 100 motoboys e 1 evento por segundo,
      // o resto da camada fica quieto.
      const key = `${position.lat},${position.lng},${view.pin},${id === selectedId}`;
      if (current) {
        if (current.key === key) continue;
        current.key = key;
        current.marker.setLngLat([position.lng, position.lat]);
        paintPin(current.el, view, id === selectedId);
      } else {
        const el = pinElement(view);
        el.addEventListener("click", () => select.current(id));
        paintPin(el, view, id === selectedId);
        const marker = new maplibregl.Marker({ element: el }).setLngLat([position.lng, position.lat]).addTo(instance);
        markers.current.set(id, { marker, el, key });
      }
    }
    // Quem saiu do mapa (sem sinal, turno acabou) perde o pin.
    for (const [id, { marker }] of markers.current) {
      if (!present.has(id)) {
        marker.remove();
        markers.current.delete(id);
      }
    }
  }, [views, selectedId]);

  // Selecionar um cartão (ou um pin) leva o mapa até o motoboy.
  const selectedPosition = views.find((v) => v.driver.driverId === selectedId)?.driver.position ?? null;
  const selectedLat = selectedPosition?.lat;
  const selectedLng = selectedPosition?.lng;
  useEffect(() => {
    const instance = map.current;
    if (!instance || selectedId === null || selectedLat === undefined || selectedLng === undefined) return;
    instance.easeTo({ center: [selectedLng, selectedLat], duration: 400 });
    // Só quando a seleção muda: as posições novas do mesmo motoboy não puxam o mapa a cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

    // Paradas do selecionado: `home` na primeira, as outras em contorno (WebLive.jsx).
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    for (const marker of stopMarkers.current.values()) marker.remove();
    stopMarkers.current.clear();
    const color = selectedId ? entityColor(selectedId) : "#4a6fc5";
    stops.forEach((stop, index) => {
      if (!stop.destination) return;
      const el = document.createElement("div");
      el.setAttribute("aria-hidden", "true");
      el.title = `#${stop.number}`;
      el.style.cssText = `width:22px;height:22px;border-radius:9999px;display:grid;place-items:center;font:700 11px system-ui,sans-serif;border:2px solid ${color};background:${index === 0 ? color : "#0a0a0a"};color:#fff;`;
      el.textContent = String(index + 1);
      stopMarkers.current.set(stop.deliveryId, new maplibregl.Marker({ element: el }).setLngLat([stop.destination.lng, stop.destination.lat]).addTo(instance));
    });
  }, [stops, selectedId]);

  // O CSS do MapLibre põe `position: relative` na classe do mapa: o preenchimento fica no pai.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" data-testid="live-map" />
    </div>
  );
}
