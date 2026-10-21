"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { POLLING, pollingInterval } from "@/lib/polling/polling";
import { useToast } from "@/ui/Toast";
import { fetchOnShift, fetchSchedule } from "./api";

export const teamKeys = {
  all: ["team"] as const,
  schedule: (week: string) => ["team", "schedule", week] as const,
  onShift: ["team", "on-shift"] as const,
};

/** Escala da semana (E15), a cada 60 s. Sem retry: o backoff vem do `refetchInterval` (DN-07). */
export function useSchedule(week: string) {
  return useQuery({
    queryKey: teamKeys.schedule(week),
    queryFn: ({ signal }) => fetchSchedule(week, signal),
    refetchInterval: pollingInterval(POLLING.teamSchedule),
    retry: false,
  });
}

/** Quem está em turno (E16), a cada 30 s. É secundária: uma falha mantém a última lista, sem aviso. */
export function useOnShift(enabled: boolean) {
  return useQuery({
    queryKey: teamKeys.onShift,
    queryFn: ({ signal }) => fetchOnShift(signal),
    refetchInterval: pollingInterval(POLLING.onShift),
    retry: false,
    enabled,
  });
}

/** Relógio da faixa "Agora": reavalia a cada `ms`, mas só muda o estado quando o minuto vira. */
export function useNow(ms = 20_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      const next = new Date();
      setNow((current) => (Math.floor(current.getTime() / 60_000) === Math.floor(next.getTime() / 60_000) ? current : next));
    }, ms);
    return () => clearInterval(timer);
  }, [ms]);
  return now;
}

/**
 * Executa uma ação sobre membro ou turno: uma por vez (`busyId` é o alvo, para o spinner no botão),
 * toast com o resultado (texto fixo do catálogo, nunca o `detail`) e releitura da escala.
 */
export function useTeamActions() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (targetId: string, action: () => Promise<unknown>, success: string) => {
      if (running.current) return;
      running.current = true;
      setBusyId(targetId);
      try {
        await action();
        toast({ title: success });
        await queryClient.invalidateQueries({ queryKey: teamKeys.all });
      } catch (error) {
        toast({ title: isApiError(error) ? error.text() : UNKNOWN_MESSAGE });
      } finally {
        running.current = false;
        setBusyId(null);
      }
    },
    [queryClient, toast],
  );

  return { busyId, run };
}
