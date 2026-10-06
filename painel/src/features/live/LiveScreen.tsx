"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fetchList } from "@/features/deliveries/api";
import { PlaceholderScreen } from "@/features/shell/PlaceholderScreen";
import { isAvailable, useCapabilities } from "@/features/shell/capabilities";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { POLLING, pollingInterval } from "@/lib/polling/polling";
import { Paths } from "@/lib/routing/routes";
import { EmptyState } from "@/ui/EmptyState";
import { InlineError } from "@/ui/InlineError";
import { Spinner } from "@/ui/Spinner";
import { Btn } from "@/ui/Btn";
import "./icons";
import { classifyAll } from "./attention";
import type { LiveStop } from "./model";
import { AttentionBlock, DriverCard, DriverPanel, FilterChips, LiveDot, SideFooter, matchesFilter, sideSubtitle, statusPill, type Filter } from "./LiveSide";
import { useLive } from "./useLive";

const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-primary-text">
      <Spinner size={32} label="Carregando o mapa" />
    </div>
  ),
});

/** WebGL2 é exigido pelo MapLibre v6; sem ele a lateral continua funcionando (DN-11). */
function hasWebGL2(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

/** "Mapa ao vivo" (`/ao-vivo/`): mapa, bloco de atenção e a lateral "Equipe agora". */
export function LiveScreen() {
  const capabilities = useCapabilities();
  if (!isAvailable(capabilities, "deliveries") && !isAvailable(capabilities, "tracking")) return <PlaceholderScreen path={Paths.live} />;
  return <Screen tracking={capabilities.tracking !== false} />;
}

function Screen({ tracking }: { tracking: boolean }) {
  const live = useLive(tracking);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [mapFailed, setMapFailed] = useState(false);
  const [webgl] = useState(() => (typeof document === "undefined" ? true : hasWebGL2()));

  const attention = useQuery({
    queryKey: ["deliveries", "attention"],
    queryFn: async ({ signal }) => classifyAll((await fetchList({ scope: "open", needsAttention: true, limit: 20 }, signal)).items),
    refetchInterval: pollingInterval(POLLING.deliveries),
    retry: false,
  });

  const forbidden = isApiError(live.error) && live.error.status === 403;
  const notEnabled = !tracking || (isApiError(live.error) && live.error.status === 404 && live.error.code === "ROUTE_NOT_FOUND");
  const views = live.views;
  const visible = useMemo(() => views.filter((v) => matchesFilter(v, filter)), [views, filter]);
  const selected = views.find((v) => v.driver.driverId === selectedId) ?? null;
  const selectedStops = useMemo(() => (selected && selected.display === "delivering" ? selected.driver.stops.filter((s) => s.destination) : []), [selected]);
  const pill = statusPill(live.status, new Date(live.now));
  const establishment = live.state.snapshot?.establishment ?? null;
  const store = establishment?.location ? { ...establishment.location, name: establishment.name } : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <h1 className="type-heading-lg sr-only font-bold">Mapa ao vivo</h1>
      <div className="relative min-h-[360px] min-w-0 flex-1">
        <MapArea
          failed={mapFailed}
          webgl={webgl}
          notEnabled={notEnabled}
          store={store}
          views={views}
          selectedId={selectedId}
          stops={selectedStops}
          onSelect={setSelectedId}
          onFailed={() => setMapFailed(true)}
        />
        {!notEnabled && !forbidden && (
          <div className="pointer-events-none absolute left-5 right-5 top-[18px] flex flex-wrap items-center gap-2">
            <div className="type-label-md pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-surface-lowest/85 px-3.5 py-2 font-semibold text-text-primary">
              <LiveDot kind={pill.dot} />
              <span role="status" aria-live="polite">
                {pill.text}
              </span>
              {pill.time && <span aria-hidden>{`· ${pill.time}`}</span>}
            </div>
            <div className="type-label-md pointer-events-auto rounded-full border border-border bg-surface-lowest/85 px-3.5 py-2 text-text-secondary">
              {`${live.counts.onShift} em turno · ${live.counts.delivering} ${live.counts.delivering === 1 ? "entrega" : "entregas"} na rua · ${live.counts.doneToday} ${live.counts.doneToday === 1 ? "feita" : "feitas"} hoje`}
            </div>
          </div>
        )}
        {selected && selected.display !== "no_signal" && selected.display !== "not_started" && <DriverPanel view={selected} />}
      </div>

      <aside aria-label="Equipe agora" className="flex w-full shrink-0 flex-col border-t border-border bg-background lg:w-[340px] lg:border-l lg:border-t-0">
        <div className="px-5 pb-3 pt-[22px]">
          <h2 className="type-title-lg font-bold text-text-primary">Equipe agora</h2>
          <p className="type-body-sm text-text-tertiary">{sideSubtitle(views)}</p>
        </div>
        <AttentionBlock items={attention.data ?? []} />
        {notEnabled ? (
          <p className="type-body-sm px-5 pb-4 text-text-tertiary">O rastreio dos motoboys ainda não foi ativado para a sua conta.</p>
        ) : forbidden ? (
          <p role="alert" className="type-body-sm px-5 pb-4 text-text-secondary">Você não tem permissão para ver o mapa ao vivo.</p>
        ) : live.loading ? (
          <div className="grid place-items-center py-10 text-primary-text">
            <Spinner size={24} label="Carregando a equipe" />
          </div>
        ) : live.error ? (
          <div className="px-5 pb-4">
            <InlineError message={isApiError(live.error) ? live.error.text() : UNKNOWN_MESSAGE} onRetry={live.refetch} />
          </div>
        ) : views.length === 0 ? (
          <div className="px-5 pb-4">
            <EmptyState icon="two_wheeler" title="Nenhum motoboy em turno agora">
              <Link href={Paths.team}>
                <Btn kind="secondary" icon="calendar_month">
                  Ver escala
                </Btn>
              </Link>
            </EmptyState>
          </div>
        ) : (
          <>
            <FilterChips filter={filter} onChange={setFilter} counts={live.counts} total={views.length} />
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-4">
              {visible.map((view) => (
                <li key={view.driver.driverId}>
                  <DriverCard view={view} selected={view.driver.driverId === selectedId} onSelect={setSelectedId} />
                </li>
              ))}
            </ul>
          </>
        )}
        <SideFooter />
      </aside>
    </div>
  );
}

function MapArea({
  failed,
  webgl,
  notEnabled,
  store,
  views,
  selectedId,
  stops,
  onSelect,
  onFailed,
}: {
  failed: boolean;
  webgl: boolean;
  notEnabled: boolean;
  store: { lat: number; lng: number; name: string } | null;
  views: ReturnType<typeof useLive>["views"];
  selectedId: string | null;
  stops: readonly LiveStop[];
  onSelect: (id: string) => void;
  onFailed: () => void;
}) {
  const message = !MAP_STYLE_URL
    ? { title: "Mapa não configurado", text: "A lista ao lado continua atualizando." }
    : !webgl
      ? { title: "Seu navegador não mostra o mapa", text: "A lista ao lado continua atualizando." }
      : failed
        ? { title: "Não foi possível carregar o mapa", text: "A lista ao lado continua atualizando." }
        : null;
  if (message) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-surface-lowest p-6" data-testid="map-fallback">
        <EmptyState icon="map" title={message.title} description={message.text} />
      </div>
    );
  }
  if (notEnabled) return null;
  return <MapView styleUrl={MAP_STYLE_URL} store={store} views={views} selectedId={selectedId} stops={stops} onSelect={onSelect} onFailed={onFailed} />;
}
