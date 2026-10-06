"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { POLLING, pollingInterval } from "@/lib/polling/polling";
import { PAGE_SIZE, fetchNotices, fetchUnreadCount, markAllRead, markNoticeRead } from "./api";

export const noticeKeys = { all: ["notices"] as const, list: (unreadOnly: boolean) => ["notices", "list", unreadOnly] as const, unread: ["notices", "unread"] as const };

export function useUnreadCount() {
  return useQuery({ queryKey: noticeKeys.unread, queryFn: ({ signal }) => fetchUnreadCount(signal), refetchInterval: pollingInterval(POLLING.badge), retry: false });
}

export function useNotices(unreadOnly: boolean) {
  return useInfiniteQuery({
    queryKey: noticeKeys.list(unreadOnly),
    queryFn: ({ pageParam, signal }) => fetchNotices({ unreadOnly, offset: pageParam }, signal),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.items.length, 0);
      return last.items.length === PAGE_SIZE && loaded < last.total ? loaded : undefined;
    },
    refetchInterval: pollingInterval(POLLING.badge),
    retry: false,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: markNoticeRead, onSettled: () => queryClient.invalidateQueries({ queryKey: noticeKeys.all }) });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: markAllRead, onSettled: () => queryClient.invalidateQueries({ queryKey: noticeKeys.all }) });
}
