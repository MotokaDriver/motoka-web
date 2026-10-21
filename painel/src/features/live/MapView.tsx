"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import type { Map as MlMap, Marker, RasterTileSource } from "maplibre-gl";
import { useEffect, useId, useRef, useState } from "react";
import { entityColor } from "@/features/team/model";
import { useOverlayRegistration } from "@/ui/Dialog";
import { MAP_GROUND, MAX_ZOOM, SESSION_MARGIN_MS, SOURCE_ID, TilesError, buildStyle, fetchCopyright, getSession, sessionRemaining, tileUrl, type TileSession, type TilesConfig } from "./googleTiles";
import type { LiveStop } from "./model";
import type { DriverView } from "./state";

// O worker sai no mesmo site (`worker-src 'self'`, sem `blob:`): o pós-build copia para /_maplibre/<versão>/.
maplibregl.setWorkerUrl(`/_maplibre/${process.env.NEXT_PUBLIC_MAPLIBRE_VERSION ?? ""}/maplibre-gl-worker.mjs`);

/** Por que o mapa não subiu: erro (chave, API desligada, rede, sessão recusada) ou cota de tiles (429). */
export type MapFailure = "error" | "quota";

export interface MapViewProps {
  readonly tiles: TilesConfig;
  readonly store: { readonly lat: number; readonly lng: number; readonly name: string } | null;
  readonly views: readonly DriverView[];
  readonly selectedId: string | null;
  /** Paradas do motoboy selecionado (só as que têm coordenadas). */
  readonly stops: readonly LiveStop[];
  readonly onSelect: (driverId: string) => void;
  readonly onFailed: (reason: MapFailure) => void;
  /** O mapa terminou de carregar sem 429 (o LiveScreen zera o backoff da cota). */
  readonly onLoaded?: () => void;
}

const BRAZIL_CENTER: [number, number] = [-52, -14];
/** O timer de renovação dorme no máximo isto: `setTimeout` com semanas estoura e dispara na hora. */
const RENEW_MAX_MS = 24 * 60 * 60 * 1000;
/** Piso do timer de renovação: sessão curta ou relógio adiantado não renovam em laço. */
const RENEW_MIN_MS = 5 * 60 * 1000;
/** Novas tentativas da renovação de rotina que falhou (a sessão atual ainda vale). */
const RETRY_MS = [60_000, 120_000, 300_000] as const;
const COPYRIGHT_DEBOUNCE_MS = 500;
/** Viewport que falha enquanto ainda não há copyright: 5 s, 30 s e depois a cada 2 min, até conseguir. */
const COPYRIGHT_RETRY_MS = [5_000, 30_000, 120_000] as const;
/** Textos do MapLibre em pt-BR (nomes acessíveis dos botões de zoom e do canvas). */
const LOCALE = { "NavigationControl.ZoomIn": "Aproximar", "NavigationControl.ZoomOut": "Afastar", "Map.Title": "Mapa" };

/** Status HTTP do erro de tile (AJAXError do MapLibre) e a URL pedida. */
function tileFailure(event: unknown): { status: number; url: string } | null {
  const error = (event as { error?: { status?: unknown; url?: unknown } }).error;
  return typeof error?.status === "number" ? { status: error.status, url: typeof error.url === "string" ? error.url : "" } : null;
}

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
  el.style.background = stale ? "#6e6e7a" : view.display === "idle" ? "#7f8596" : color;
  el.style.opacity = stale ? "0.7" : "1";
  el.style.borderStyle = stale ? "dashed" : "solid";
  el.style.boxShadow = selected ? `0 0 0 4px ${color}` : "0 1px 4px rgba(0,0,0,.5)";
  el.style.zIndex = selected ? "2" : "1";
}

/** Mapa ao vivo (MapLibre). Carregado só em `/ao-vivo/`. Pins HTML na cor do motoboy, `stale` esmaecido e tracejado. */
export default function MapView({ tiles, store, views, selectedId, stops, onSelect, onFailed, onLoaded }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; el: HTMLElement; key: string }>());
  const stopMarkers = useRef(new Map<string, Marker>());
  const storeMarker = useRef<Marker | null>(null);
  const select = useRef(onSelect);
  const failed = useRef(onFailed);
  const loaded = useRef(onLoaded);
  // O mapa só existe depois da sessão de tiles: os efeitos de loja, pins e paradas esperam por isto, senão rodariam
  // uma vez com `map.current === null` e só voltariam com um evento novo.
  const [ready, setReady] = useState(false);
  const [copyright, setCopyright] = useState("");
  useEffect(() => {
    select.current = onSelect;
    failed.current = onFailed;
    loaded.current = onLoaded;
  });

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let cancelled = false;
    let instance: MlMap | null = null;
    let session: TileSession | null = null;
    // Sessão obtida depois de um 401/403 de tile: se ela também for recusada, o mapa desiste (D-W3b-07).
    let renewedAfterError: string | null = null;
    let renewing = false;
    // 401/403 que chegou com uma renovação de rotina em voo: roda depois dela, se a sessão recusada ainda for a atual.
    let pendingStale: string | null = null;
    let retries = 0;
    let renewTimer: ReturnType<typeof setTimeout> | undefined;
    let copyrightTimer: ReturnType<typeof setTimeout> | undefined;
    let copyrightAbort: AbortController | null = null;
    // Algum viewport já respondeu: daí em diante, falha de copyright mantém o texto anterior, sem nova tentativa.
    let copyrightLoaded = false;
    let quotaHit = false;
    const fail = (reason: MapFailure) => {
      if (cancelled) return;
      if (reason === "quota") quotaHit = true;
      failed.current(reason);
    };
    const adopt = (next: TileSession) => {
      session = next;
    };
    /** Quanto falta para a sessão atual vencer (`receivedAt + ttl`: a sessão do cache, num remount, não ganha tempo). */
    const remaining = () => (session ? sessionRemaining(session) : 0);

    // Próxima renovação em expiry − 1 h, entre 5 min (relógio adiantado ou expiry curto não viram laço) e 24 h.
    const scheduleRenew = () => {
      clearTimeout(renewTimer);
      const delay = Math.min(remaining() - SESSION_MARGIN_MS, RENEW_MAX_MS);
      renewTimer = setTimeout(() => void renew(null), Math.max(delay, RENEW_MIN_MS));
    };
    // Renovação de rotina que falhou com a sessão ainda válida: tenta de novo em 1, 2 e 5 min, sem passar do expiry.
    const scheduleRetry = () => {
      clearTimeout(renewTimer);
      const delay = Math.min(RETRY_MS[Math.min(retries, RETRY_MS.length - 1)] ?? RENEW_MIN_MS, Math.max(remaining(), 0));
      retries += 1;
      renewTimer = setTimeout(() => void renew(null), delay);
    };
    // Renova e troca só a URL dos tiles (`setTiles`): os markers HTML não são tocados (D-W3b-06).
    const renew = async (stale: string | null) => {
      if (renewing) {
        if (stale) pendingStale = stale;
        return;
      }
      renewing = true;
      try {
        const next = await getSession(tiles, stale ? { stale } : {});
        if (cancelled || !instance || !session) return;
        retries = 0;
        if (stale) renewedAfterError = next.session;
        // Sessão "nova" que já nasce dentro da margem (relógio adiantado): na rotina, fica a atual e o piso reagenda.
        const bornLate = sessionRemaining(next) <= SESSION_MARGIN_MS;
        if (next.session !== session.session && (stale || !bornLate)) {
          adopt(next);
          instance.getSource<RasterTileSource>(SOURCE_ID)?.setTiles([tileUrl(tiles, next)]);
        }
        scheduleRenew();
      } catch (error) {
        if (cancelled) return;
        // Recusada pelo tile ou já vencida: não há o que mostrar. Senão (inclusive com 429 no createSession) a sessão
        // atual segue e a renovação tenta de novo.
        if (stale || remaining() <= 0) fail(error instanceof TilesError && error.status === 429 ? "quota" : "error");
        else scheduleRetry();
      } finally {
        renewing = false;
        const again = pendingStale;
        pendingStale = null;
        if (again && !cancelled && session && again === session.session) void renew(again);
      }
    };
    // Notebook suspenso: o timer não correu, e a sessão pode ter vencido enquanto a aba dormia.
    const onVisible = () => {
      if (document.visibilityState === "visible" && session && remaining() <= SESSION_MARGIN_MS) void renew(null);
    };

    // Copyright da área visível (D-W3b-05): no `load` e depois de cada `moveend`, com debounce. Enquanto nenhum viewport
    // respondeu, a falha tenta de novo com backoff (`attempt` conta as tentativas).
    const updateCopyright = (attempt: number) => {
      if (!instance || !session) return;
      copyrightAbort?.abort();
      const abort = new AbortController();
      copyrightAbort = abort;
      const bounds = instance.getBounds();
      fetchCopyright(tiles, session, { north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() }, instance.getZoom(), abort.signal).then(
        (text) => {
          if (cancelled || abort.signal.aborted) return;
          copyrightLoaded = true;
          setCopyright(text);
        },
        // Sem o texto novo, fica o anterior e o mapa segue de pé. Sem texto nenhum ainda, tenta de novo.
        () => {
          if (copyrightLoaded || cancelled || abort.signal.aborted) return;
          const delay = COPYRIGHT_RETRY_MS[Math.min(attempt, COPYRIGHT_RETRY_MS.length - 1)] ?? COPYRIGHT_DEBOUNCE_MS;
          copyrightTimer = setTimeout(() => updateCopyright(attempt + 1), delay);
        },
      );
    };
    const scheduleCopyright = () => {
      clearTimeout(copyrightTimer);
      copyrightTimer = setTimeout(() => updateCopyright(0), COPYRIGHT_DEBOUNCE_MS);
    };

    // A sessão é compartilhada (cache do módulo): o unmount não aborta o fetch, só descarta o resultado aqui. Assim o
    // efeito duplo do StrictMode reaproveita o mesmo pedido.
    getSession(tiles).then(
      (first) => {
        if (cancelled) return;
        adopt(first);
        let created: MlMap;
        try {
          created = new maplibregl.Map({
            container: node,
            style: buildStyle(tiles, first),
            center: store ? [store.lng, store.lat] : BRAZIL_CENTER,
            zoom: store ? 13 : 4,
            maxZoom: MAX_ZOOM,
            // A atribuição é a do Google (logo + copyright), desenhada abaixo.
            attributionControl: false,
            locale: LOCALE,
          });
        } catch {
          fail("error");
          return;
        }
        instance = created;
        map.current = created;
        created.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        created.on("error", (event) => {
          const tile = tileFailure(event);
          if (!tile || !session) return;
          if (tile.status === 429) return fail("quota");
          if (tile.status !== 401 && tile.status !== 403) return;
          // Tile pedido com uma sessão já trocada: a resposta atrasada não conta.
          if (!tile.url.includes(`session=${encodeURIComponent(session.session)}`)) return;
          if (renewedAfterError === session.session) return fail("error");
          void renew(session.session);
        });
        created.on("load", () => {
          updateCopyright(0);
          if (!quotaHit && !cancelled) loaded.current?.();
        });
        created.on("moveend", scheduleCopyright);
        document.addEventListener("visibilitychange", onVisible);
        scheduleRenew();
        setReady(true);
      },
      (error: unknown) => fail(error instanceof TilesError && error.status === 429 ? "quota" : "error"),
    );

    const pins = markers.current;
    const stopPins = stopMarkers.current;
    return () => {
      cancelled = true;
      clearTimeout(renewTimer);
      clearTimeout(copyrightTimer);
      copyrightAbort?.abort();
      document.removeEventListener("visibilitychange", onVisible);
      for (const { marker } of pins.values()) marker.remove();
      pins.clear();
      for (const marker of stopPins.values()) marker.remove();
      stopPins.clear();
      storeMarker.current?.remove();
      storeMarker.current = null;
      instance?.remove();
      map.current = null;
      setReady(false);
    };
    // O mapa nasce uma vez por chave e base; pins e loja são atualizados pelos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles.key, tiles.base]);

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
  }, [store, ready]);

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
  }, [views, selectedId, ready]);

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
  }, [selectedId, ready]);

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
  }, [stops, selectedId, ready]);

  // O CSS do MapLibre põe `position: relative` na classe do mapa: o preenchimento fica no pai.
  // Atribuição do Google (D-W3b-05): logo oficial sem alteração, variante contornada para fundo cheio (mapa),
  // baixado de https://developers.google.com/static/maps/documentation/images/Google_Maps_Attribution_Assets.zip
  // (GoogleMaps_Logo_WithDarkOutline.svg, linkado em https://developers.google.com/maps/documentation/tile/policies).
  return (
    <div className="absolute inset-0" style={{ background: MAP_GROUND }}>
      <div ref={container} className="size-full" data-testid="live-map" />
      {ready && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- export estático, imagem local */}
          <img src="/google-maps-logo.svg" alt="Google Maps" width={86} height={18} className="map-google-logo" />
          {copyright && <Copyright text={copyright} />}
        </>
      )}
    </div>
  );
}

/**
 * Copyright do Google numa linha, à direita do logo. Se não couber (tela estreita, texto longo), vira o botão "Fontes
 * de dados", que abre o texto completo num popover acima dele: nada cobre o logo nem corta a atribuição (D-W3b-05).
 * Esc e clique fora fecham; o Esc devolve o foco ao botão.
 */
function Copyright({ text }: { text: string }) {
  const line = useRef<HTMLParagraphElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const id = useId();
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);
  useOverlayRegistration(open);

  // A linha fica no layout (invisível quando não cabe) só para ser medida a cada mudança de tamanho ou de texto.
  useEffect(() => {
    const el = line.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setOverflows(el.scrollWidth > el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (popover.current?.contains(target) || button.current?.contains(target))) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <>
      <p ref={line} className="map-google-copyright" style={overflows ? { visibility: "hidden" } : undefined}>
        <span>{text}</span>
      </p>
      {overflows && (
        <>
          <button ref={button} type="button" className="map-google-sources" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((v) => !v)}>
            Fontes de dados
          </button>
          {open && (
            <div ref={popover} id={id} className="map-google-popover">
              {text}
            </div>
          )}
        </>
      )}
    </>
  );
}
