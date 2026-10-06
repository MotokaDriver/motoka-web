"use client";

import { useEffect, useRef, useState } from "react";
import { Btn } from "@/ui/Btn";
import { cn } from "@/ui/cn";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { Dialog } from "@/ui/Dialog";
import { Field } from "@/ui/Field";
import { InlineError } from "@/ui/InlineError";
import { SelectField } from "@/ui/SelectField";
import { Switch } from "@/ui/Switch";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { createShifts } from "./api";
import {
  ENDS_NEXT_DAY,
  availability,
  canSubmit,
  crossesMidnight,
  dropDisabledDays,
  initialForm,
  isDirty,
  submitFailure,
  submitLabel,
  successMessage,
  timeError,
  toInput,
  type AddShiftForm,
} from "./addShift";
import { weekdayShort } from "./dates";
import { DealFields } from "./DealFields";
import { dealLabel, isUndefinedDeal, timeInput, type Member } from "./model";

const PRESETS = [
  { label: "Almoço 11–15", start: "11:00", end: "15:00" },
  { label: "Noite 18–23", start: "18:00", end: "23:00" },
  { label: "Fim de semana 18–00", start: "18:00", end: "00:00" },
] as const;

export interface AddShiftRequest {
  readonly weekStart: string;
  /** Membros ativos. */
  readonly members: readonly Member[];
  readonly membershipId?: string | null;
  /** 0 = segunda. */
  readonly day?: number | null;
}

/** Drawer "Adicionar turno" (spec 4.3). O formulário nasce a cada abertura (remonta por `key`). */
export function AddShiftDrawer({
  request,
  now,
  onClose,
  onSaved,
}: {
  request: AddShiftRequest | null;
  now: Date;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  return request ? <DrawerBody request={request} now={now} onClose={onClose} onSaved={onSaved} /> : null;
}

function DrawerBody({
  request,
  now,
  onClose,
  onSaved,
}: {
  request: AddShiftRequest;
  now: Date;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { weekStart, members } = request;
  const [form, setForm] = useState<AddShiftForm>(() => initialForm(members, request.membershipId, request.day));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDays, setErrorDays] = useState<readonly number[]>([]);
  const [discarding, setDiscarding] = useState(false);

  const member = members.find((m) => m.id === form.membershipId);
  const hasDeal = member !== undefined && !isUndefinedDeal(member.deal);
  const complete = form.start.length === 5 && form.end.length === 5;
  const timeProblem = complete ? timeError(form) : null;
  const ready = !submitting && canSubmit(form, member);

  const edit = (patch: Partial<AddShiftForm>, clear = false) => {
    setForm((current) => dropDisabledDays({ ...current, ...patch }, weekStart, now));
    if (clear) {
      setError(null);
      setErrorDays([]);
    }
  };

  const requestClose = () => {
    if (submitting) return;
    if (isDirty(form, member)) setDiscarding(true);
    else onClose();
  };

  const submit = async () => {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    setErrorDays([]);
    try {
      const created = await createShifts(toInput(form, weekStart));
      onSaved(successMessage(created, member, weekStart));
    } catch (failure) {
      if (isApiError(failure)) {
        const result = submitFailure(failure);
        setError(result.message);
        setErrorDays(result.errorDays);
      } else {
        setError(UNKNOWN_MESSAGE);
      }
      setSubmitting(false);
    }
  };

  // Ctrl+Enter salva o turno aberto (o formulário vive num diálogo, então o listener é do documento).
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        void submitRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const nextWeekDays = form.days
    .filter((d) => availability(form, weekStart, d, now) === "startsNextWeek")
    .map((d) => weekdayShort(d));

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()} variant="right" title="Adicionar turno">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <SelectField
              label="Motoboy"
              value={form.membershipId ?? ""}
              onChange={(event) => {
                const picked = members.find((m) => m.id === event.target.value);
                edit(
                  {
                    membershipId: picked?.id ?? null,
                    // Combinado indefinido não serve de "combinado": abre em "Outro valor".
                    payMode: picked && isUndefinedDeal(picked.deal) ? "custom" : form.payMode,
                  },
                  true,
                );
              }}
            >
              {form.membershipId === null && <option value="">Escolha o motoboy</option>}
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.driver.fullName} · {m.access === "full" ? "equipe + avulsas" : "só equipe"}
                </option>
              ))}
            </SelectField>

            <fieldset className="flex flex-col gap-2">
              <legend className="type-label-sm mb-2 font-semibold uppercase tracking-[0.8px] text-text-tertiary">Dias da semana</legend>
              <div className="grid grid-cols-7 gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                  const selected = form.days.includes(day);
                  const disabled = availability(form, weekStart, day, now) === "started";
                  const failed = errorDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={selected}
                      disabled={disabled}
                      title={disabled ? "Este dia já passou nesta semana." : undefined}
                      aria-label={disabled ? `${weekdayShort(day)}, este dia já passou nesta semana` : weekdayShort(day)}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          days: current.days.includes(day) ? current.days.filter((d) => d !== day) : [...current.days, day],
                        }))
                      }
                      className={cn(
                        "type-label-md min-h-11 cursor-pointer rounded-md border py-2.5 text-center font-semibold",
                        selected ? "bg-primary text-on-primary" : "bg-surface-variant text-text-secondary",
                        failed ? "border-[1.5px] border-error" : selected ? "border-primary" : "border-border",
                        "disabled:cursor-not-allowed disabled:text-text-disabled",
                      )}
                    >
                      {weekdayShort(day)}
                    </button>
                  );
                })}
              </div>
              {nextWeekDays.length > 0 && (
                <p className="type-caption text-text-tertiary">Começa na semana que vem: {nextWeekDays.join(", ")}.</p>
              )}
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="type-label-sm mb-2 font-semibold uppercase tracking-[0.8px] text-text-tertiary">Horário</legend>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5">
                <Field
                  label="Início do turno"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.start}
                  error={timeProblem ?? undefined}
                  onChange={(event) => edit({ start: timeInput(event.target.value) })}
                />
                <span className="type-body-md mt-7 text-text-tertiary">até</span>
                <Field
                  label="Fim do turno"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.end}
                  onChange={(event) => edit({ end: timeInput(event.target.value) })}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => {
                  const active = form.start === preset.start && form.end === preset.end;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => edit({ start: preset.start, end: preset.end })}
                      className={cn(
                        "type-label-sm min-h-8 cursor-pointer rounded-full border px-2.5 py-1",
                        active ? "border-primary bg-primary-tint text-primary-text" : "border-border text-text-secondary",
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              {!timeProblem && crossesMidnight(form) && <p className="type-caption text-text-tertiary">{ENDS_NEXT_DAY}</p>}
            </fieldset>

            <div className="flex flex-col gap-3">
              <SelectField
                label="Remuneração"
                value={form.payMode}
                hint={member && !hasDeal ? "Este motoboy ainda não tem combinado. Informe o valor." : undefined}
                onChange={(event) => edit({ payMode: event.target.value === "custom" ? "custom" : "member" })}
              >
                {member && hasDeal && <option value="member">Combinado do motoboy · {dealLabel(member.deal)}</option>}
                <option value="custom">Outro valor</option>
              </SelectField>
              {form.payMode === "custom" && (
                <DealFields
                  value={{ type: form.customType, daily: form.customDaily, perDelivery: form.customPerDelivery, rain: form.customRain }}
                  onChange={(next) =>
                    edit({ customType: next.type, customDaily: next.daily, customPerDelivery: next.perDelivery, customRain: next.rain })
                  }
                />
              )}
            </div>

            <div className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-4">
              <Switch
                label="Repetir toda semana"
                description="Vira escala fixa até você mudar"
                checked={form.repeatWeekly}
                onCheckedChange={(repeatWeekly) => edit({ repeatWeekly })}
              />
              <div className="h-px bg-divider" />
              <Switch
                label="Lembrar de ativar localização"
                description="Notificação no celular 15 min antes do turno."
                checked={form.remindLocation}
                onCheckedChange={(remindLocation) => edit({ remindLocation })}
              />
            </div>
            <p className="type-caption text-text-tertiary">
              Quem está em turno é quem o Motoka usa para aceitar sozinho os pedidos que chegam das integrações.
            </p>
            {error && <InlineError message={error} />}
          </div>
          <div className="flex gap-2.5 border-t border-divider p-5">
            <Btn kind="secondary" className="flex-1" disabled={submitting} onClick={requestClose}>
              Cancelar
            </Btn>
            <Btn type="submit" className="flex-[2]" loading={submitting} disabled={!ready && !submitting}>
              {submitLabel(form)}
            </Btn>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        request={
          discarding
            ? {
                title: "Descartar as alterações?",
                description: "O turno que você está montando ainda não foi salvo.",
                confirmLabel: "Descartar",
                cancelLabel: "Continuar editando",
                danger: true,
                onConfirm: onClose,
              }
            : null
        }
        onClose={() => setDiscarding(false)}
      />
    </>
  );
}
