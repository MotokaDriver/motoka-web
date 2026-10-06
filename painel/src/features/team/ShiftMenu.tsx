"use client";

import { Btn } from "@/ui/Btn";
import { Dialog } from "@/ui/Dialog";
import { Icon, type IconName } from "@/ui/Icon";
import { spTime } from "@/lib/time/saoPaulo";
import { capitalized, dayOfMonth, weekdayIndex, weekdayLong } from "./dates";
import { isInProgress, type Occurrence } from "./model";

export const IN_PROGRESS_HINT = "Este turno está em andamento. Ele pode ser removido depois que terminar.";
export const ENDED_HINT = "Este turno já aconteceu.";
export const PAST_WEEK_HINT = "Semanas passadas são só para consulta.";

export const shiftTitle = (o: Occurrence): string =>
  `${capitalized(weekdayLong(weekdayIndex(o.date)))}, ${o.startTime}–${o.endTime}`;

export function recurrenceText(o: Occurrence): string | null {
  if (o.repeatsWeekly === true) return "Repete toda semana";
  if (o.repeatsWeekly === false) return "Só nesta semana";
  return null;
}

export const reminderText = (o: Occurrence): string =>
  o.remindLocation ? "Lembrete de localização ligado" : "Lembrete de localização desligado";

/** "Em andamento desde 18:02", no horário de São Paulo. */
export function inProgressText(o: Occurrence): string | null {
  const started = o.session?.startedAt;
  if (!isInProgress(o) || !started) return null;
  return `Em andamento desde ${spTime(new Date(started))}`;
}

/** Corpo da confirmação. Sem `repeats_weekly`, vale o primeiro texto: ele está certo nos dois casos. */
export function removeShiftDescription(o: Occurrence): string {
  const day = weekdayLong(weekdayIndex(o.date));
  if (o.repeatsWeekly === false) {
    return `O turno de ${day}, ${dayOfMonth(o.date)} das ${o.startTime} às ${o.endTime} é removido.`;
  }
  return `Os turnos de ${day} das ${o.startTime} às ${o.endTime} deixam de acontecer a partir da próxima vez. O de hoje, se já começou, continua.`;
}

function Line({ icon, children }: { icon: IconName; children: string }) {
  return (
    <p className="type-body-md flex items-start gap-2 text-text-secondary">
      <span className="mt-0.5 text-text-tertiary">
        <Icon name={icon} size={18} />
      </span>
      {children}
    </p>
  );
}

/** Menu do turno: detalhes e "Remover turno". A confirmação e a chamada à API são do chamador. */
export function ShiftMenu({
  occurrence,
  memberName,
  readOnly,
  today,
  onClose,
  onRemove,
}: {
  occurrence: Occurrence | null;
  memberName: string;
  readOnly: boolean;
  /** Hoje em SP (da API): turno "só nesta semana" que já passou não tem o que remover (`TEAM_SHIFT_ENDED`). */
  today: string;
  onClose: () => void;
  onRemove: (occurrence: Occurrence) => void;
}) {
  const o = occurrence;
  const recurrence = o ? recurrenceText(o) : null;
  const progress = o ? inProgressText(o) : null;
  const ended = o !== null && o.repeatsWeekly === false && o.date < today;
  const disabledReason = readOnly ? PAST_WEEK_HINT : ended ? ENDED_HINT : o && isInProgress(o) ? IN_PROGRESS_HINT : null;
  return (
    <Dialog
      open={o !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="sm"
      title={o ? shiftTitle(o) : ""}
      description={memberName}
    >
      {o && (
        <>
          <div className="mt-5 flex flex-col gap-2">
            {o.suspended && <Line icon="pause_circle">Turno suspenso enquanto o motoboy está pausado.</Line>}
            {recurrence && <Line icon="repeat">{recurrence}</Line>}
            <Line icon="notifications_active">{reminderText(o)}</Line>
            {progress && <Line icon="play_circle">{progress}</Line>}
          </div>
          {disabledReason && <p className="type-caption mt-4 text-text-tertiary">{disabledReason}</p>}
          <div className="mt-5 flex flex-col gap-2">
            <Btn kind="danger" icon="delete" title={disabledReason ?? undefined} disabled={disabledReason !== null} onClick={() => onRemove(o)}>
              Remover turno
            </Btn>
            <Btn kind="secondary" onClick={onClose}>
              Fechar
            </Btn>
          </div>
        </>
      )}
    </Dialog>
  );
}
