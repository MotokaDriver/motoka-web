import { apiFetch } from "@/features/session/runtime";
import { ApiError, isUuid } from "@/lib/api/errors";
import { parseDetail, parseList, type SettlementDetail, type SettlementList, type SettlementStatus } from "./model";

/** `/v1/teams/me/settlements` (S5–S9). `API_BASE` já traz o `/v1`. */
const BASE = "/teams/me/settlements";

function idPath(id: string): string {
  if (!isUuid(id)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  return `${BASE}/${id}`;
}

export interface ListFilters {
  readonly status?: readonly SettlementStatus[];
  /** Segunda-feira da semana. */
  readonly weekStart?: string | null;
  readonly driverId?: string | null;
  readonly needsAction?: boolean;
}

export const fetchSettlements = async (filters: ListFilters, signal?: AbortSignal): Promise<SettlementList> =>
  parseList(
    await apiFetch<unknown>(BASE, {
      query: {
        status: filters.status && filters.status.length > 0 ? filters.status.join(",") : undefined,
        week_start: filters.weekStart ?? undefined,
        driver_id: filters.driverId && isUuid(filters.driverId) ? filters.driverId : undefined,
        needs_action: filters.needsAction ? true : undefined,
      },
      signal,
    }),
  );

export const fetchSettlement = async (id: string, signal?: AbortSignal): Promise<SettlementDetail> =>
  parseDetail(await apiFetch<unknown>(idPath(id), { signal }));

export interface AdjustInput {
  readonly version: number;
  readonly rainApplied?: boolean;
  /** String decimal com sinal ("-5.00"). */
  readonly adjustmentAmount?: string;
  readonly adjustmentNote?: string | null;
  readonly dailyRate?: string;
  readonly perDeliveryRate?: string;
  /** O conjunto inteiro de entregas retiradas do acerto (para desfazer, manda sem o id). */
  readonly excludedDeliveryIds?: readonly string[];
}

/** S7. Só manda o que a pessoa mudou. */
export const adjustSettlement = async (id: string, input: AdjustInput): Promise<SettlementDetail> =>
  parseDetail(
    await apiFetch<unknown>(idPath(id), {
      method: "PATCH",
      body: {
        version: input.version,
        ...(input.rainApplied !== undefined ? { rain_applied: input.rainApplied } : {}),
        ...(input.adjustmentAmount !== undefined ? { adjustment_amount: input.adjustmentAmount } : {}),
        ...(input.adjustmentNote !== undefined ? { adjustment_note: input.adjustmentNote } : {}),
        ...(input.dailyRate !== undefined ? { daily_rate: input.dailyRate } : {}),
        ...(input.perDeliveryRate !== undefined ? { per_delivery_rate: input.perDeliveryRate } : {}),
        ...(input.excludedDeliveryIds !== undefined ? { excluded_delivery_ids: input.excludedDeliveryIds } : {}),
      },
    }),
  );

/** S8: `expectedTotal` é o total que a pessoa viu (o servidor confere; diferente → 409 de versão). */
export const confirmSettlement = async (id: string, version: number, expectedTotal: string | null): Promise<SettlementDetail> =>
  parseDetail(await apiFetch<unknown>(`${idPath(id)}/confirm`, { method: "POST", body: { version, expected_total: expectedTotal } }));

/** S9: o Motoka não movimenta dinheiro; a loja paga por Pix fora do app e marca aqui. */
export const markSettlementPaid = async (id: string, note: string | null): Promise<SettlementDetail> =>
  parseDetail(await apiFetch<unknown>(`${idPath(id)}/paid`, { method: "POST", body: note ? { note } : {} }));
