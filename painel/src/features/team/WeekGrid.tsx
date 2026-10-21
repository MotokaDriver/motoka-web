"use client";

import { memo, useMemo, type ReactNode } from "react";
import { cn } from "@/ui/cn";
import { Avatar } from "@/ui/Avatar";
import { Chip } from "@/ui/Chip";
import { Icon } from "@/ui/Icon";
import { Label } from "@/ui/Label";
import {
  capitalized,
  dayOfMonth,
  isNightShift,
  shiftTimeLabel,
  weekDays,
  weekdayIndex,
  weekdayLong,
  weekdayShort,
} from "./dates";
import {
  entityColor,
  inviteDisplayName,
  isPaused,
  type BusySlot,
  type CoverageDay,
  type Invite,
  type Member,
  type Occurrence,
  type Schedule,
} from "./model";

/** Largura mínima da grade; abaixo disso ela rola dentro de si, não a página. */
const COLUMNS = "grid-cols-[200px_repeat(7,minmax(0,1fr))] xl:grid-cols-[232px_repeat(7,minmax(0,1fr))]";

export interface WeekGridProps {
  readonly week: Schedule;
  /** Semana passada: só consulta. */
  readonly readOnly: boolean;
  readonly onAddShift: (member: Member, date: string) => void;
  readonly onShiftTap: (member: Member, occurrence: Occurrence) => void;
  readonly onResendInvite: (invite: Invite) => void;
  readonly renderMemberMenu: (member: Member) => ReactNode;
}

const pairKey = (id: string, date: string) => `${id}|${date}`;

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

const NONE: readonly never[] = [];

/**
 * Grade semanal (`WeekGrid` do design): uma linha por membro e por convite pendente, sete colunas e a
 * linha "Cobertura". Memoizada: dois ticks de polling com o mesmo conteúdo mantêm a referência da
 * semana (compartilhamento estrutural do Query) e a grade não renderiza de novo.
 */
export const WeekGrid = memo(function WeekGrid({
  week,
  readOnly,
  onAddShift,
  onShiftTap,
  onResendInvite,
  renderMemberMenu,
}: WeekGridProps) {
  const days = useMemo(() => weekDays(week.weekStart), [week.weekStart]);
  const occurrences = useMemo(() => groupBy(week.occurrences, (o) => pairKey(o.membershipId, o.date)), [week.occurrences]);
  const busy = useMemo(() => groupBy(week.busy, (b) => pairKey(b.driverId, b.date)), [week.busy]);
  const coverage = useMemo(() => new Map(week.coverage.map((c) => [c.date, c])), [week.coverage]);

  return (
    <div className="overflow-x-auto pb-3">
      <div
        role="table"
        aria-label="Escala da semana"
        className="min-w-[904px] overflow-hidden rounded-lg border border-border bg-surface"
      >
        <div role="row" className={cn("grid border-b border-border", COLUMNS)}>
          <div role="columnheader" className="px-4 py-3">
            <Label>Motoboy</Label>
          </div>
          {days.map((day) => (
            <DayHeader key={day} day={day} isToday={day === week.today} />
          ))}
        </div>
        {week.members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            days={days}
            today={week.today}
            readOnly={readOnly}
            occurrences={occurrences}
            busy={busy}
            onAddShift={onAddShift}
            onShiftTap={onShiftTap}
            menu={renderMemberMenu(member)}
          />
        ))}
        {week.pendingInvites.map((invite) => (
          <InviteRow key={invite.id} invite={invite} onResend={onResendInvite} />
        ))}
        <div role="row" className={cn("grid bg-background", COLUMNS)}>
          <div role="rowheader" className="flex items-center px-4 py-3">
            <Label>Cobertura</Label>
          </div>
          {days.map((day) => (
            <CoverageCell key={day} day={day} today={week.today} coverage={coverage.get(day)} />
          ))}
        </div>
      </div>
    </div>
  );
});

function DayHeader({ day, isToday }: { day: string; isToday: boolean }) {
  const index = weekdayIndex(day);
  return (
    <div
      role="columnheader"
      aria-label={`${weekdayLong(index)} ${dayOfMonth(day)}${isToday ? ", hoje" : ""}`}
      className={cn("border-l border-divider p-2.5", isToday && "bg-primary-tint")}
    >
      <div className={cn("type-label-md font-bold", isToday ? "text-primary-text" : "text-text-primary")}>
        {weekdayShort(index)}
      </div>
      <div className="type-caption text-text-tertiary">
        {String(dayOfMonth(day)).padStart(2, "0")}
        {isToday ? " · hoje" : ""}
      </div>
    </div>
  );
}

const MemberRow = memo(function MemberRow({
  member,
  days,
  today,
  readOnly,
  occurrences,
  busy,
  onAddShift,
  onShiftTap,
  menu,
}: {
  member: Member;
  days: readonly string[];
  today: string;
  readOnly: boolean;
  occurrences: ReadonlyMap<string, readonly Occurrence[]>;
  busy: ReadonlyMap<string, readonly BusySlot[]>;
  onAddShift: (member: Member, date: string) => void;
  onShiftTap: (member: Member, occurrence: Occurrence) => void;
  menu: ReactNode;
}) {
  const paused = isPaused(member);
  return (
    <div role="row" className={cn("grid min-h-[76px] border-b border-divider", COLUMNS)}>
      <div role="rowheader" className="relative flex items-center gap-2.5 py-3 pl-4 pr-3">
        <Avatar initials={member.driver.initials} color={entityColor(member.driver.id)} size={34} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1 pr-6">
          <div className="type-title-sm max-w-full truncate font-semibold text-text-primary" title={member.driver.fullName}>
            {member.driver.fullName}
            {member.alsoInOtherTeam && (
              <span title="Também está em outra equipe" className="type-caption ml-1.5 font-normal text-text-tertiary">
                +1 equipe
                <span className="sr-only"> (também está em outra equipe)</span>
              </span>
            )}
          </div>
          <AccessChip member={member} />
        </div>
        <div className="absolute right-0 top-0">{menu}</div>
      </div>
      {days.map((day) => (
        <DayCell
          key={day}
          member={member}
          day={day}
          isToday={day === today}
          occurrences={occurrences.get(pairKey(member.id, day)) ?? NONE}
          busy={busy.get(pairKey(member.driver.id, day)) ?? NONE}
          canAdd={!readOnly && !paused}
          dimmed={paused}
          onAddShift={onAddShift}
          onShiftTap={onShiftTap}
        />
      ))}
    </div>
  );
});

function AccessChip({ member }: { member: Member }) {
  if (isPaused(member)) return <Chip icon="pause_circle">Pausado</Chip>;
  return member.access === "full" ? (
    <Chip tone="success" icon="verified_user">
      Equipe + avulsas
    </Chip>
  ) : (
    <Chip tone="info" icon="group">
      Só equipe · sem KYC
    </Chip>
  );
}

const timeWords = (start: string, end: string) => shiftTimeLabel(start, end).replace("–", " às ");

/** Um dia de um membro: pílulas de turno, bloco "Ocupado" ou o "+" vazio. */
function DayCell({
  member,
  day,
  isToday,
  occurrences,
  busy,
  canAdd,
  dimmed,
  onAddShift,
  onShiftTap,
}: {
  member: Member;
  day: string;
  isToday: boolean;
  occurrences: readonly Occurrence[];
  busy: readonly BusySlot[];
  canAdd: boolean;
  dimmed: boolean;
  onAddShift: (member: Member, date: string) => void;
  onShiftTap: (member: Member, occurrence: Occurrence) => void;
}) {
  const color = entityColor(member.driver.id);
  const who = `${member.driver.fullName}, ${weekdayLong(weekdayIndex(day))} ${dayOfMonth(day)}`;
  const empty = occurrences.length === 0 && busy.length === 0;
  return (
    <div
      role="cell"
      className={cn(
        "flex flex-col justify-center gap-1.5 border-l border-divider p-2",
        isToday && "bg-primary/5",
        dimmed && "opacity-60",
      )}
    >
      {occurrences.map((o) => (
        <button
          key={o.shiftId}
          type="button"
          onClick={() => onShiftTap(member, o)}
          aria-label={`${who}, ${o.suspended ? `turno suspenso enquanto ${member.driver.shortName} está pausado, ` : ""}turno das ${timeWords(o.startTime, o.endTime)}. Abrir opções do turno.`}
          style={
            o.suspended
              ? undefined
              : {
                  background: `color-mix(in srgb, ${color} ${isToday ? 26 : 16}%, var(--surface))`,
                  borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
                }
          }
          className={cn(
            "type-label-sm flex min-h-8 w-full cursor-pointer items-center gap-1.5 rounded-sm border px-2 py-1.5 text-left font-semibold whitespace-nowrap",
            o.suspended ? "border-dashed border-border text-text-tertiary" : "text-text-primary",
          )}
        >
          {o.suspended ? (
            <Icon name="pause_circle" size={13} />
          ) : (
            <span style={{ color }}>
              <Icon name={isNightShift(o.startTime) ? "dark_mode" : "light_mode"} size={13} filled />
            </span>
          )}
          <span className="truncate">{shiftTimeLabel(o.startTime, o.endTime)}</span>
        </button>
      ))}
      {busy.map((b) => (
        <div
          key={`${b.startTime}-${b.endTime}`}
          title="Turno em outra equipe"
          role="img"
          aria-label={`${who}, ocupado em outra equipe das ${timeWords(b.startTime, b.endTime)}.`}
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent 0 5px, color-mix(in srgb, var(--text-primary) 5%, transparent) 5px 10px)",
          }}
          className="type-label-sm flex min-w-0 flex-col rounded-sm border border-dashed border-border px-2 py-[5px] text-text-tertiary"
        >
          <span className="truncate font-semibold">Ocupado</span>
          <span className="truncate">{shiftTimeLabel(b.startTime, b.endTime)}</span>
        </div>
      ))}
      {empty && (
        <button
          type="button"
          disabled={!canAdd}
          onClick={() => onAddShift(member, day)}
          aria-label={`${who}, sem turno.${canAdd ? " Adicionar turno." : ""}`}
          className="grid h-[30px] w-full cursor-pointer place-items-center rounded-sm border border-dashed border-border text-text-tertiary enabled:hover:bg-surface-variant disabled:cursor-default"
        >
          {canAdd && <Icon name="add" size={16} />}
        </button>
      )}
    </div>
  );
}

function InviteRow({ invite, onResend }: { invite: Invite; onResend: (invite: Invite) => void }) {
  const name = inviteDisplayName(invite);
  return (
    <div role="row" className={cn("grid min-h-[76px] border-b border-divider", COLUMNS)}>
      <div role="rowheader" className="flex items-center gap-2.5 py-3 pl-4 pr-2">
        <Avatar initials={invite.initials} color="#8E8E93" size={34} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <div className="type-title-sm max-w-full truncate font-semibold text-text-tertiary" title={name}>
            {name}
          </div>
          <Chip icon="schedule_send">Convite pendente</Chip>
        </div>
      </div>
      <div role="cell" className="col-span-7 flex items-center gap-2 border-l border-divider px-4">
        <span className="text-text-tertiary">
          <Icon name="hourglass_empty" size={16} />
        </span>
        <span className="type-body-sm min-w-0 flex-1 text-text-tertiary">
          Os turnos ficam liberados assim que ele aceitar o convite.
        </span>
        <button
          type="button"
          onClick={() => onResend(invite)}
          aria-label={`Reenviar convite para ${name}`}
          className="type-label-md min-h-10 shrink-0 cursor-pointer rounded-sm px-3 font-semibold text-primary-text hover:bg-primary-tint"
        >
          Reenviar convite
        </button>
      </div>
    </div>
  );
}

/** "Almoço 2" numa linha; sem ninguém, a faixa e "sem ninguém" em duas linhas curtas, nunca cortadas. */
function CoverageCell({ day, today, coverage }: { day: string; today: string; coverage: CoverageDay | undefined }) {
  const lunch = coverage?.lunch ?? 0;
  const night = coverage?.night ?? 0;
  // Dia que já acabou não é alarme: cobertura perdida não tem como corrigir.
  const past = day < today;
  const line = (name: string, count: number) => {
    const alarm = count === 0 && !past;
    const tone = alarm ? "font-semibold text-error" : count === 0 ? "text-text-tertiary" : "text-text-secondary";
    return count > 0 ? (
      <span className={cn("whitespace-nowrap", tone)}>
        {name} {count}
      </span>
    ) : (
      <span className={cn("flex flex-col", tone)}>
        <span className="whitespace-nowrap">{name}</span>
        <span className="whitespace-nowrap">sem ninguém</span>
      </span>
    );
  };
  const spoken = (name: string, count: number) => (count === 0 ? `${name} sem ninguém` : `${name} ${count}`);
  return (
    <div
      role="cell"
      aria-label={`${capitalized(weekdayLong(weekdayIndex(day)))} ${dayOfMonth(day)}: ${spoken("almoço", lunch)}, ${spoken("noite", night)}`}
      className="type-caption flex min-w-0 flex-col gap-1 border-l border-divider p-2.5"
    >
      {line("Almoço", lunch)}
      {line("Noite", night)}
    </div>
  );
}
