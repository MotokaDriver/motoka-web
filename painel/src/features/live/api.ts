import { apiFetch } from "@/features/session/runtime";
import { ApiError, isUuid } from "@/lib/api/errors";
import { API_BASE } from "@/lib/env";
import { parseSnapshot, type LiveSnapshot } from "./model";

/** L1: retrato do mapa ao vivo da loja. */
/** O instante local de chegada acompanha o retrato: o "há N s" usa `server_time - chegada` (sem relógio da máquina). */
export interface LiveBase {
  readonly snapshot: LiveSnapshot;
  readonly receivedAt: number;
}

export const fetchLive = async (signal?: AbortSignal): Promise<LiveBase> => {
  const snapshot = parseSnapshot(await apiFetch<unknown>("/tracking/live", { signal }));
  return { snapshot, receivedAt: Date.now() };
};

/** L2: stream SSE (lido por `fetch` com `Authorization`). */
export const LIVE_STREAM_URL = `${API_BASE}/tracking/live/stream`;

/** E17: pede ao motoboy que ligue a localização (push). No máximo um a cada 5 min por turno. */
export async function remindLocation(membershipId: string): Promise<void> {
  if (!isUuid(membershipId)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  await apiFetch<unknown>(`/teams/me/members/${membershipId}/remind-location`, { method: "POST" });
}
