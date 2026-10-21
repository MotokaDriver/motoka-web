"use client";

import Link from "next/link";
import { whatsappLink, telLink } from "@/lib/links/links";
import { spDay, spTime } from "@/lib/time/saoPaulo";
import { Avatar } from "@/ui/Avatar";
import { Chip, type Tone } from "@/ui/Chip";
import { Icon, type IconName } from "@/ui/Icon";
import { Label } from "@/ui/Label";
import { Paths } from "@/lib/routing/routes";
import { cn } from "@/ui/cn";
import { useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { useToast } from "@/ui/Toast";
import { remindLocation } from "./api";
import { SourceBadge } from "@/features/deliveries/SourceBadge";
import type { Origin } from "@/features/deliveries/model";
import { nowLabel } from "@/features/team/dates";
import { entityColor } from "@/features/team/model";
import type { AttentionItem } from "./attention";
import type { DriverState } from "./model";
import { coarseAge, fineAge, type DriverView, type LiveCounts } from "./state";
import type { StreamStatus } from "./stream";

export const STATE_CHIP: Record<DriverState, { label: string; tone: Tone; icon: IconName }> = {
  delivering: { label: "Entregando", tone: "info", icon: "two_wheeler" },
  returning: { label: "Voltando", tone: "warning", icon: "u_turn_left" },
  at_store: { label: "Na loja", tone: "success", icon: "storefront" },
  idle: { label: "Em turno, livre", tone: "neutral", icon: "two_wheeler" },
  no_signal: { label: "Sem sinal", tone: "error", icon: "location_off" },
  not_started: { label: "Sem sinal", tone: "error", icon: "location_off" },
  unknown: { label: "Em turno", tone: "neutral", icon: "two_wheeler" },
};

export type Filter = "all" | "delivering" | "returning" | "idle" | "no_signal";

export function matchesFilter(view: DriverView, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "no_signal") return view.display === "no_signal" || view.display === "not_started";
  return view.display === filter;
}

/** Pílula "Ao vivo": verde só com o stream vivo (watchdog), âmbar em polling, cinza em pausa ou sem conexão. */
export function statusPill(status: StreamStatus, now: Date): { text: string; time: string | null; dot: "live" | "poll" | "off" } {
  switch (status) {
    case "streaming":
      // A hora fica fora da região viva: o leitor de tela anuncia o estado, não o relógio a cada minuto.
      return { text: "Ao vivo", time: nowLabel(spDay(now), spTime(now)), dot: "live" };
    case "polling":
      return { text: "Atualização a cada 10 s", time: null, dot: "poll" };
    case "reconnecting":
      return { text: "Sem atualização · tentando", time: null, dot: "off" };
    case "paused":
      return { text: "Pausado", time: null, dot: "off" };
    case "offline":
      return { text: "Sem atualização", time: null, dot: "off" };
    default:
      return { text: "Conectando…", time: null, dot: "off" };
  }
}

const dotClass = { live: "bg-success", poll: "bg-warning", off: "bg-text-disabled" } as const;

export function LiveDot({ kind }: { kind: "live" | "poll" | "off" }) {
  return <span aria-hidden className={cn("inline-block size-2 rounded-full", dotClass[kind], kind === "live" && "animate-pulse")} />;
}

/** Cabeçalho da lateral: "{n} em turno" e a faixa mais ampla dos turnos em curso. */
export function sideSubtitle(views: readonly DriverView[]): string {
  if (views.length === 0) return "Ninguém em turno";
  const shifts = views.flatMap((v) => (v.driver.shift ? [v.driver.shift] : []));
  const starts = shifts.map((s) => Date.parse(s.startsAt)).filter((n) => !Number.isNaN(n));
  const ends = shifts.map((s) => Date.parse(s.endsAt)).filter((n) => !Number.isNaN(n));
  const range = starts.length && ends.length ? `${spTime(new Date(Math.min(...starts)))} – ${spTime(new Date(Math.max(...ends)))}` : null;
  return [`${views.length} em turno`, range].filter(Boolean).join(" · ");
}

function headline(view: DriverView): { head: string; sub: string } {
  const d = view.driver;
  switch (view.display) {
    case "delivering": {
      const first = d.stops[0];
      return { head: d.stops.length > 0 ? `Em entrega · faltam ${d.stops.length}` : "Em entrega", sub: first ? `#${first.number}${first.customerName ? ` · ${first.customerName}` : ""}` : "" };
    }
    case "returning":
      return { head: "Voltando para a loja", sub: d.lastDeliveredAt ? `Última entregue às ${spTime(new Date(d.lastDeliveredAt))}` : "" };
    case "at_store":
      return { head: "Na loja", sub: "" };
    case "idle":
      return { head: "Em turno, livre", sub: "" };
    case "not_started":
      return { head: "Localização desligada", sub: d.shift ? `Turno começou às ${spTime(new Date(d.shift.startsAt))}` : "" };
    case "no_signal":
      return { head: "Sem sinal", sub: view.ageMs === null ? "sem posição" : `última posição ${coarseAge(view.ageMs)}` };
    default:
      return { head: "Em turno", sub: "" };
  }
}

/**
 * E17: "Lembrar de ativar localização" (push `shift_reminder` ao motoboy). O servidor limita a um a cada 5 min por turno
 * (429) e recusa quem não está em turno ou já está com a localização ligada (409): os dois viram texto do catálogo.
 */
export function ReminderButton({ membershipId, name }: { membershipId: string; name: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Lembrar ${name} de ativar a localização`}
      onClick={async () => {
        setBusy(true);
        try {
          await remindLocation(membershipId);
          toast({ title: "Lembrete enviado.", description: `${name} recebeu o aviso para ligar a localização.` });
        } catch (failure) {
          toast({ title: isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE });
        } finally {
          setBusy(false);
        }
      }}
      className="type-label-md inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border px-3 font-semibold text-text-primary hover:bg-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Icon name="notifications_active" size={16} />
      Lembrar de ativar localização
    </button>
  );
}

/** Cartão do motoboy na lateral. Todo dado do pin está aqui (alternativa acessível do mapa). */
export function DriverCard({ view, selected, onSelect }: { view: DriverView; selected: boolean; onSelect: (id: string) => void }) {
  const d = view.driver;
  const chip = STATE_CHIP[view.display];
  const { head, sub } = headline(view);
  const off = view.display === "no_signal" || view.display === "not_started";
  const total = d.doneToday.deliveries + d.stops.length;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${d.fullName}, ${chip.label}, posição ${coarseAge(view.ageMs)}`}
      onClick={() => onSelect(d.driverId)}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-2.5 rounded-lg border p-3.5 text-left",
        selected ? "border-primary-tint-border bg-primary-tint" : off ? "border-error/35 bg-surface" : "border-border bg-surface hover:bg-surface-variant",
      )}
    >
      <span className="flex items-center gap-2.5">
        <Avatar initials={d.initials} color={entityColor(d.driverId)} size={34} ring={!off} />
        <span className="min-w-0 flex-1">
          <span className="type-title-sm block truncate font-semibold text-text-primary">{d.fullName}</span>
          <span className={cn("type-caption flex items-center gap-1.5", off ? "text-error" : "text-text-tertiary")}>
            {!off && <LiveDot kind={view.pin === "stale" ? "off" : "live"} />}
            {off ? (view.ageMs === null ? "sem posição" : `sem posição ${fineAge(view.ageMs)}`) : `posição ${fineAge(view.ageMs)}`}
          </span>
        </span>
        <Chip tone={chip.tone} icon={chip.icon}>
          {chip.label}
        </Chip>
      </span>
      <span>
        <span className="type-body-md block font-semibold text-text-primary">{head}</span>
        {sub && <span className="type-caption block text-text-tertiary">{sub}</span>}
      </span>
      {view.display === "delivering" && total > 0 && (
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={cn("h-1 flex-1 rounded-sm", i < d.doneToday.deliveries ? "bg-success" : i === d.doneToday.deliveries ? "bg-info" : "bg-surface-variant")} />
          ))}
        </span>
      )}
    </button>
  );
}

/** Bloco "Pedidos pedindo atenção": some quando não há nenhum; entrada e saída são anunciadas. */
export function AttentionBlock({ items }: { items: readonly AttentionItem[] }) {
  return (
    <div aria-live="polite" className="px-3 pb-3">
      {items.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label className="px-2">Pedidos pedindo atenção</Label>
          {items.slice(0, 5).map((item) => (
            <Link
              key={item.id}
              href={`${Paths.deliveries}?pedido=${item.id}`}
              className={cn(
                "flex items-center gap-2.5 rounded-md border px-3 py-2.5",
                item.tone === "error" ? "border-error/40 bg-error/10" : item.tone === "warning" ? "border-warning/40 bg-warning/10" : "border-border bg-surface",
              )}
            >
              <span className={item.tone === "error" ? "text-error" : item.tone === "warning" ? "text-warning" : "text-text-tertiary"}>
                <Icon name={item.kind === "cancelled_by_origin" || item.kind === "origin_unconfirmed" ? "cancel" : item.kind === "no_driver" ? "person_off" : item.kind === "awaiting_acceptance" ? "notifications_active" : "report"} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="type-body-sm block font-semibold text-text-primary">{item.title}</span>
                <span className="type-caption block text-text-tertiary">{item.subtitle}</span>
              </span>
            </Link>
          ))}
          {items.length > 5 && (
            <Link href={`${Paths.deliveries}`} className="type-caption px-2 font-semibold text-primary-text hover:underline">
              {`Ver todos (${items.length})`}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export function FilterChips({ filter, onChange, counts, total }: { filter: Filter; onChange: (f: Filter) => void; counts: LiveCounts; total: number }) {
  const options: Array<[Filter, string]> = [
    ["all", `Todos ${total}`],
    ["delivering", `Entregando ${counts.delivering}`],
    ["returning", `Voltando ${counts.returning}`],
    ["idle", `Livres ${counts.idle}`],
    ["no_signal", `Sem sinal ${counts.noSignal}`],
  ];
  return (
    <div role="group" aria-label="Filtro da equipe" className="flex flex-wrap gap-1.5 px-5 pb-3">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={filter === key}
          onClick={() => onChange(key)}
          className={cn(
            "type-label-sm min-h-8 cursor-pointer rounded-full border px-2.5 font-semibold",
            filter === key ? "border-border bg-primary-tint text-primary-text" : "border-border text-text-secondary hover:bg-surface-variant",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Painel do motoboy selecionado (inferior direito do mapa; some em sem sinal). */
export function DriverPanel({ view }: { view: DriverView }) {
  const d = view.driver;
  const chip = STATE_CHIP[view.display];
  const tel = d.phone ? telLink(d.phone) : null;
  const wa = d.phone ? whatsappLink("", d.phone) : null;
  const actionClass = "type-label-lg inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 font-semibold text-text-primary hover:bg-surface-variant";
  return (
    <section aria-label={`Detalhe de ${d.fullName}`} className="absolute bottom-5 right-5 flex w-[min(380px,calc(100%-40px))] flex-col gap-3 rounded-lg border border-border bg-background/95 p-4">
      <div className="flex items-center gap-2.5">
        <Avatar initials={d.initials} color={entityColor(d.driverId)} size={34} ring />
        <div className="min-w-0 flex-1">
          <div className="type-title-sm truncate font-bold text-text-primary">{d.fullName}</div>
          <div className="type-caption text-text-tertiary">{`${d.doneToday.deliveries} ${d.doneToday.deliveries === 1 ? "entrega" : "entregas"} hoje · posição ${fineAge(view.ageMs)}`}</div>
        </div>
        <Chip tone={chip.tone} icon={chip.icon}>
          {chip.label}
        </Chip>
      </div>
      {view.display === "delivering" && d.stops.length > 0 && (
        <ol className="flex flex-col">
          {d.stops.map((stop, i) => (
            <li key={stop.deliveryId} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-2.5">
              <span className="flex flex-col items-center self-stretch">
                <span aria-hidden className="mt-1 size-3 rounded-full border-2" style={{ borderColor: entityColor(d.driverId), background: i === 0 ? entityColor(d.driverId) : "transparent" }} />
                {i < d.stops.length - 1 && <span aria-hidden className="min-h-4 w-0.5 flex-1 bg-border" />}
              </span>
              <span className="min-w-0 pb-3">
                <span className="type-body-md flex items-center gap-1.5 font-semibold">
                  {`#${stop.number}${stop.customerName ? ` · ${stop.customerName}` : ""}`}
                  <SourceBadge origin={(stop.origin as Origin) || "unknown"} channel={null} />
                </span>
                {stop.addressLine && <span className="type-caption block text-text-tertiary">{stop.addressLine}</span>}
                {!stop.destination && <span className="type-caption block text-warning">Endereço sem localização no mapa</span>}
              </span>
              <span className="type-caption text-right text-text-tertiary">{i === 0 ? "A caminho" : "Próxima"}</span>
            </li>
          ))}
        </ol>
      )}
      {view.display === "returning" && <p className="type-body-sm text-text-secondary">Voltando para a loja.</p>}
      <div className="flex gap-2">
        {tel ? (
          <a href={tel} className={actionClass}>
            <Icon name="call" size={18} />
            Ligar
          </a>
        ) : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={actionClass}>
            <Icon name="chat" size={18} />
            WhatsApp
          </a>
        ) : null}
        {view.display === "returning" && (
          <Link href={Paths.deliveries} className="type-label-lg inline-flex min-h-10 flex-[1.4] items-center justify-center gap-2 rounded-md bg-primary px-3 font-semibold text-on-primary">
            <Icon name="add_task" size={18} />
            Passar pedido
          </Link>
        )}
      </div>
    </section>
  );
}

export function SideFooter() {
  return (
    <div className="flex gap-2 border-t border-divider p-4">
      <Link href={Paths.team} className="type-label-lg inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border px-3 font-semibold text-text-primary hover:bg-surface-variant">
        <Icon name="calendar_month" size={18} />
        Escala
      </Link>
      <Link href={Paths.deliveries} className="type-label-lg inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 font-semibold text-on-primary hover:bg-primary-dark">
        <Icon name="add" size={18} />
        Novo pedido
      </Link>
    </div>
  );
}
