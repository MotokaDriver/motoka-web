"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/features/session/runtime";
import { POLLING, pollingInterval } from "@/lib/polling/polling";

export const awaitingKey = ["deliveries", "awaiting"] as const;

/** Intervalo com a aba oculta: o prazo do aceite é curto e o PDV costuma ficar na frente, então não pausa; só afrouxa. */
export const HIDDEN_INTERVAL_MS = 30_000;

/**
 * Pedidos esperando o aceite: 5 s em `/pedidos`, 10 s nas outras telas (só com integração conectada). Com a aba oculta
 * continua, a cada 30 s (os navegadores já limitam o timer de fundo), para o aviso do título e o som poderem avisar.
 */
export function useAwaiting(enabled: boolean, baseMs: number) {
  const inner = pollingInterval(baseMs);
  return useQuery({
    queryKey: awaitingKey,
    // O parser de pedidos (e o resto de Pedidos) só carrega quando a consulta roda: o banner mora no shell de toda tela.
    queryFn: async ({ signal }) => (await import("./api")).fetchAwaiting(signal),
    enabled,
    refetchInterval: (query) => {
      const next = inner(query);
      return next === false ? false : typeof document !== "undefined" && document.hidden ? Math.max(next, HIDDEN_INTERVAL_MS) : next;
    },
    refetchIntervalInBackground: true,
    retry: false,
  });
}

/**
 * Há integração Open Delivery ou Saipos conectada? Só então o resto do painel consulta os pedidos de aceite. Erro
 * (inclusive 503 de integrações desligadas) conta como "não".
 */
export function useOdConnected(enabled: boolean): boolean {
  const query = useQuery({
    queryKey: ["integrations", "connected"],
    queryFn: async ({ signal }) => {
      const cards = await apiFetch<unknown>("/integrations", { signal });
      return Array.isArray(cards) && cards.some((c) => c !== null && typeof c === "object" && (c as { status?: unknown }).status === "connected");
    },
    enabled,
    staleTime: 60_000,
    // Conectar invalida "integrations" (a tela de Integrações); o intervalo cobre a conexão feita em outra aba.
    refetchInterval: pollingInterval(POLLING.badge * 2),
    retry: false,
  });
  return query.data === true;
}

/** Relógio de 1 s para a contagem regressiva; parado quando `active` é falso. */
export function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}
