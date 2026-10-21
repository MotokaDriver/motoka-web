import { apiFetch } from "@/features/session/runtime";
import { ApiError, isUuid } from "@/lib/api/errors";
import { parseAwaiting, type Awaiting } from "./model";

export async function fetchAwaiting(signal?: AbortSignal): Promise<Awaiting> {
  const body = await apiFetch<unknown>("/deliveries/awaiting-acceptance", { signal });
  return parseAwaiting(body, Date.now());
}

function path(id: string, action: "accept" | "reject"): string {
  if (!isUuid(id)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  return `/deliveries/${id}/${action}`;
}

/** Aceita com o motoboy previsto (sem `driver_id`, vale o previsto ou a sugestão do momento). */
export async function acceptDelivery(id: string, actionId: string): Promise<undefined> {
  await apiFetch<unknown>(path(id, "accept"), { method: "POST", body: { action_id: actionId } });
  return undefined;
}

export async function rejectDelivery(id: string, actionId: string): Promise<undefined> {
  await apiFetch<unknown>(path(id, "reject"), { method: "POST", body: { action_id: actionId } });
  return undefined;
}
