"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Btn } from "@/ui/Btn";
import { EmptyState } from "@/ui/EmptyState";
import { Icon } from "@/ui/Icon";
import { InlineError } from "@/ui/InlineError";
import { PageHead } from "@/ui/PageHead";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { cn } from "@/ui/cn";
import "@/features/team/icons";
import { useMarkAllRead, useMarkRead, useNotices, useUnreadCount } from "./hooks";
import { lookOf, relativeTime, targetOf } from "./logic";
import type { Notice } from "./model";

const TONE_TEXT: Record<string, string> = {
  success: "text-success bg-success/15",
  info: "text-info bg-info/15",
  warning: "text-warning bg-warning/15",
  error: "text-error bg-error/15",
  neutral: "text-text-secondary bg-text-secondary/15",
  primary: "text-primary-text bg-primary-light/15",
};

function NoticeRow({ notice, now, onOpen }: { notice: Notice; now: Date; onOpen: (notice: Notice) => void }) {
  const look = lookOf(notice.type);
  const target = targetOf(notice);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(notice)}
        className={cn("flex w-full cursor-pointer items-start gap-3 border-b border-divider px-4 py-3 text-left hover:bg-surface-variant", !notice.isRead && "bg-primary-tint")}
      >
        <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-full", TONE_TEXT[look.tone])}>
          <Icon name={look.icon} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("type-body-md block", notice.isRead ? "text-text-secondary" : "font-bold text-text-primary")}>
            {notice.isRead ? null : <span className="sr-only">Não lido. </span>}
            {notice.title}
          </span>
          <span className="type-body-sm block text-text-secondary">{notice.body}</span>
          <span className="type-caption block text-text-tertiary">{relativeTime(notice.createdAt, now)}</span>
        </span>
        {target && (
          <span aria-hidden className="self-center text-text-tertiary">
            <Icon name="chevron_right" size={18} />
          </span>
        )}
      </button>
    </li>
  );
}

/** "Avisos" (`/avisos/`): lista paginada, chips Todos / Não lidos e "Marcar todos como lidos". */
export function NoticesScreen() {
  const router = useRouter();
  const toast = useToast();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useNotices(unreadOnly);
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const now = useMemo(() => new Date(), [list.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const count = unread.data ?? 0;

  const open = (notice: Notice) => {
    const target = targetOf(notice);
    if (!notice.isRead) {
      markRead.mutate(notice.id, { onError: (failure) => toast({ title: isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE }) });
    }
    if (target) router.push(target);
  };

  return (
    <>
      <PageHead
        title="Avisos"
        sub={count === 0 ? "Nenhum aviso não lido" : count === 1 ? "Você tem 1 aviso não lido" : `Você tem ${count} avisos não lidos`}
        right={
          count > 0 ? (
            <Btn
              kind="secondary"
              loading={markAll.isPending}
              onClick={() => markAll.mutate(undefined, { onError: (failure) => toast({ title: isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE }) })}
            >
              Marcar todos como lidos
            </Btn>
          ) : undefined
        }
      />
      <div role="group" aria-label="Filtro" className="mx-5 mb-3 flex gap-1.5 lg:mx-7">
        {[
          { key: false, label: "Todos" },
          { key: true, label: "Não lidos" },
        ].map((chip) => (
          <button
            key={String(chip.key)}
            type="button"
            aria-pressed={unreadOnly === chip.key}
            onClick={() => setUnreadOnly(chip.key)}
            className={cn(
              "type-label-md min-h-9 cursor-pointer rounded-full border px-3 font-semibold",
              unreadOnly === chip.key ? "border-border bg-primary-tint text-primary-text" : "border-border text-text-secondary hover:bg-surface-variant",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="pb-7">
        {list.isPending ? (
          <div className="grid place-items-center py-16 text-primary-text">
            <Spinner size={32} label="Carregando os avisos" />
          </div>
        ) : list.isError && items.length === 0 ? (
          <div className="mx-5 max-w-[420px] lg:mx-7">
            <InlineError message="Erro ao carregar os avisos." onRetry={() => void list.refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12">
            <EmptyState icon="notifications" title={unreadOnly ? "Nenhum aviso não lido" : "Sem avisos"} description={unreadOnly ? undefined : "Você não tem avisos no momento."} />
          </div>
        ) : (
          <>
            <ul aria-label="Avisos" className="mx-5 overflow-hidden rounded-lg border border-border lg:mx-7">
              {items.map((notice) => (
                <NoticeRow key={notice.id} notice={notice} now={now} onOpen={open} />
              ))}
            </ul>
            {list.hasNextPage && (
              <div className="mx-5 mt-3 lg:mx-7">
                <Btn kind="secondary" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                  Carregar mais
                </Btn>
              </div>
            )}
            {list.isFetchNextPageError && <p className="type-caption mx-5 mt-2 text-error lg:mx-7">Não foi possível carregar mais avisos. Tente novamente.</p>}
          </>
        )}
      </div>
    </>
  );
}
