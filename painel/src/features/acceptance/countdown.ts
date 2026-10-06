/** Contagem do prazo de aceite (sem dependências: o banner mora no shell de todas as telas). */

/** Segundos que faltam até o prazo, pelo relógio do servidor; `null` sem prazo. Nunca negativo. */
export function secondsLeft(deadlineIso: string | null, offsetMs: number, nowMs: number): number | null {
  if (!deadlineIso) return null;
  const deadline = Date.parse(deadlineIso);
  if (Number.isNaN(deadline)) return null;
  return Math.max(0, Math.ceil((deadline - (nowMs + offsetMs)) / 1000));
}

/** "1:40". */
export const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
