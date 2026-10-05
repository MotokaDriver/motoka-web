"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError, isUuid } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { POLLING, pollingInterval } from "@/lib/polling/polling";
import { useToast } from "@/ui/Toast";
import { fetchDelivery, fetchList, PAGE_SIZE } from "./api";
import type { DeliveryDetail } from "./model";

export const deliveryKeys = {
  all: ["deliveries"] as const,
  list: (scope: string, date: string | null) => ["deliveries", "list", scope, date] as const,
  detail: (id: string) => ["deliveries", "detail", id] as const,
};

/** Lista (10 s). "Mostrar mais" soma páginas por `offset`; o polling relê as páginas já carregadas. */
export function useDeliveryList(scope: "open" | "all", date: string) {
  return useInfiniteQuery({
    queryKey: deliveryKeys.list(scope, scope === "all" ? date : null),
    queryFn: ({ pageParam, signal }) => fetchList({ scope, date, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < last.total && last.items.length === PAGE_SIZE ? loaded : undefined;
    },
    refetchInterval: pollingInterval(POLLING.deliveries),
    retry: false,
  });
}

/** Detalhe do pedido selecionado (10 s). Um id que não é UUID nunca chama a API (ressalva 12). */
export function useDelivery(id: string | null) {
  const valid = id !== null && isUuid(id);
  return useQuery({
    queryKey: deliveryKeys.detail(id ?? ""),
    queryFn: ({ signal }) => fetchDelivery(id ?? "", signal),
    enabled: valid,
    refetchInterval: pollingInterval(POLLING.delivery),
    retry: false,
  });
}

/**
 * Executa uma ação da loja sobre um pedido. O `action_id` nasce por toque e é reaproveitado no "Tentar
 * de novo" do mesmo toque, depois de falha de rede (D-W5-13). Aplica o detalhe da resposta no cache e
 * relê a lista; em `INVALID_TRANSITION`, `ALREADY_FINISHED` e `CANCELLED` relê o pedido. `overrides`
 * são textos fixos da tela, nunca do backend.
 */
export function useDeliveryAction(overrides: Readonly<Record<string, string>> = {}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionId = useRef<string | null>(null);
  const actionKey = useRef<string | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (id: string, key: string, call: (actionId: string) => Promise<DeliveryDetail | undefined>, success?: string): Promise<boolean> => {
      if (running.current) return false;
      running.current = true;
      setBusy(true);
      setError(null);
      // Outra ação (ou outro pedido) nunca herda o `action_id` de um toque que falhou na rede.
      if (actionKey.current !== `${id}:${key}`) actionId.current = null;
      actionKey.current = `${id}:${key}`;
      actionId.current ??= crypto.randomUUID();
      try {
        const detail = await call(actionId.current);
        actionId.current = null;
        if (detail) queryClient.setQueryData(deliveryKeys.detail(id), detail);
        if (success) toast({ title: success });
        await queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
        return true;
      } catch (failure) {
        if (isApiError(failure)) {
          setError(failure.text(overrides));
          // Só uma resposta definitiva (4xx de negócio) encerra o toque. Rede, 5xx (inclusive 502/504 da
          // Cloudflare, que podem chegar depois de o origin gravar) e 429 mantêm o `action_id`: a nova tentativa
          // recebe a resposta idempotente em vez de duplicar a ação.
          if (!failure.isUnavailable) actionId.current = null;
          if (
            failure.code === "DELIVERY_INVALID_TRANSITION" ||
            failure.code === "DELIVERY_ALREADY_FINISHED" ||
            failure.code === "DELIVERY_CANCELLED"
          ) {
            void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
          }
        } else {
          setError(UNKNOWN_MESSAGE);
          actionId.current = null;
        }
        return false;
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [overrides, queryClient, toast],
  );

  /** Novo toque: esquece o `action_id` e o erro. */
  const reset = useCallback(() => {
    actionId.current = null;
    setError(null);
  }, []);

  return { busy, error, run, reset };
}

/** Relógio do "ontem 23:50" e do dia do filtro "Todos": avança sozinho na virada da meia-noite. */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export { isApiError };
