"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSessionStore } from "@/features/session/runtime";
import { decodeAccessToken } from "@/lib/session/jwt";
import { LIVE_STREAM_URL, fetchLive, type LiveBase } from "./api";
import { parsePositionEvent, parseSnapshot, type PositionEvent } from "./model";
import { EMPTY_LIVE, applyPositions, applySnapshot, countsOf, sortViews, viewsOf, type LiveState } from "./state";

interface Stamped {
  readonly event: PositionEvent;
  readonly receivedAt: number;
}
import { LiveStream, type StreamStatus } from "./stream";

export const LIVE_KEY = ["live", "snapshot"] as const;
/** Renova antes de conectar se faltar menos que isto (evita streams curtos logo depois de cada refresh do REST). */
const MIN_TOKEN_LEFT_S = 300;
const FLUSH_MS = 1_000;
const RESYNC_DEBOUNCE_MS = 1_000;

/** Token com pelo menos 300 s de vida, renovado se preciso. `null`: a sessão acabou. */
async function freshToken(): Promise<string | null> {
  const store = getSessionStore();
  const token = store.getAccessToken();
  if (!token) return null;
  const exp = decodeAccessToken(token)?.exp;
  if (exp === null || exp === undefined || exp - Date.now() / 1000 >= MIN_TOKEN_LEFT_S) return token;
  const outcome = await store.refreshForRetry(token);
  if (outcome.kind === "renewed") return outcome.accessToken;
  if (outcome.kind === "rejected") store.expire(outcome.code);
  return outcome.kind === "unavailable" ? token : null;
}

async function renewNow(): Promise<boolean> {
  const store = getSessionStore();
  const token = store.getAccessToken();
  if (!token) return false;
  const outcome = await store.refreshForRetry(token);
  if (outcome.kind === "rejected") store.expire(outcome.code);
  return outcome.kind === "renewed";
}

export interface LiveData {
  readonly loading: boolean;
  readonly error: unknown;
  readonly status: StreamStatus;
  readonly state: LiveState;
  readonly now: number;
  readonly views: ReturnType<typeof sortViews>;
  readonly counts: ReturnType<typeof countsOf>;
  readonly refetch: () => void;
}

/**
 * Dados do mapa ao vivo: L1 como retrato, stream L2 com fallback para polling, `position` coalescido a
 * 1 por segundo por motoboy, e um relógio de 1 s só para o "há N s" e o envelhecimento do pin. O transporte
 * abre ao entrar na tela e fecha ao sair (a vaga do servidor é por loja, R5).
 */
export function useLive(enabled: boolean): LiveData {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: LIVE_KEY, queryFn: ({ signal }) => fetchLive(signal), enabled, retry: false });
  // Retrato vindo do stream (o L1 vem da query). Vale o mais novo; `position` só vale depois dele.
  const [streamBase, setStreamBase] = useState<LiveBase | null>(null);
  const [overlay, setOverlay] = useState<ReadonlyMap<string, Stamped>>(new Map());
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [now, setNow] = useState(() => Date.now());
  const buffer = useRef(new Map<string, PositionEvent>());
  const resyncTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const resync = useCallback(() => {
    clearTimeout(resyncTimer.current);
    resyncTimer.current = setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ["live"] });
      void queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    }, RESYNC_DEBOUNCE_MS);
  }, [queryClient]);

  useEffect(() => {
    if (!enabled) return;
    const stream = new LiveStream({
      url: LIVE_STREAM_URL,
      fetch: (input, init) => window.fetch(input, init),
      getToken: freshToken,
      renew: renewNow,
      poll: async () => {
        await queryClient.fetchQuery({ queryKey: LIVE_KEY, queryFn: ({ signal }) => fetchLive(signal), staleTime: 0 });
      },
      onStatus: setStatus,
      onEvent: (name, data) => {
        if (name === "snapshot") {
          try {
            setStreamBase({ snapshot: parseSnapshot(data), receivedAt: Date.now() });
          } catch {
            resync();
          }
        } else if (name === "position") {
          const event = parsePositionEvent(data);
          if (event) buffer.current.set(event.driverId, event);
        } else {
          // `delivery`, `session` e `resync`: relê o L1 (e a fila de atenção) com debounce de 1 s.
          resync();
        }
      },
    });
    const flush = setInterval(() => {
      if (buffer.current.size === 0) return;
      const received = Date.now();
      const events = [...buffer.current.values()];
      buffer.current.clear();
      setOverlay((current) => {
        const next = new Map(current);
        for (const event of events) next.set(event.driverId, { event, receivedAt: received });
        return next;
      });
    }, FLUSH_MS);
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    const onVisibility = () => stream.setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    stream.setHidden(document.hidden);
    stream.attach();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(flush);
      clearInterval(clock);
      clearTimeout(resyncTimer.current);
      stream.detach();
    };
  }, [enabled, queryClient, resync]);

  const base = useMemo(() => {
    const fromQuery = query.data ?? null;
    return fromQuery && (!streamBase || fromQuery.receivedAt >= streamBase.receivedAt) ? fromQuery : streamBase;
  }, [query.data, streamBase]);
  const state: LiveState = useMemo(() => {
    if (!base) return EMPTY_LIVE;
    const fresh = [...overlay.values()].filter((o) => o.receivedAt > base.receivedAt).map((o) => o.event);
    return applyPositions(applySnapshot(base.snapshot, base.receivedAt), fresh);
  }, [base, overlay]);

  // Motoboy desconhecido num `position`: o estado local pediu releitura.
  useEffect(() => {
    if (state.needsResync) resync();
  }, [state.needsResync, resync]);

  const views = useMemo(() => sortViews(viewsOf(state, now)), [state, now]);
  const counts = useMemo(() => countsOf(views, state.snapshot?.doneToday.deliveries ?? 0), [views, state.snapshot]);
  return {
    loading: enabled && query.isPending,
    error: query.isError && !query.data ? query.error : null,
    status,
    state,
    now,
    views,
    counts,
    refetch: () => void query.refetch(),
  };
}
