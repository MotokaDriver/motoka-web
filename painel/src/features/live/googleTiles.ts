import type { StyleSpecification } from "maplibre-gl";

// Map Tiles API do Google (WN-3b, D-W3b-01): tiles raster 2D dentro do MapLibre, sem o Maps JS (a CSP estrita
// não comporta o script, o `unsafe-eval` nem o `blob:` dele). Contratos em docs/painel/WN-3b-mapa-google-plano.md.

/** Chave de navegador e base dos tiles (`https://tile.googleapis.com` em prod; o mock na 8790 no E2E). */
export interface TilesConfig {
  readonly key: string;
  readonly base: string;
}

export interface TileSession {
  readonly session: string;
  /** Fim da validade, em ms (o Google manda segundos epoch como string). */
  readonly expiry: number;
  /**
   * Validade relativa na hora da resposta (`expiry` − relógio local). O agendamento parte dela: relógio adiantado
   * ou expiry curto encolhem o ttl, e o MapView põe um piso em vez de renovar em laço.
   */
  readonly ttl?: number;
  /** Relógio local na hora da resposta: com o `ttl`, a validade de uma sessão do cache não é superestimada no remount. */
  readonly receivedAt?: number;
}

/** Falha HTTP (ou de rede, `status` 0) da Map Tiles API. */
export class TilesError extends Error {
  constructor(readonly status: number) {
    super(`Map Tiles API respondeu ${status}`);
  }
}

/** A sessão é renovada quando falta menos que isto para o `expiry` (D-W3b-06). */
export const SESSION_MARGIN_MS = 60 * 60 * 1000;
export const SOURCE_ID = "google";
/** Teto do zoom (D-W3b-09): cada nível a mais multiplica os tiles cobrados. */
export const MAX_ZOOM = 20;
/** Cor do chão do mapa (o `geometry` do estilo escuro): fundo do estilo e do contêiner, sem clarão antes dos tiles. */
export const MAP_GROUND = "#161a22";

/**
 * Visual escuro do design (WebLive.jsx), no formato de estilo do Google. Curto de propósito: estilo grande demais é
 * ignorado em silêncio pelo `createSession`. POI e transporte saem: o mapa é de entregas, não de passeio.
 */
export const DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: MAP_GROUND }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a919e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f1218" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2c3240" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3444" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#384152" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#465064" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0b0e14" }] },
] as const;

/** Quanto falta para a sessão vencer: `receivedAt + ttl − agora` (ou `expiry − agora`, se faltar algum dos dois). */
export function sessionRemaining(session: TileSession, now = Date.now()): number {
  return session.receivedAt !== undefined && session.ttl !== undefined ? session.receivedAt + session.ttl - now : session.expiry - now;
}

/** Corpo do `createSession` (D-W3b-04): raster 512 px servido em `tileSize` 256 fica nítido em tela retina. */
export function sessionBody() {
  return { mapType: "roadmap", language: "pt-BR", region: "BR", scale: "scaleFactor2x", highDpi: true, styles: DARK_STYLES };
}

async function request(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (init?.signal?.aborted) throw error;
    throw new TilesError(0);
  }
  if (!response.ok) throw new TilesError(response.status);
  try {
    return await response.json();
  } catch {
    throw new TilesError(response.status);
  }
}

/** `POST /v1/createSession`. Resposta sem `session` ou `expiry` válidos é falha como qualquer outra. */
export async function createSession(config: TilesConfig): Promise<TileSession> {
  const body = (await request(`${config.base}/v1/createSession?key=${encodeURIComponent(config.key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessionBody()),
  })) as { session?: unknown; expiry?: unknown } | null;
  const session = typeof body?.session === "string" ? body.session : "";
  const expiry = Number(body?.expiry) * 1000;
  if (!session || !Number.isFinite(expiry)) throw new TilesError(0);
  const receivedAt = Date.now();
  return { session, expiry, ttl: expiry - receivedAt, receivedAt };
}

interface Entry {
  readonly config: TilesConfig;
  readonly promise: Promise<TileSession>;
  value: TileSession | null;
}

// Cache do módulo (D-W3b-06): guarda a promise em voo, então dois pedidos juntos (o efeito duplo do StrictMode)
// dividem um fetch; rejeição sai do cache no `catch` e o próximo pedido tenta de novo.
let cached: Entry | null = null;

/**
 * Sessão reaproveitada enquanto faltar mais de 1 h para o `expiry`. `stale` é a sessão que o tile recusou (401/403):
 * se for a do cache, ela é descartada; se outro pedido já trouxe uma nova, essa é reaproveitada.
 */
export function getSession(config: TilesConfig, options: { stale?: string; now?: number } = {}): Promise<TileSession> {
  const now = options.now ?? Date.now();
  const entry = cached;
  if (entry && entry.config.key === config.key && entry.config.base === config.base) {
    const value = entry.value;
    if (value === null) return entry.promise;
    if (value.session !== options.stale && value.expiry - now > SESSION_MARGIN_MS) return entry.promise;
  }
  const next: Entry = {
    config,
    value: null,
    promise: createSession(config).then(
      (value) => {
        next.value = value;
        return value;
      },
      (error: unknown) => {
        if (cached === next) cached = null;
        throw error;
      },
    ),
  };
  cached = next;
  return next.promise;
}

/** Só para testes: zera o cache do módulo. */
export function resetSessionCache(): void {
  cached = null;
}

/** URL dos tiles da sessão (trocada com `setTiles` na renovação, sem refazer o estilo). */
export function tileUrl(config: TilesConfig, session: TileSession): string {
  return `${config.base}/v1/2dtiles/{z}/{x}/{y}?session=${encodeURIComponent(session.session)}&key=${encodeURIComponent(config.key)}`;
}

/** Estilo do MapLibre com uma fonte raster só. Sem glyphs nem sprite: os rótulos já vêm desenhados no tile. */
export function buildStyle(config: TilesConfig, session: TileSession): StyleSpecification {
  return {
    version: 8,
    sources: { [SOURCE_ID]: { type: "raster", tiles: [tileUrl(config, session)], tileSize: 256, maxzoom: MAX_ZOOM } },
    layers: [
      { id: "fundo", type: "background", paint: { "background-color": MAP_GROUND } },
      { id: SOURCE_ID, type: "raster", source: SOURCE_ID },
    ],
  };
}

export interface Bounds {
  readonly north: number;
  readonly south: number;
  readonly east: number;
  readonly west: number;
}

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/** `GET /tile/v1/viewport`: o texto de copyright da área visível (D-W3b-05), obrigatório na atribuição. */
export async function fetchCopyright(config: TilesConfig, session: TileSession, bounds: Bounds, zoom: number, signal?: AbortSignal): Promise<string> {
  const params = new URLSearchParams({
    session: session.session,
    key: config.key,
    zoom: String(Math.max(0, Math.min(MAX_ZOOM, Math.round(zoom)))),
    north: String(clamp(bounds.north, 90)),
    south: String(clamp(bounds.south, 90)),
    east: String(clamp(bounds.east, 180)),
    west: String(clamp(bounds.west, 180)),
  });
  const body = (await request(`${config.base}/tile/v1/viewport?${params.toString()}`, { signal })) as { copyright?: unknown } | null;
  return typeof body?.copyright === "string" ? body.copyright : "";
}
