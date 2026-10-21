"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { isApiError, isUuid } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Paths } from "@/lib/routing/routes";
import { Chip } from "@/ui/Chip";
import { EmptyState } from "@/ui/EmptyState";
import { InlineError } from "@/ui/InlineError";
import { PageHead } from "@/ui/PageHead";
import { Spinner } from "@/ui/Spinner";
import { cn } from "@/ui/cn";
import "@/features/team/icons";
import { useOrder, useOrderList } from "./hooks";
import { STATUS_LABEL, STATUS_TONE, dayTitle, durationLabel, formatTime, primaryPayout, todayStart } from "./logic";
import type { Order } from "./model";
import { ServiceDetail } from "./ServiceDetail";
import { formatMoney } from "@/features/team/model";

function vacancies(order: Order): string {
  return `${order.assignedDrivers}/${order.requestedDrivers} ${order.requestedDrivers === 1 ? "vaga" : "vagas"}`;
}

function SummaryCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("flex-1 rounded-lg border p-4", highlight ? "border-primary bg-primary-tint" : "border-border bg-surface")}>
      <p className="type-label-md text-text-secondary">{label}</p>
      <p className="type-heading-lg mt-1 font-bold text-text-primary">{value}</p>
    </div>
  );
}

function Section({ title, orders, selectedId, now, onSelect }: { title: string; orders: readonly Order[]; selectedId: string | null; now: Date; onSelect: (id: string) => void }) {
  if (orders.length === 0) return null;
  return (
    <section className="mx-5 mb-5 lg:mx-7">
      <h2 className="type-title-md mb-2 font-bold text-text-primary">{title}</h2>
      <ul aria-label={title} className="overflow-hidden rounded-lg border border-border">
        {orders.map((order) => {
          const selected = order.id === selectedId;
          const each = order.value !== null && Number(order.value) > 0 && order.pricePerDelivery !== null && Number(order.pricePerDelivery) > 0;
          return (
            <li key={order.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(order.id)}
                className={cn(
                  "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-divider px-4 py-3 text-left",
                  selected ? "bg-primary-tint" : "hover:bg-surface-variant",
                )}
              >
                <span className="type-body-md font-semibold text-text-primary">{dayTitle(order, now)}</span>
                <span className="type-body-md text-right font-semibold text-text-primary">{primaryPayout(order)}</span>
                <span className="type-caption text-text-tertiary">
                  {`${formatTime(order.startDate)} - ${formatTime(order.endDate)} · ${durationLabel(order.startDate, order.endDate)} · `}
                  <span className={order.assignedDrivers >= order.requestedDrivers ? "text-success" : "text-warning"}>{vacancies(order)}</span>
                </span>
                <span className="type-caption text-right text-success">{each ? `+${formatMoney(order.pricePerDelivery)}/entrega` : ""}</span>
                <span className="col-span-2">
                  <Chip tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Chip>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** "Contratar motoboys" (`/servicos/`): em andamento e próximos serviços, e o serviço aberto ao lado (`?pedido=`). */
export function ServicesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedParam = params.get("pedido");
  const selectedId = selectedParam && isUuid(selectedParam) ? selectedParam : null;
  const proposalParam = params.get("proposta");
  const proposalId = proposalParam && isUuid(proposalParam) ? proposalParam : null;
  const now = useMemo(() => new Date(), []);
  const start = useMemo(() => todayStart(now), [now]);

  const current = useOrderList("current", start);
  const upcoming = useOrderList("upcoming", start);
  const detail = useOrder(selectedId);

  const select = useCallback(
    (id: string | null) => {
      const search = new URLSearchParams();
      if (id) search.set("pedido", id);
      const query = search.toString();
      router.replace(query ? `${Paths.services}?${query}` : Paths.services);
    },
    [router],
  );

  const pending = current.isPending || upcoming.isPending;
  // Como no app: só vira erro quando as duas consultas falham.
  const failed = current.isError && upcoming.isError;
  const currentItems = current.data?.items ?? [];
  const upcomingItems = upcoming.data?.items ?? [];
  const empty = !pending && !failed && currentItems.length === 0 && upcomingItems.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="min-w-0 flex-1 pb-7">
        <PageHead
          title="Contratar motoboys"
          sub="Períodos avulsos com motoboys de fora da sua equipe"
          right={
            <Link
              href={Paths.newService}
              className="type-label-lg inline-flex min-h-11 items-center rounded-md border border-primary bg-primary px-4 py-2.5 text-on-primary hover:bg-primary-dark"
            >
              Solicitar serviço
            </Link>
          }
        />
        {pending ? (
          <div className="grid place-items-center py-16 text-primary-text">
            <Spinner size={32} label="Carregando os serviços" />
          </div>
        ) : failed ? (
          <div className="mx-5 max-w-[420px] lg:mx-7">
            <InlineError
              message={isApiError(current.error) ? current.error.text() : UNKNOWN_MESSAGE}
              onRetry={() => {
                void current.refetch();
                void upcoming.refetch();
              }}
            />
          </div>
        ) : empty ? (
          <div className="py-12">
            <EmptyState icon="two_wheeler" title="Nenhum serviço ainda" description="Solicite seu primeiro serviço e acompanhe tudo aqui.">
              <Link href={Paths.newService} className="type-label-lg inline-flex min-h-11 items-center rounded-md border border-primary bg-primary px-4 py-2.5 text-on-primary hover:bg-primary-dark">
                Solicitar serviço
              </Link>
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="mx-5 mb-5 flex gap-3 lg:mx-7">
              <SummaryCard label="Em andamento" value={current.data?.total ?? 0} highlight={currentItems.length > 0} />
              <SummaryCard label="Próximos" value={upcoming.data?.total ?? 0} />
            </div>
            <Section title="Em andamento" orders={currentItems} selectedId={selectedId} now={now} onSelect={select} />
            <Section title="Próximos serviços" orders={upcomingItems} selectedId={selectedId} now={now} onSelect={select} />
          </>
        )}
      </div>

      <aside aria-label="Detalhe do serviço" className="w-full shrink-0 overflow-y-auto border-t border-border lg:w-[420px] lg:border-l lg:border-t-0">
        {selectedParam && !selectedId ? (
          <p className="type-body-md p-6 text-text-tertiary">Serviço não encontrado.</p>
        ) : selectedId === null ? (
          <p className="type-body-md p-6 text-text-tertiary">Selecione um serviço para ver os detalhes, as propostas e o pagamento.</p>
        ) : detail.isPending ? (
          <div className="grid place-items-center py-16 text-primary-text">
            <Spinner size={24} label="Carregando o serviço" />
          </div>
        ) : detail.isError && !detail.data ? (
          <div className="p-5">
            {isApiError(detail.error) && detail.error.status === 404 ? (
              <p className="type-body-md text-text-tertiary">Serviço não encontrado.</p>
            ) : (
              <InlineError message="Não foi possível carregar este serviço. Tente novamente." onRetry={() => void detail.refetch()} />
            )}
          </div>
        ) : detail.data ? (
          <ServiceDetail key={detail.data.id} order={detail.data} onGone={() => select(null)} highlightNegotiation={proposalId} />
        ) : null}
      </aside>
    </div>
  );
}
