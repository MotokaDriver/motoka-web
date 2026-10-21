"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { isApiError, isUuid } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { POLLING, pollingInterval } from "@/lib/polling/polling";
import { useToast } from "@/ui/Toast";
import { fetchCards, fetchNegotiations, fetchOrder, fetchOrderDrivers, fetchOrders, fetchPayment } from "./api";
import type { Payment } from "./model";

export const serviceKeys = {
  all: ["services"] as const,
  list: (kind: "current" | "upcoming") => ["services", "list", kind] as const,
  order: (id: string) => ["services", "order", id] as const,
  drivers: (id: string) => ["services", "drivers", id] as const,
  negotiations: (id: string) => ["services", "negotiations", id] as const,
  payment: (id: string) => ["services", "payment", id] as const,
  cards: (userId: string) => ["services", "cards", userId] as const,
};

export const UPCOMING_STATUSES = ["waiting_for_drivers", "pending_service_start", "paid", "pending_payment"] as const;

/**
 * As duas listas da tela (como no app): "Em andamento" (service_started, sem filtro de data) e "Próximos" (a partir de
 * hoje 00:00: um pagamento pendente abandonado nunca expira e poluiria a lista). A cada 30 s.
 */
export function useOrderList(kind: "current" | "upcoming", todayStart: string) {
  return useQuery({
    queryKey: [...serviceKeys.list(kind), kind === "upcoming" ? todayStart : ""],
    queryFn: ({ signal }) => fetchOrders(kind === "current" ? { status: ["service_started"] } : { status: UPCOMING_STATUSES, startFrom: todayStart }, signal),
    refetchInterval: pollingInterval(POLLING.badge),
    retry: false,
  });
}

export function useOrder(id: string | null) {
  return useQuery({
    queryKey: serviceKeys.order(id ?? ""),
    queryFn: ({ signal }) => fetchOrder(id ?? "", signal),
    enabled: id !== null && isUuid(id),
    refetchInterval: pollingInterval(POLLING.badge),
    retry: false,
  });
}

export function useOrderDrivers(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: serviceKeys.drivers(id ?? ""),
    queryFn: ({ signal }) => fetchOrderDrivers(id ?? "", signal),
    enabled: enabled && id !== null && isUuid(id),
    retry: false,
  });
}

export function useNegotiations(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: serviceKeys.negotiations(id ?? ""),
    queryFn: ({ signal }) => fetchNegotiations(id ?? "", signal),
    enabled: enabled && id !== null && isUuid(id),
    refetchInterval: pollingInterval(POLLING.badge),
    retry: false,
  });
}

export function useCards(userId: string | null) {
  return useQuery({
    queryKey: serviceKeys.cards(userId ?? ""),
    queryFn: ({ signal }) => fetchCards(userId ?? "", signal),
    enabled: userId !== null && isUuid(userId),
    retry: false,
  });
}

/** Estados terminais do pagamento: o polling para neles. */
export const PAYMENT_TERMINAL: ReadonlySet<Payment["status"]> = new Set(["paid", "failed", "cancelled", "refunded", "expired"]);

/**
 * Status do pagamento (`GET /orders/{id}/payments`), a cada 3 s enquanto não for terminal. **A confirmação do PIX
 * vem só daqui** (status `paid` da API): o clique em "Já fiz o pagamento" só acelera a próxima leitura.
 */
export function usePayment(orderId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: serviceKeys.payment(orderId ?? ""),
    queryFn: ({ signal }) => fetchPayment(orderId ?? "", signal),
    enabled: enabled && orderId !== null && isUuid(orderId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && PAYMENT_TERMINAL.has(status) ? false : 3_000;
    },
    gcTime: 0,
    retry: false,
  });
}

/**
 * Ação (cancelar serviço, aceitar, recusar, contrapropor, cancelar negociação). Roda uma por vez, avisa com o
 * texto do catálogo e invalida o que mudou. Erro desconhecido cai no texto genérico, nunca no `detail`.
 */
export function useServiceAction() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async <T,>(call: () => Promise<T>, opts: { success?: string; orderId?: string } = {}): Promise<{ ok: true; value: T } | { ok: false }> => {
      if (running.current) return { ok: false };
      running.current = true;
      setBusy(true);
      setError(null);
      try {
        const value = await call();
        if (opts.success) toast({ title: opts.success });
        await queryClient.invalidateQueries({ queryKey: serviceKeys.all });
        return { ok: true, value };
      } catch (failure) {
        setError(isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE);
        // O estado mudou por baixo (negociação encerrada, serviço já cancelado): recarrega para a tela dizer a verdade.
        if (isApiError(failure) && failure.status === 409 && opts.orderId) await queryClient.invalidateQueries({ queryKey: serviceKeys.all });
        return { ok: false };
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [queryClient, toast],
  );

  const reset = useCallback(() => setError(null), []);
  return { busy, error, run, reset };
}
