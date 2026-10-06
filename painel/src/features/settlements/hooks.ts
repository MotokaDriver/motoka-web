"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { isApiError, isUuid } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { POLLING, pollingInterval } from "@/lib/polling/polling";
import { useToast } from "@/ui/Toast";
import { fetchSettlement, fetchSettlements, type ListFilters } from "./api";
import type { SettlementDetail } from "./model";

export const settlementKeys = {
  all: ["settlements"] as const,
  list: (filters: ListFilters) => ["settlements", "list", filters.status?.join(",") ?? "", filters.weekStart ?? "", filters.driverId ?? "", filters.needsAction ?? false] as const,
  detail: (id: string) => ["settlements", "detail", id] as const,
};

/** Lista (S5), a cada 30 s: o motoboy confirma e a loja vê sem recarregar. */
export function useSettlements(filters: ListFilters) {
  return useQuery({
    queryKey: settlementKeys.list(filters),
    queryFn: ({ signal }) => fetchSettlements(filters, signal),
    refetchInterval: pollingInterval(POLLING.badge),
    retry: false,
  });
}

/**
 * Detalhe (S6). `gcTime: 0`: a chave Pix inteira vem aqui e não fica no cache depois que o painel fecha. O cache é
 * só de memória (nada de persistência) e é limpo no logout.
 */
export function useSettlement(id: string | null) {
  return useQuery({
    queryKey: settlementKeys.detail(id ?? ""),
    queryFn: ({ signal }) => fetchSettlement(id ?? "", signal),
    enabled: id !== null && isUuid(id),
    gcTime: 0,
    refetchInterval: pollingInterval(POLLING.badge),
    retry: false,
  });
}

export interface BlockedLine {
  readonly deliveryId: string;
  readonly reason: string;
}

/**
 * Ação sobre um acerto (ajustar, confirmar, pagar). Aplica o acerto da resposta no cache. Num 409 de versão
 * recarrega o acerto e avisa (texto fixo do catálogo): quem viu valores velhos confere de novo antes de agir. Num
 * 409 `HAS_PENDING_LINES` guarda as entregas que travam a confirmação (`errors[]`: id e motivo).
 */
export function useSettlementAction() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<readonly BlockedLine[]>([]);
  const running = useRef(false);

  const run = useCallback(
    async (id: string, call: () => Promise<SettlementDetail>, success?: string): Promise<SettlementDetail | null> => {
      if (running.current) return null;
      running.current = true;
      setBusy(true);
      setError(null);
      setBlocked([]);
      try {
        const detail = await call();
        queryClient.setQueryData(settlementKeys.detail(id), detail);
        if (success) toast({ title: success });
        await queryClient.invalidateQueries({ queryKey: ["settlements", "list"] });
        return detail;
      } catch (failure) {
        if (isApiError(failure)) {
          const text = failure.text();
          if (failure.code === "TEAM_SETTLEMENT_VERSION_CONFLICT") {
            // O servidor mudou o acerto (ajuste, E7, tick): recarrega e avisa; a pessoa confere os valores de novo.
            toast({ title: text });
            await queryClient.invalidateQueries({ queryKey: settlementKeys.detail(id) });
            await queryClient.invalidateQueries({ queryKey: ["settlements", "list"] });
          } else {
            setError(text);
            if (failure.code === "TEAM_SETTLEMENT_HAS_PENDING_LINES") {
              setBlocked(failure.fieldErrors.map((f) => ({ deliveryId: f.field, reason: f.detail })));
            }
            if (failure.code === "TEAM_SETTLEMENT_ALREADY_CLOSED" || failure.code === "TEAM_SETTLEMENT_INVALID_STATE") {
              await queryClient.invalidateQueries({ queryKey: settlementKeys.detail(id) });
            }
          }
        } else {
          setError(UNKNOWN_MESSAGE);
        }
        return null;
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [queryClient, toast],
  );

  const reset = useCallback(() => {
    setError(null);
    setBlocked([]);
  }, []);

  return { busy, error, blocked, run, reset };
}
