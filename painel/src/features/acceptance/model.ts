import { ApiError } from "@/lib/api/errors";
import { parseItem, type DeliveryItem } from "@/features/deliveries/model";

/**
 * Pedidos de integração esperando a loja (`GET /v1/deliveries/awaiting-acceptance`, WS-13b). O relógio do prazo é o do
 * servidor: `offset = server_time - chegada`, nunca o relógio da máquina sozinho.
 */
export interface AwaitingItem extends DeliveryItem {
  /** `busy`: há gente em turno, mas ninguém livre a tempo; `empty`: ninguém em turno (só a recusa faz sentido). */
  readonly situation: "busy" | "empty";
}

export interface TeamNow {
  readonly id: string;
  readonly shortName: string;
  readonly freeInMinutes: number | null;
}

export interface Awaiting {
  readonly items: readonly AwaitingItem[];
  readonly teamNow: readonly TeamNow[];
  /** `server_time - receivedAt`: soma ao relógio local para chegar ao do servidor. */
  readonly offsetMs: number;
}

type Raw = Record<string, unknown>;
const isRaw = (value: unknown): value is Raw => value !== null && typeof value === "object" && !Array.isArray(value);

export function parseAwaiting(value: unknown, receivedAt: number): Awaiting {
  if (!isRaw(value)) throw new ApiError({ status: 200, code: "RESPONSE_UNREADABLE" });
  const server = Date.parse(typeof value.server_time === "string" ? value.server_time : "");
  const items = (Array.isArray(value.items) ? value.items : []).filter(isRaw).map(
    (raw): AwaitingItem => ({ ...parseItem(raw), situation: raw.situation === "empty" ? "empty" : "busy" }),
  );
  const teamNow = (Array.isArray(value.team_now) ? value.team_now : []).filter(isRaw).map(
    (raw): TeamNow => ({
      id: typeof raw.id === "string" ? raw.id : "",
      shortName: typeof raw.short_name === "string" ? raw.short_name : "",
      freeInMinutes: typeof raw.free_in_minutes === "number" ? raw.free_in_minutes : null,
    }),
  );
  return { items, teamNow, offsetMs: Number.isNaN(server) ? 0 : server - receivedAt };
}

export { clock, secondsLeft } from "./countdown";

/** Há motoboy previsto: o aceite sai com ele. Sem previsto (ninguém em turno), só a recusa. */
export const canAccept = (item: AwaitingItem): boolean => item.situation !== "empty" && item.previewedDriver !== null;
