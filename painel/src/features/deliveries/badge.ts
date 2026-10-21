"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/features/session/runtime";
import { POLLING, pollingInterval } from "@/lib/polling/polling";

/**
 * Badge "precisa de atenção" da sidebar (E3, 30 s). Fica num módulo próprio e leve: a sidebar o importa e
 * não pode arrastar parsers e telas de Pedidos para o primeiro carregamento. Erro ou zero: sem badge.
 */
export function useAttentionBadge(enabled: boolean): number {
  const query = useQuery({
    queryKey: ["deliveries", "badge"],
    queryFn: async ({ signal }) => {
      const body = await apiFetch<{ needs_attention?: unknown }>("/deliveries/summary", { signal });
      return typeof body?.needs_attention === "number" ? body.needs_attention : 0;
    },
    enabled,
    refetchInterval: pollingInterval(POLLING.badge),
    retry: false,
  });
  return query.data ?? 0;
}
