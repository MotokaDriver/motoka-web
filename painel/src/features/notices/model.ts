import { ApiError } from "@/lib/api/errors";

/** Avisos (`/v1/notifications`). Título e corpo são texto da API (já em pt-BR, escrito por ela) e vão como texto puro. */

export interface Notice {
  readonly id: string;
  readonly createdAt: string;
  readonly type: string;
  readonly title: string;
  readonly body: string;
  readonly isRead: boolean;
  /** Só ids (`order_id`, `negotiation_id`, `settlement_id`, `delivery_id`): nunca texto livre. */
  readonly refs: Readonly<Record<string, string>>;
}

export interface NoticeList {
  readonly total: number;
  readonly items: readonly Notice[];
}

type Raw = Record<string, unknown>;

const isRaw = (value: unknown): value is Raw => value !== null && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value : value == null ? "" : String(value));
const REF_KEYS = ["order_id", "negotiation_id", "settlement_id", "delivery_id"] as const;

export function parseNoticeList(value: unknown): NoticeList {
  if (!isRaw(value)) throw new ApiError({ status: 200, code: "RESPONSE_UNREADABLE" });
  const items = (Array.isArray(value.items) ? value.items : []).filter(isRaw).map((raw): Notice => {
    const data = isRaw(raw.data) ? raw.data : {};
    const refs: Record<string, string> = {};
    for (const key of REF_KEYS) {
      const ref = data[key];
      if (typeof ref === "string") refs[key] = ref;
    }
    return {
      id: str(raw.id),
      createdAt: str(raw.created_at),
      type: str(raw.type).toLowerCase() || "unknown",
      title: str(raw.title),
      body: str(raw.body),
      isRead: raw.is_read === true,
      refs,
    };
  });
  return { total: typeof value.total === "number" ? value.total : items.length, items };
}

export const parseUnread = (value: unknown): number => (isRaw(value) && typeof value.count === "number" ? value.count : 0);
