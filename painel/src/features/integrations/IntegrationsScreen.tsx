"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ORIGIN_INFO, type Origin } from "@/features/deliveries/model";
import { SourceBadge } from "@/features/deliveries/SourceBadge";
import { relativeTime } from "@/features/notices/logic";
import { spTime } from "@/lib/time/saoPaulo";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Btn } from "@/ui/Btn";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { EmptyState } from "@/ui/EmptyState";
import { Icon } from "@/ui/Icon";
import { InlineError } from "@/ui/InlineError";
import { PageHead } from "@/ui/PageHead";
import { Spinner } from "@/ui/Spinner";
import { cn } from "@/ui/cn";
import "@/features/team/icons";
import { useActivity, useCards } from "./hooks";
import { IntegrationPanel } from "./IntegrationPanel";
import { OauthPanel } from "./OauthPanel";
import { Paths } from "@/lib/routing/routes";
import { ACTIVITY, TYPE_INFO, attentionText, cardTone, visibleCards } from "./logic";
import type { Card as IntegrationCard, IntegrationType } from "./model";

function CardTile({ card, selected, attention, onSelect }: { card: IntegrationCard; selected: boolean; attention: boolean; onSelect: () => void }) {
  const info = TYPE_INFO[card.type];
  // O Cardápio Web e a Nuvemshop sem configuração no ambiente continuam clicáveis: o painel explica o que falta.
  const soon = card.status === "soon" && card.type !== "cardapio_web" && card.type !== "nuvemshop";
  const tone = cardTone(card);
  const color = (ORIGIN_INFO[card.type as Origin] ?? ORIGIN_INFO.unknown).color;
  const body = (
    <>
      <span className="flex items-center gap-2">
        <span aria-hidden className="size-2.5 rounded-full" style={{ background: color }} />
        <span className="type-title-sm font-bold text-text-primary">{info?.name ?? "Integração"}</span>
      </span>
      <span className="type-caption text-text-tertiary">{info?.kind}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Chip tone={tone.tone} icon={card.status === "connected" ? "check" : undefined}>
          {tone.label}
        </Chip>
        {attention && <Chip tone="error" icon="priority_high">Precisa de atenção</Chip>}
      </span>
      {card.lastOutboundOkAt && <span className="type-caption text-text-tertiary">{`último envio ${relativeTime(card.lastOutboundOkAt, new Date())}`}</span>}
    </>
  );
  const base = "flex flex-col items-start gap-2 rounded-lg border p-3.5 text-left";
  // "Em breve" não é botão: nada a fazer, e o leitor de tela lê como texto.
  if (soon) return <li className={cn(base, "border-border bg-surface opacity-60")}>{body}</li>;
  return (
    <li className="flex">
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${info?.name ?? "Integração"}, ${tone.label}${attention ? ", precisa de atenção" : ""}`}
        onClick={onSelect}
        className={cn(base, "w-full cursor-pointer", selected ? "border-primary-tint-border bg-primary-tint" : "border-border bg-surface hover:bg-surface-variant")}
      >
        {body}
      </button>
    </li>
  );
}

/** "Atenção": avisos das integrações que pedem a loja (sem entregador vinculado, finalizado na origem antes da retirada). */
function AttentionCard({ onLink }: { onLink: (type: IntegrationType) => void }) {
  const activity = useActivity();
  const seen = new Set<string>();
  const items = (activity.data?.pages.flatMap((page) => page.items) ?? [])
    .filter((item) => item.kind === "attention" && item.deliveryId !== null && !seen.has(`${item.deliveryId}:${item.reason}`) && seen.add(`${item.deliveryId}:${item.reason}`))
    .slice(0, 5);
  if (items.length === 0) return null;
  return (
    <section aria-label="Atenção" className="flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/10 p-4">
      <h2 className="type-title-md font-bold text-text-primary">Atenção</h2>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => {
          const origin = ORIGIN_INFO[item.type as Origin]?.label ?? "sistema de origem";
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="type-body-sm min-w-0 flex-1 text-text-primary">{attentionText(item.deliveryNumber, origin, item.reason)}</span>
              {item.reason === "driver_not_linked" && (
                <button type="button" onClick={() => onLink(item.type)} className="type-label-md cursor-pointer font-semibold text-primary-text hover:underline">
                  Vincular motoboy
                </button>
              )}
              <Link href={`${Paths.deliveries}?pedido=${item.deliveryId}`} className="type-label-md font-semibold text-primary-text hover:underline">
                Abrir pedido
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ActivityCard() {
  const activity = useActivity();
  const items = activity.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Card className="flex flex-col gap-2 p-5">
      <h2 className="type-title-md font-bold text-text-primary">Atividade recente</h2>
      {activity.isPending ? (
        <Spinner size={20} label="Carregando a atividade" />
      ) : activity.isError && items.length === 0 ? (
        <InlineError message={isApiError(activity.error) ? activity.error.text() : UNKNOWN_MESSAGE} onRetry={() => void activity.refetch()} />
      ) : items.length === 0 ? (
        <p className="type-body-sm text-text-tertiary">Nada por aqui ainda. Os pedidos e os status aparecem assim que a integração trabalhar.</p>
      ) : (
        <>
          <ul aria-label="Atividade recente" className="flex flex-col">
            {items.map((item) => {
              const look = ACTIVITY[item.kind];
              const origin = ORIGIN_INFO[item.type as Origin]?.label ?? "sistema de origem";
              const date = new Date(item.createdAt);
              return (
                <li key={item.id} className="grid grid-cols-[44px_20px_minmax(0,1fr)_auto] items-center gap-2.5 border-t border-divider py-2">
                  <span className="type-caption text-text-tertiary">{Number.isNaN(date.getTime()) ? "" : spTime(date)}</span>
                  <span aria-hidden className={look.tone === "error" ? "text-error" : look.tone === "warning" ? "text-warning" : look.tone === "success" ? "text-success" : "text-text-tertiary"}>
                    <Icon name={look.tone === "error" ? "cancel" : look.tone === "warning" ? "sync" : "check"} size={16} />
                  </span>
                  <span className="type-body-sm min-w-0 font-semibold text-text-primary">{look.text(item.deliveryNumber, origin, item.reason)}</span>
                  <SourceBadge origin={item.type as Origin} channel={null} />
                </li>
              );
            })}
          </ul>
          {activity.hasNextPage && (
            <div>
              <Btn kind="secondary" loading={activity.isFetchingNextPage} onClick={() => void activity.fetchNextPage()}>
                Carregar mais
              </Btn>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/** "Integrações" (`/integracoes/`): conectores, o painel do conector escolhido, a regra de aceite e a atividade. */
export function IntegrationsScreen() {
  const cards = useCards();
  const [picked, setPicked] = useState<IntegrationType | null>(null);
  const shown = useMemo(() => visibleCards(cards.data ?? []), [cards.data]);
  const selected = picked ?? shown.find((c) => c.status !== "soon")?.type ?? null;
  // O R4 da WS-15 registra "sem entregador vinculado" só no log: o selo do card nasce dele (o `needs_attention` do card
  // da API conta só os eventos que falharam).
  const log = useActivity();
  const unlinked = useMemo(
    () => new Set((log.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => item.kind === "attention" && item.reason === "driver_not_linked").map((item) => item.type)),
    [log.data],
  );
  const openLinks = (type: IntegrationType) => {
    setPicked(type);
    // O painel do conector troca no próximo quadro; a seção de vínculos ganha o foco quando existir.
    setTimeout(() => {
      const section = document.getElementById("vinculos");
      section?.scrollIntoView?.({ block: "start" });
      section?.focus();
    }, 150);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="min-w-0 flex-1 pb-7">
        <PageHead title="Integrações" sub="Pedidos do seu PDV e dos apps de delivery entram sozinhos, e cada status volta para eles" />
        <div className="mx-5 flex flex-col gap-4 lg:mx-7">
          {cards.isPending ? (
            <div className="grid place-items-center py-16 text-primary-text">
              <Spinner size={32} label="Carregando as integrações" />
            </div>
          ) : cards.isError ? (
            <div className="max-w-[420px]">
              <InlineError message={isApiError(cards.error) ? cards.error.text() : UNKNOWN_MESSAGE} onRetry={() => void cards.refetch()} />
            </div>
          ) : shown.length === 0 ? (
            <EmptyState icon="hub" title="Nenhuma integração disponível" description="Quando houver uma integração para a sua loja, ela aparece aqui." />
          ) : (
            <>
              <ul aria-label="Conectores" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {shown.map((card) => (
                  <CardTile key={card.type} card={card} selected={card.type === selected} attention={card.needsAttention || unlinked.has(card.type)} onSelect={() => setPicked(card.type)} />
                ))}
              </ul>
              <AttentionCard onLink={openLinks} />
              <Card className="flex flex-col gap-2 p-5">
                <h2 className="type-title-md font-bold text-text-primary">Quando chega um pedido</h2>
                <p className="type-body-sm text-pretty text-text-secondary">
                  Se há motoboy livre em até 5 minutos, o Motoka aceita sozinho, já com o motoboy previsto. Se ninguém estiver livre, o pedido fica esperando o seu aceite por 1:40: você pode aceitar, chamar reforço ou recusar. Sem resposta, o Motoka recusa e o sistema de origem oferece o pedido para outra logística. Sem ninguém em turno, só dá para recusar.
                </p>
                <p className="type-caption text-text-tertiary">Vale para o Open Delivery e a Saipos. Ainda não dá para mudar a regra por aqui.</p>
              </Card>
              <ActivityCard />
            </>
          )}
        </div>
      </div>
      <aside aria-label="Detalhe da integração" className="w-full shrink-0 overflow-y-auto border-t border-border lg:w-[420px] lg:border-l lg:border-t-0">
        {selected ? (
          TYPE_INFO[selected]?.oauth ? (
            <OauthPanel key={selected} type={selected} card={shown.find((c) => c.type === selected)} />
          ) : (
            <IntegrationPanel key={selected} type={selected} saved={shown.find((c) => c.type === selected)?.state != null} />
          )
        ) : (
          <p className="type-body-md p-6 text-text-tertiary">Escolha uma integração para ver os dados de conexão.</p>
        )}
      </aside>
    </div>
  );
}
