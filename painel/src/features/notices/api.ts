import { apiFetch } from "@/features/session/runtime";
import { ApiError, isUuid } from "@/lib/api/errors";
import { parseNoticeList, parseUnread, type NoticeList } from "./model";

export const PAGE_SIZE = 30;

export const fetchNotices = async (opts: { unreadOnly: boolean; offset: number }, signal?: AbortSignal): Promise<NoticeList> =>
  parseNoticeList(await apiFetch<unknown>("/notifications", { query: { limit: PAGE_SIZE, offset: opts.offset, is_read: opts.unreadOnly ? false : undefined }, signal }));

export const fetchUnreadCount = async (signal?: AbortSignal): Promise<number> => parseUnread(await apiFetch<unknown>("/notifications/unread-count", { signal }));

export async function markNoticeRead(id: string): Promise<void> {
  if (!isUuid(id)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  await apiFetch<unknown>(`/notifications/${id}/read`, { method: "PATCH" });
}

export const markAllRead = async (): Promise<void> => {
  await apiFetch<unknown>("/notifications/read-all", { method: "POST" });
};
