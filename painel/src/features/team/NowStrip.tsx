"use client";

import Link from "next/link";
import { Avatar } from "@/ui/Avatar";
import { Label } from "@/ui/Label";
import { Paths } from "@/lib/routing/routes";
import { spDay, spTime } from "@/lib/time/saoPaulo";
import { cn } from "@/ui/cn";
import { nowLabel, shiftBandLabel } from "./dates";
import { entityColor, type OnShiftDriver } from "./model";

/**
 * Faixa "Agora" (D-W5-07): o relógio, quantos estão em turno e um cartão por motoboy em turno. Só o
 * E16 alimenta: sem posição, então ainda não há "Entregando" (isso é do mapa, WN-3).
 */
export function NowStrip({ now, onShift }: { now: Date; onShift: readonly OnShiftDriver[] }) {
  const time = spTime(now);
  const band = shiftBandLabel(Number(time.slice(0, 2)));
  const count = onShift.length;
  return (
    <section aria-label="Agora" className="mx-5 mb-[18px] flex gap-3 lg:mx-7">
      <div className="flex w-[184px] shrink-0 flex-col justify-center rounded-lg border border-border bg-surface px-4 py-3">
        <Label>Agora</Label>
        <div className="type-title-md mt-1 font-bold text-text-primary">{nowLabel(spDay(now), time)}</div>
        <div className="type-caption text-text-tertiary">
          {[band, count === 0 ? "Ninguém em turno" : `${count} em turno`].filter(Boolean).join(" · ")}
        </div>
        <Link href={Paths.live} className="type-label-sm mt-1.5 self-start font-semibold text-primary-text hover:underline">
          Ver no mapa ›
        </Link>
      </div>
      <ul className="flex min-w-0 flex-1 gap-3 overflow-x-auto">
        {onShift.map((entry) => (
          <DriverCard key={entry.membershipId} entry={entry} />
        ))}
      </ul>
    </section>
  );
}

function DriverCard({ entry }: { entry: OnShiftDriver }) {
  const started = entry.sessionStarted;
  const end = entry.endsAt ? spTime(new Date(entry.endsAt)) : null;
  return (
    <li
      className={cn(
        "flex min-w-[230px] flex-1 items-center gap-3 rounded-lg border bg-surface p-3.5",
        started ? "border-border" : "border-warning/40",
      )}
    >
      <Avatar initials={entry.driver.initials} color={entityColor(entry.driver.id)} size={36} ring={started} />
      <div className="min-w-0 flex-1">
        <div className="type-title-sm truncate font-semibold text-text-primary" title={entry.driver.fullName}>
          {entry.driver.fullName}
        </div>
        {started ? (
          <div className="type-caption flex items-center gap-1.5 text-text-tertiary">
            <span aria-hidden className="size-[7px] shrink-0 rounded-full bg-success" />
            <span className="truncate">Em turno{end ? ` · até ${end}` : ""}</span>
          </div>
        ) : (
          <div className="type-caption text-warning">Turno não iniciado</div>
        )}
      </div>
    </li>
  );
}
