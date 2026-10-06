import type { Query } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/errors";

/** Intervalos de polling por tópico (§5.5), em ms. Cada tópico lê só o próprio endpoint. */
export const POLLING = {
  deliveries: 10_000,
  delivery: 10_000,
  onShift: 30_000,
  teamSchedule: 60_000,
  badge: 30_000,
} as const;

export const MAX_BACKOFF_MS = 60_000;

/**
 * Próximo intervalo depois de `failures` falhas seguidas: dobra a partir da base até 60 s, e
 * respeita o `Retry-After` (s) de um 429/503. Sem falha, volta à base.
 */
export function backoffInterval(baseMs: number, failures: number, retryAfterSec: number | null): number {
  if (failures <= 0) return baseMs;
  const doubled = Math.min(MAX_BACKOFF_MS, baseMs * 2 ** failures);
  const floor = retryAfterSec !== null ? retryAfterSec * 1000 : 0;
  return Math.max(doubled, floor);
}

type PollingState = Pick<Query["state"], "error" | "errorUpdateCount" | "errorUpdatedAt" | "dataUpdatedAt">;

const successBaseline = new WeakMap<object, number>();

/**
 * Falhas seguidas desde o último sucesso. Não dá para usar `fetchFailureCount`: o TanStack Query
 * v5 zera esse contador no início de cada fetch, então com `retry: 0` ele nunca passa de 1
 * (conferido no teste com relógio falso). Conta pelo `errorUpdateCount`, com a linha de base
 * gravada no último sucesso.
 */
export function consecutiveFailures(query: { state: PollingState }): number {
  const { errorUpdateCount, errorUpdatedAt, dataUpdatedAt } = query.state;
  if (errorUpdateCount === 0 || dataUpdatedAt >= errorUpdatedAt) {
    successBaseline.set(query, errorUpdateCount);
    return 0;
  }
  return errorUpdateCount - (successBaseline.get(query) ?? 0);
}

/**
 * `refetchInterval` de uma query de polling. O backoff vem só daqui: as queries de polling usam
 * `retry: 0`, para o retry do Query não somar tiros (DN-07). 403 e 404 param o polling.
 */
export function pollingInterval(baseMs: number) {
  return (query: { state: PollingState }): number | false => {
    const { error } = query.state;
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return false;
    const retryAfter = error instanceof ApiError ? error.retryAfter : null;
    return backoffInterval(baseMs, consecutiveFailures(query), retryAfter);
  };
}

/**
 * Política de `retry` das queries (DN-07, ressalva 9): nunca em 4xx (o 401 o cliente já tratou, o
 * 429 é do backoff); em rede ou 5xx, no máximo 1. Polling e mutações usam 0.
 */
export function queryRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status !== null && error.status < 500) return false;
    return failureCount < 1;
  }
  return false;
}
