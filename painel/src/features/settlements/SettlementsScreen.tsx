"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { addDays, spDay, weekStart as mondayOf } from "@/lib/time/saoPaulo";
import { isApiError, isUuid } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Paths } from "@/lib/routing/routes";
import { weekRangeLabel, weekdayShort, weekdayIndex } from "@/features/team/dates";
import { entityColor, formatMoney } from "@/features/team/model";
import { Avatar } from "@/ui/Avatar";
import { Chip } from "@/ui/Chip";
import { EmptyState } from "@/ui/EmptyState";
import { Icon } from "@/ui/Icon";
import { InlineError } from "@/ui/InlineError";
import { PageHead } from "@/ui/PageHead";
import { SelectField } from "@/ui/SelectField";
import { Spinner } from "@/ui/Spinner";
import { cn } from "@/ui/cn";
import "@/features/team/icons";
import { useSettlement, useSettlements } from "./hooks";
import { D18_NOTE, SettlementPanel } from "./SettlementPanel";
import { FILTERS, STATUS_LABEL, filterParams, type StatusFilter } from "./logic";
import type { SettlementSummary } from "./model";
import { TeamTabs } from "./TeamTabs";

const WEEKS_BACK = 8;

const money = (value: string | null): string => (value === null ? "A definir" : (formatMoney(value) ?? "A definir"));

function summaryText(s: SettlementSummary): string {
  const parts = [
    `${s.deliveriesCount} ${s.deliveriesCount === 1 ? "entrega" : "entregas"}`,
    ...(s.returnsCount > 0 ? [`${s.returnsCount} ${s.returnsCount === 1 ? "retorno" : "retornos"}`] : []),
    ...(s.pendingCount > 0 ? [`${s.pendingCount} sem desfecho`] : []),
  ];
  return parts.join(" · ");
}

/** "Acertos" (`/acertos/`): lista com filtros de status, semana e motoboy, e o acerto aberto ao lado. */
export function SettlementsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const filter = (FILTERS.find((f) => f.key === params.get("filtro"))?.key ?? "todos") as StatusFilter;
  const weekParam = params.get("semana");
  const week = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) && weekdayIndex(weekParam) === 0 ? weekParam : null;
  const driverParam = params.get("motoboy");
  const driverId = driverParam && isUuid(driverParam) ? driverParam : null;
  const selectedParam = params.get("acerto");
  const selectedId = selectedParam && isUuid(selectedParam) ? selectedParam : null;

  const list = useSettlements({ ...filterParams(filter), weekStart: week, driverId });
  // Sem filtro nenhum: o contador do topo e as opções de motoboy.
  const base = useSettlements({});
  const detail = useSettlement(selectedId);

  const go = useCallback(
    (next: { filtro?: StatusFilter; semana?: string | null; motoboy?: string | null; acerto?: string | null }) => {
      const search = new URLSearchParams();
      const f = next.filtro ?? filter;
      const w = next.semana === undefined ? week : next.semana;
      const d = next.motoboy === undefined ? driverId : next.motoboy;
      const a = next.acerto === undefined ? selectedId : next.acerto;
      if (f !== "todos") search.set("filtro", f);
      if (w) search.set("semana", w);
      if (d) search.set("motoboy", d);
      if (a) search.set("acerto", a);
      const query = search.toString();
      router.replace(query ? `${Paths.settlements}?${query}` : Paths.settlements);
    },
    [driverId, filter, router, selectedId, week],
  );

  const drivers = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of base.data?.items ?? []) if (item.driver) seen.set(item.driver.id, item.driver.fullName);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [base.data]);

  const weeks = useMemo(() => {
    const current = mondayOf(spDay(new Date()));
    return Array.from({ length: WEEKS_BACK }, (_, i) => addDays(current, -7 * i));
  }, []);

  const data = list.data;
  const needsAction = base.data?.needsActionCount ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="min-w-0 flex-1 pb-7">
        <PageHead title="Acertos" sub="O que cada motoboy tem a receber pelos turnos da sua equipe" right={<TeamTabs active="acertos" needsAction={needsAction} />} />
        <div className="mx-5 mb-4 flex gap-2.5 rounded-md border border-border bg-surface p-3 lg:mx-7">
          <span className="text-info">
            <Icon name="info" size={18} />
          </span>
          <p className="type-body-sm text-pretty text-text-secondary">{D18_NOTE}</p>
        </div>

        <div className="mx-5 mb-3 flex flex-wrap items-end gap-2 lg:mx-7">
          <div role="group" aria-label="Filtro de status" className="flex flex-1 flex-wrap gap-1.5">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => go({ filtro: item.key })}
                className={cn(
                  "type-label-md min-h-9 cursor-pointer rounded-full border px-3 font-semibold",
                  filter === item.key ? "border-border bg-primary-tint text-primary-text" : "border-border text-text-secondary hover:bg-surface-variant",
                )}
              >
                {item.key === "atencao" ? `${item.label} ${needsAction}` : item.label}
              </button>
            ))}
          </div>
          <div className="w-44">
            <SelectField label="Semana" value={week ?? ""} onChange={(event) => go({ semana: event.target.value || null })}>
              <option value="">Todas as semanas</option>
              {weeks.map((w, i) => (
                <option key={w} value={w}>
                  {i === 0 ? "Esta semana" : weekRangeLabel(w)}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="w-48">
            <SelectField label="Motoboy" value={driverId ?? ""} onChange={(event) => go({ motoboy: event.target.value || null })}>
              <option value="">Todos os motoboys</option>
              {drivers.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        {data?.week && (
          <p className="type-body-sm mx-5 mb-3 text-text-secondary lg:mx-7" data-testid="week-total">
            {`Semana de ${weekRangeLabel(data.week.weekStart)}: ${money(data.week.total)} em ${data.week.units} ${data.week.units === 1 ? "unidade" : "unidades"}${driverId ? " deste motoboy" : ""}.`}
          </p>
        )}

        {list.isPending ? (
          <div className="grid place-items-center py-16 text-primary-text">
            <Spinner size={32} label="Carregando os acertos" />
          </div>
        ) : list.isError && !data ? (
          <div className="mx-5 max-w-[420px] lg:mx-7">
            <InlineError message={isApiError(list.error) ? list.error.text() : UNKNOWN_MESSAGE} onRetry={() => void list.refetch()} />
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon="payments"
              title={filter === "todos" && !week && !driverId ? "Nenhum acerto ainda" : "Nenhum acerto com este filtro"}
              description={filter === "todos" && !week && !driverId ? "Quando um motoboy encerra o turno, o acerto aparece aqui para você conferir." : undefined}
            />
          </div>
        ) : data ? (
          <ul aria-label="Acertos" className="mx-5 overflow-hidden rounded-lg border border-border lg:mx-7">
            {data.items.map((item) => {
              const status = STATUS_LABEL[item.status];
              const selected = item.id === selectedId;
              const [, m, d] = item.occurrenceDate.split("-");
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => go({ acerto: item.id })}
                    className={cn(
                      "grid w-full cursor-pointer grid-cols-[84px_minmax(0,1fr)_110px_170px] items-center gap-3 border-b border-divider px-4 py-3 text-left",
                      selected ? "bg-primary-tint" : "hover:bg-surface-variant",
                    )}
                  >
                    <span className="type-body-md font-semibold text-text-primary">
                      {`${weekdayShort(weekdayIndex(item.occurrenceDate))} ${d}/${m}`}
                    </span>
                    <span className="flex min-w-0 items-center gap-2.5">
                      {item.driver && <Avatar initials={item.driver.initials} color={entityColor(item.driver.id)} size={30} />}
                      <span className="min-w-0">
                        <span className="type-body-md block truncate text-text-primary">{item.driver?.fullName ?? "Motoboy"}</span>
                        <span className="type-caption block truncate text-text-tertiary">
                          {summaryText(item)}
                          {item.kind === "supplement" ? " · complementar" : ""}
                        </span>
                      </span>
                    </span>
                    <span className="type-body-md text-right font-semibold text-text-primary">{money(item.total)}</span>
                    <span className="flex justify-end">
                      <Chip tone={status.tone}>{status.label}</Chip>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {data && data.items.length > 0 && <p className="type-caption mx-5 mt-2 text-text-tertiary lg:mx-7">{`${data.count} ${data.count === 1 ? "acerto" : "acertos"} · total da lista ${money(data.total)}`}</p>}
        <p className="type-caption mx-5 mt-3 text-text-tertiary lg:mx-7">
          Precisa ver a escala? <Link href={Paths.team} className="font-semibold text-primary-text hover:underline">Abrir Minha equipe</Link>
        </p>
      </div>

      <aside aria-label="Detalhe do acerto" className="w-full shrink-0 overflow-y-auto border-t border-border lg:w-[400px] lg:border-l lg:border-t-0">
        {selectedParam && !selectedId ? (
          <p className="type-body-md p-6 text-text-tertiary">Acerto não encontrado.</p>
        ) : selectedId === null ? (
          <p className="type-body-md p-6 text-text-tertiary">Selecione um acerto para conferir os valores.</p>
        ) : detail.isPending ? (
          <div className="grid place-items-center py-16 text-primary-text">
            <Spinner size={24} label="Carregando o acerto" />
          </div>
        ) : detail.isError && !detail.data ? (
          <div className="p-5">
            {isApiError(detail.error) && detail.error.status === 404 ? (
              <p className="type-body-md text-text-tertiary">Acerto não encontrado.</p>
            ) : (
              <InlineError message="Não foi possível carregar este acerto. Tente novamente." onRetry={() => void detail.refetch()} />
            )}
          </div>
        ) : detail.data ? (
          <SettlementPanel key={detail.data.id} detail={detail.data} />
        ) : null}
      </aside>
    </div>
  );
}
