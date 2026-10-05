"use client";

import "./icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Profiler, useCallback, useMemo, useState, type ReactNode } from "react";
import { useSession } from "@/features/session/useSession";
import { useShortcut, useShortcutsEnabled } from "@/features/shell/ShortcutsProvider";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Paths } from "@/lib/routing/routes";
import { storeName as storeNameOf } from "@/lib/session/user";
import { addDays, spDay, weekStart as mondayOf } from "@/lib/time/saoPaulo";
import { ActionMenu } from "@/ui/ActionMenu";
import { Btn } from "@/ui/Btn";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { EmptyState } from "@/ui/EmptyState";
import { Icon } from "@/ui/Icon";
import { InlineError } from "@/ui/InlineError";
import { PageHead } from "@/ui/PageHead";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { deleteShift, memberAction, updateDeal } from "./api";
import { AddShiftDrawer, type AddShiftRequest } from "./AddShiftDrawer";
import { DealDialog } from "./DealDialog";
import { isCurrentWeekOf, isPastWeekOf, resolveWeek, weekSelectorLabel, weekRangeLabel } from "./dates";
import { teamKeys, useNow, useOnShift, useSchedule, useTeamActions } from "./hooks";
import { InviteModal } from "./InviteModal";
import { isActive, isPaused, type Deal, type Invite, type Member, type Occurrence } from "./model";
import { NowStrip } from "./NowStrip";
import { ShiftMenu, removeShiftDescription } from "./ShiftMenu";
import { WeekGrid } from "./WeekGrid";

export const PAUSE_DESCRIPTION =
  "Os turnos dele ficam suspensos e ele não recebe pedidos até você retomar. Se estiver em turno agora, o turno é encerrado. Os pedidos que ele ainda não retirou ficam sem motoboy.";
export const REMOVE_DESCRIPTION =
  "Os turnos dele a partir de hoje são apagados e ele é avisado no app. Os pedidos que ele ainda não retirou ficam sem motoboy. Para voltar, ele precisa de um novo convite.";

/** "Minha equipe" (`/equipe/`): escala da semana, faixa "Agora", ações de membro e turno, convites. */
export function TeamScreen({ onGridRender }: { onGridRender?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const session = useSession();
  const shortcutsOn = useShortcutsEnabled();
  const now = useNow();

  const today = spDay(now);
  const week = resolveWeek(params.get("semana"), today);
  const schedule = useSchedule(week);
  const data = schedule.data;
  const current = data ? isCurrentWeekOf(data.weekStart, data.today) : false;
  const onShift = useOnShift(current);
  const { busyId, run } = useTeamActions();

  const [addShift, setAddShift] = useState<AddShiftRequest | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resending, setResending] = useState<Invite | null>(null);
  const [shiftFor, setShiftFor] = useState<{ member: Member; occurrence: Occurrence } | null>(null);
  const [dealFor, setDealFor] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  const readOnly = data ? isPastWeekOf(data.weekStart, data.today) : false;
  const activeMembers = useMemo(() => (data ? data.members.filter(isActive) : []), [data]);
  const canAdd = data !== undefined && !readOnly && activeMembers.length > 0;
  const storeName = session.status === "authenticated" ? storeNameOf(session.user) : "sua loja";

  const goToWeek = useCallback(
    (target: string) => {
      router.push(target === mondayOf(spDay(new Date())) ? Paths.team : `${Paths.team}?semana=${target}`);
    },
    [router],
  );
  const shiftWeek = (delta: number) => goToWeek(addDays(week, 7 * delta));

  const openAdd = useCallback(
    (member?: Member, day?: string) => {
      if (!data) return;
      setAddShift({
        weekStart: data.weekStart,
        members: data.members.filter(isActive),
        membershipId: member?.id ?? null,
        day: day ? Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${data.weekStart}T00:00:00Z`)) / 86_400_000) : null,
      });
    },
    [data],
  );

  useShortcut("t", "Adicionar turno", () => canAdd && openAdd());
  useShortcut("c", "Convidar motoboy", () => setInviteOpen(true));
  useShortcut("[", "Semana anterior", () => shiftWeek(-1));
  useShortcut("]", "Próxima semana", () => shiftWeek(1));

  const onShiftTap = useCallback((member: Member, occurrence: Occurrence) => setShiftFor({ member, occurrence }), []);
  const onResendInvite = useCallback((invite: Invite) => {
    setResending(invite);
    setInviteOpen(true);
  }, []);

  const renderMemberMenu = useCallback(
    (member: Member): ReactNode => (
      <ActionMenu
        label={`Opções de ${member.driver.shortName}`}
        busy={busyId === member.id}
        disabled={busyId !== null}
        items={[
          { label: "Combinado padrão", onSelect: () => setDealFor(member) },
          isPaused(member)
            ? {
                label: "Retomar",
                onSelect: () =>
                  void run(member.id, () => memberAction(member.id, "resume"), `${member.driver.shortName} voltou para a escala. Os turnos dele voltaram a valer.`),
              }
            : {
                label: "Pausar",
                onSelect: () =>
                  setConfirm({
                    title: `Pausar ${member.driver.shortName}?`,
                    description: PAUSE_DESCRIPTION,
                    confirmLabel: "Pausar",
                    onConfirm: () => void run(member.id, () => memberAction(member.id, "pause"), `${member.driver.shortName} foi pausado.`),
                  }),
              },
          {
            label: "Remover da equipe",
            danger: true,
            onSelect: () =>
              setConfirm({
                title: `Remover ${member.driver.shortName} da equipe?`,
                description: REMOVE_DESCRIPTION,
                confirmLabel: "Remover",
                danger: true,
                onConfirm: () => void run(member.id, () => memberAction(member.id, "remove"), `${member.driver.shortName} foi removido da equipe.`),
              }),
          },
        ]}
      />
    ),
    [busyId, run],
  );

  const saveDeal = (member: Member, deal: Deal) =>
    void run(member.id, () => updateDeal(member.id, deal), `Combinado de ${member.driver.shortName} salvo.`);

  const removeShift = (occurrence: Occurrence) =>
    void run(occurrence.shiftId, () => deleteShift(occurrence.seriesId), "Turno removido.");

  const closeInvite = () => {
    setInviteOpen(false);
    setResending(null);
    // Convites aceitos, cancelados ou enviados mudam as linhas pendentes da grade.
    void queryClient.invalidateQueries({ queryKey: teamKeys.all });
  };

  let addHint: string | undefined;
  if (data && readOnly) addHint = "Semanas passadas são só para consulta.";
  else if (data && activeMembers.length === 0) addHint = "Convide um motoboy antes de montar a escala.";

  const empty = data ? data.members.length === 0 && data.pendingInvites.length === 0 : false;

  return (
    <>
      <PageHead
        title="Minha equipe"
        sub={`Escala da semana · ${weekRangeLabel(week)}`}
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center rounded-md border border-border">
              <button
                type="button"
                aria-label="Semana anterior"
                onClick={() => shiftWeek(-1)}
                className="grid size-10 cursor-pointer place-items-center text-text-secondary hover:bg-surface-variant"
              >
                <Icon name="chevron_left" size={20} />
              </button>
              <span aria-live="polite" className="type-label-md min-w-[92px] text-center font-semibold">
                {weekSelectorLabel(week, data?.today ?? today)}
              </span>
              <button
                type="button"
                aria-label="Próxima semana"
                onClick={() => shiftWeek(1)}
                className="grid size-10 cursor-pointer place-items-center text-text-secondary hover:bg-surface-variant"
              >
                <Icon name="chevron_right" size={20} />
              </button>
            </div>
            <Btn kind="secondary" icon="person_add" title={shortcutsOn ? "Convidar motoboy (C)" : undefined} onClick={() => setInviteOpen(true)}>
              Convidar motoboy
            </Btn>
            <Btn icon="add" disabled={!canAdd} title={addHint ?? (shortcutsOn ? "Adicionar turno (T)" : undefined)} onClick={() => openAdd()}>
              Adicionar turno
            </Btn>
          </div>
        }
      />

      {schedule.isPending ? (
        <div className="grid flex-1 place-items-center py-16 text-primary-text">
          <Spinner size={32} label="Carregando a escala" />
        </div>
      ) : schedule.isError && !data ? (
        <div className="mx-auto w-full max-w-[420px] p-6">
          <InlineError
            message={isApiError(schedule.error) ? schedule.error.text() : UNKNOWN_MESSAGE}
            onRetry={isApiError(schedule.error) && schedule.error.status === 403 ? undefined : () => void schedule.refetch()}
          />
        </div>
      ) : data && empty ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <EmptyState
            icon="group_add"
            title="Sua equipe ainda está vazia"
            description="Convide motoboys pelo link. Eles entram só com nome e celular, sem enviar documentos."
          >
            <Btn icon="person_add" onClick={() => setInviteOpen(true)}>
              Convidar motoboy
            </Btn>
          </EmptyState>
        </div>
      ) : data ? (
        <div className="flex flex-col pb-7">
          {schedule.isRefetchError && (
            <p role="status" className="type-caption px-5 pb-3 text-text-tertiary lg:px-7">
              Não foi possível atualizar. Tentando de novo.
            </p>
          )}
          {data.occurrences.length === 0 && (
            <div className="mx-5 mb-3 flex items-center gap-2 rounded-md border border-info/30 bg-info/10 p-3 lg:mx-7">
              <span className="text-info">
                <Icon name="info" size={18} />
              </span>
              <p className="type-body-sm text-text-secondary">
                {canAdd ? "Nenhum turno nesta semana. Clique num dia vazio ou em Adicionar turno." : "Nenhum turno nesta semana."}
              </p>
            </div>
          )}
          {current && <NowStrip now={now} onShift={onShift.data ?? []} />}
          <div className="px-5 lg:px-7">
            <Profiler id="week-grid" onRender={() => onGridRender?.()}>
              <WeekGrid
                week={data}
                readOnly={readOnly}
                onAddShift={openAdd}
                onShiftTap={onShiftTap}
                onResendInvite={onResendInvite}
                renderMemberMenu={renderMemberMenu}
              />
            </Profiler>
          </div>
        </div>
      ) : null}

      <AddShiftDrawer
        request={addShift}
        now={now}
        onClose={() => setAddShift(null)}
        onSaved={(message) => {
          setAddShift(null);
          toast({ title: message });
          void queryClient.invalidateQueries({ queryKey: teamKeys.all });
        }}
      />
      <InviteModal open={inviteOpen} storeName={storeName} resend={resending} onClose={closeInvite} />
      <ShiftMenu
        occurrence={shiftFor?.occurrence ?? null}
        memberName={shiftFor?.member.driver.fullName ?? ""}
        readOnly={readOnly}
        today={data?.today ?? today}
        onClose={() => setShiftFor(null)}
        onRemove={(occurrence) => {
          setShiftFor(null);
          setConfirm({
            title: "Remover este turno?",
            description: removeShiftDescription(occurrence),
            confirmLabel: "Remover",
            danger: true,
            onConfirm: () => removeShift(occurrence),
          });
        }}
      />
      <DealDialog member={dealFor} onClose={() => setDealFor(null)} onSave={saveDeal} />
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
