"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useSession } from "@/features/session/useSession";
import { useShortcut } from "@/features/shell/ShortcutsProvider";
import { PlaceholderScreen } from "@/features/shell/PlaceholderScreen";
import { isAvailable, useCapabilities } from "@/features/shell/capabilities";
import { isApiError, isUuid } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Paths } from "@/lib/routing/routes";
import { storeName as storeNameOf } from "@/lib/session/user";
import { spDay } from "@/lib/time/saoPaulo";
import { Btn } from "@/ui/Btn";
import { EmptyState } from "@/ui/EmptyState";
import { InlineError } from "@/ui/InlineError";
import { PageHead } from "@/ui/PageHead";
import { Spinner } from "@/ui/Spinner";
import { cn } from "@/ui/cn";
import { useToast } from "@/ui/Toast";
import "./icons";
import { deliveryKeys, useDelivery, useDeliveryList, useMinuteClock } from "./hooks";
import { NewOrderDrawer } from "./NewOrderDrawer";
import { OrderPanel } from "./OrderPanel";
import { OrdersTable } from "./OrdersTable";
import type { DeliveryDetail } from "./model";

type Filter = "aberto" | "todos";

/** "Pedidos de hoje" (`/pedidos/`): lista, painel do pedido e o drawer de novo pedido. */
export function DeliveriesScreen() {
  const capabilities = useCapabilities();
  if (!isAvailable(capabilities, "deliveries")) return <PlaceholderScreen path={Paths.deliveries} />;
  return <Screen />;
}

function Screen() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const session = useSession();
  const now = useMinuteClock();

  const filter: Filter = params.get("filtro") === "todos" ? "todos" : "aberto";
  const selectedParam = params.get("pedido");
  const selectedId = selectedParam && isUuid(selectedParam) ? selectedParam : null;
  const invalidSelection = selectedParam !== null && selectedId === null;

  const list = useDeliveryList(filter === "todos" ? "all" : "open", spDay(now));
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const counts = list.data?.pages[0]?.counts ?? { open: 0, all: 0 };
  const detail = useDelivery(selectedId);

  const [newOpen, setNewOpen] = useState(false);

  const user = session.status === "authenticated" ? session.user : null;
  const storeName = user ? storeNameOf(user) : "sua loja";
  const store = { city: user?.address?.city ?? "", state: (user?.address?.state ?? "").toUpperCase() };

  const go = useCallback(
    (next: { pedido?: string | null; filtro?: Filter }) => {
      const search = new URLSearchParams();
      const f = next.filtro ?? filter;
      const p = next.pedido === undefined ? selectedParam : next.pedido;
      if (f === "todos") search.set("filtro", "todos");
      if (p) search.set("pedido", p);
      const query = search.toString();
      router.replace(query ? `${Paths.deliveries}?${query}` : Paths.deliveries);
    },
    [filter, router, selectedParam],
  );
  const select = useCallback((id: string) => go({ pedido: id }), [go]);

  const move = (delta: number) => {
    if (items.length === 0) return;
    const index = items.findIndex((item) => item.id === selectedId);
    const next = items[Math.min(items.length - 1, Math.max(0, index < 0 ? (delta > 0 ? 0 : items.length - 1) : index + delta))];
    if (next) select(next.id);
  };

  useShortcut("n", "Novo pedido", () => setNewOpen(true));
  useShortcut("j", "Próximo pedido", () => move(1));
  useShortcut("k", "Pedido anterior", () => move(-1));
  useShortcut("1", "Pedidos em aberto", () => go({ filtro: "aberto" }));
  useShortcut("2", "Todos os pedidos de hoje", () => go({ filtro: "todos" }));

  const created = (d: DeliveryDetail) => {
    setNewOpen(false);
    toast({ title: `Pedido #${d.number} criado.` });
    queryClient.setQueryData(deliveryKeys.detail(d.id), d);
    void queryClient.invalidateQueries({ queryKey: deliveryKeys.all });
    go({ pedido: d.id });
  };

  const hasOlder = filter === "aberto" && items.some((i) => spDay(new Date(i.createdAt)) !== spDay(now));
  const sub = filter === "aberto" && hasOlder ? "Inclui pedidos de dias anteriores ainda em andamento." : "Entram das integrações ou você cria na mão. Cada status volta sozinho para o sistema de origem.";

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1 pb-7">
          <PageHead
            title="Pedidos de hoje"
            sub={sub}
            right={
              <Btn icon="add" title="Novo pedido (N)" onClick={() => setNewOpen(true)}>
                Novo pedido
              </Btn>
            }
          />
          <div role="group" aria-label="Filtro" className="mx-5 mb-2.5 flex gap-1.5 lg:mx-7">
            {(["aberto", "todos"] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => go({ filtro: key })}
                className={cn(
                  "type-label-md min-h-9 cursor-pointer rounded-full border px-3 font-semibold",
                  filter === key ? "border-border bg-primary-tint text-primary-text" : "border-border text-text-secondary hover:bg-surface-variant",
                )}
              >
                {key === "aberto" ? `Em aberto ${counts.open}` : `Todos ${counts.all}`}
              </button>
            ))}
          </div>
          {list.isPending ? (
            <div className="grid place-items-center py-16 text-primary-text">
              <Spinner size={32} label="Carregando os pedidos" />
            </div>
          ) : list.isError && !list.data ? (
            <div className="mx-5 max-w-[420px] lg:mx-7">
              <InlineError message={isApiError(list.error) ? list.error.text({ ROUTE_NOT_FOUND: "Pedidos ainda não estão disponíveis." }) : UNKNOWN_MESSAGE} onRetry={() => void list.refetch()} />
            </div>
          ) : items.length === 0 ? (
            counts.all === 0 ? (
              <div className="py-12">
                <EmptyState icon="receipt_long" title="Nenhum pedido hoje" description="Os pedidos das integrações aparecem aqui sozinhos. Para pedidos de WhatsApp, telefone ou balcão, use Novo pedido.">
                  <Btn icon="add" onClick={() => setNewOpen(true)}>
                    Novo pedido
                  </Btn>
                </EmptyState>
              </div>
            ) : (
              <div className="py-12">
                <EmptyState icon="receipt_long" title="Nenhum pedido em aberto agora.">
                  <Btn kind="secondary" onClick={() => go({ filtro: "todos" })}>
                    Ver todos
                  </Btn>
                </EmptyState>
              </div>
            )
          ) : (
            <>
              {list.isRefetchError && (
                <p role="status" className="type-caption px-5 pb-2 text-text-tertiary lg:px-7">
                  Não foi possível atualizar. Tentando de novo.
                </p>
              )}
              <OrdersTable items={items} selectedId={selectedId} now={now} onSelect={select} />
              {list.hasNextPage && (
                <div className="mx-5 mt-3 lg:mx-7">
                  <Btn kind="secondary" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
                    Mostrar mais
                  </Btn>
                </div>
              )}
            </>
          )}
        </div>
        <aside aria-label="Detalhe do pedido" className="w-full shrink-0 overflow-y-auto border-t border-border lg:w-[380px] lg:border-l lg:border-t-0">
          {invalidSelection ? (
            <p className="type-body-md p-6 text-text-tertiary">Pedido não encontrado.</p>
          ) : selectedId === null ? (
            <p className="type-body-md p-6 text-text-tertiary">Selecione um pedido para ver os detalhes.</p>
          ) : detail.isPending ? (
            <div className="grid place-items-center py-16 text-primary-text">
              <Spinner size={24} label="Carregando o pedido" />
            </div>
          ) : detail.isError && !detail.data ? (
            <div className="p-5">
              {isApiError(detail.error) && detail.error.status === 404 ? (
                <p className="type-body-md text-text-tertiary">Este pedido não foi encontrado.</p>
              ) : (
                <InlineError message="Não foi possível carregar este pedido. Tente novamente." onRetry={() => void detail.refetch()} />
              )}
            </div>
          ) : detail.data ? (
            <OrderPanel key={detail.data.id} detail={detail.data} storeName={storeName} now={now} />
          ) : null}
        </aside>
      </div>
      <NewOrderDrawer open={newOpen} store={store} onClose={() => setNewOpen(false)} onCreated={created} />
    </>
  );
}
