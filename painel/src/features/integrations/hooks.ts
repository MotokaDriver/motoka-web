"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { POLLING, pollingInterval } from "@/lib/polling/polling";
import { fetchActivity, fetchCards, fetchDetail } from "./api";
import type { IntegrationType } from "./model";

export const integrationKeys = {
  all: ["integrations"] as const,
  cards: ["integrations", "cards"] as const,
  detail: (type: IntegrationType) => ["integrations", "detail", type] as const,
  activity: ["integrations", "activity"] as const,
};

export function useCards() {
  return useQuery({ queryKey: integrationKeys.cards, queryFn: ({ signal }) => fetchCards(signal), refetchInterval: pollingInterval(POLLING.badge), retry: false });
}

/**
 * Detalhe de um tipo. Guarda só o que a API devolve no GET (a dica do secret, nunca o secret); o secret recém-gerado
 * vive no estado do componente e some quando ele sai da tela.
 */
export function useDetail(type: IntegrationType | null, enabled = true) {
  return useQuery({
    queryKey: integrationKeys.detail(type ?? "unknown"),
    queryFn: ({ signal }) => fetchDetail(type ?? "unknown", signal),
    enabled: type !== null && enabled,
    refetchInterval: pollingInterval(POLLING.badge),
    retry: false,
  });
}

export function useActivity() {
  return useInfiniteQuery({
    queryKey: integrationKeys.activity,
    queryFn: ({ pageParam, signal }) => fetchActivity(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchInterval: pollingInterval(POLLING.badge),
    retry: false,
  });
}
