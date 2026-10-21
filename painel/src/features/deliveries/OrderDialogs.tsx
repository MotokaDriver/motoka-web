"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useState } from "react";
import { Btn } from "@/ui/Btn";
import { cn } from "@/ui/cn";
import { Dialog } from "@/ui/Dialog";
import { Field } from "@/ui/Field";
import { InlineError } from "@/ui/InlineError";

export const CANCEL_REASONS = ["Cliente desistiu", "Pedido duplicado", "Fora da área de entrega"] as const;
const OTHER = "Outro motivo";

export const CONFIRM_REASONS = [
  { value: "customer_without_code", label: "Cliente sem o código" },
  { value: "code_locked", label: "Código bloqueado por tentativas" },
  { value: "driver_unreachable", label: "Motoboy sem sinal ou sem bateria" },
  { value: "other", label: OTHER },
] as const;

function ReasonGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <RadioGroup aria-label={label} value={value} onValueChange={(next) => onChange(String(next))} className="mt-5 flex flex-col gap-2">
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          className={cn(
            "type-body-md flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-3 text-left text-text-secondary",
            "data-[checked]:border-primary data-[checked]:bg-primary-tint data-[checked]:text-text-primary",
          )}
        >
          <span aria-hidden className="grid size-4 place-items-center rounded-full border border-border-light">
            <Radio.Indicator className="size-2 rounded-full bg-primary" />
          </span>
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}

/** "Cancelar o pedido #n?": motivo obrigatório; depois da retirada, o aviso do retorno. */
export function CancelDialog({
  open,
  number,
  afterPickup,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  number: number;
  afterPickup: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()} title={`Cancelar o pedido #${number}?`} description={afterPickup ? "O motoboy volta com o pedido e isso conta como retorno no acerto." : undefined}>
      {open && <CancelForm busy={busy} error={error} onClose={onClose} onConfirm={onConfirm} />}
    </Dialog>
  );
}

function CancelForm({ busy, error, onClose, onConfirm }: { busy: boolean; error: string | null; onClose: () => void; onConfirm: (reason: string) => void | Promise<void> }) {
  const [choice, setChoice] = useState<string>("");
  const [text, setText] = useState("");
  const reason = choice === OTHER ? text.trim() : choice;
  return (
    <>
      <ReasonGroup label="Motivo do cancelamento" options={[...CANCEL_REASONS, OTHER].map((r) => ({ value: r, label: r }))} value={choice} onChange={setChoice} />
      {choice === OTHER && (
        <div className="mt-3">
          <Field label="Descreva o motivo" maxLength={280} value={text} onChange={(event) => setText(event.target.value)} />
        </div>
      )}
      {error && (
        <div className="mt-4">
          <InlineError message={error} />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Btn kind="secondary" disabled={busy} onClick={onClose}>
          Voltar
        </Btn>
        <Btn kind="danger" loading={busy} disabled={reason === ""} onClick={() => void onConfirm(reason)}>
          Cancelar pedido
        </Btn>
      </div>
    </>
  );
}

/** Confirmar a entrega sem o código (E9): motivo obrigatório; "Outro motivo" pede descrição. */
export function ConfirmDeliveryDialog({
  open,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string, description: string | null) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()} title="Confirmar a entrega?" description="Use quando o cliente recebeu e o código não foi digitado.">
      {open && <ConfirmForm busy={busy} error={error} onClose={onClose} onConfirm={onConfirm} />}
    </Dialog>
  );
}

function ConfirmForm({ busy, error, onClose, onConfirm }: { busy: boolean; error: string | null; onClose: () => void; onConfirm: (reason: string, description: string | null) => void | Promise<void> }) {
  const [choice, setChoice] = useState<string>("");
  const [text, setText] = useState("");
  const ready = choice !== "" && (choice !== "other" || text.trim() !== "");
  return (
    <>
      <ReasonGroup label="Motivo da confirmação" options={CONFIRM_REASONS} value={choice} onChange={setChoice} />
      {choice === "other" && (
        <div className="mt-3">
          <Field label="Descreva o motivo" maxLength={280} value={text} onChange={(event) => setText(event.target.value)} />
        </div>
      )}
      {error && (
        <div className="mt-4">
          <InlineError message={error} />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Btn kind="secondary" disabled={busy} onClick={onClose}>
          Voltar
        </Btn>
        <Btn loading={busy} disabled={!ready} onClick={() => void onConfirm(choice, choice === "other" ? text.trim() : null)}>
          Confirmar entrega
        </Btn>
      </div>
    </>
  );
}

export interface AddressValues {
  readonly street: string;
  readonly number: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
  readonly complement: string;
  readonly reference: string;
}

/** "Corrigir endereço" (E10): até a retirada. Os campos nascem do endereço atual do pedido. */
export function AddressDialog({
  open,
  initial,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  initial: AddressValues;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (values: AddressValues) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()} title="Corrigir endereço" description="Vale até o motoboy retirar o pedido. O mapa localiza o endereço de novo.">
      {open && <AddressForm initial={initial} busy={busy} error={error} onClose={onClose} onConfirm={onConfirm} />}
    </Dialog>
  );
}

function AddressForm({ initial, busy, error, onClose, onConfirm }: { initial: AddressValues; busy: boolean; error: string | null; onClose: () => void; onConfirm: (values: AddressValues) => void | Promise<void> }) {
  const [v, setV] = useState(initial);
  const set = (key: keyof AddressValues) => (event: { target: { value: string } }) => setV((c) => ({ ...c, [key]: key === "state" ? event.target.value.toUpperCase() : event.target.value }));
  const valid = v.street.trim() !== "" && v.number.trim() !== "" && v.neighborhood.trim() !== "" && v.city.trim() !== "" && /^[A-Za-z]{2}$/.test(v.state.trim());
  return (
    <>
      <div className="mt-5 flex flex-col gap-3">
        <Field label="Rua" autoComplete="off" value={v.street} onChange={set("street")} />
        <div className="grid grid-cols-[110px_1fr] gap-2">
          <Field label="Número" autoComplete="off" value={v.number} onChange={set("number")} />
          <Field label="Bairro" autoComplete="off" value={v.neighborhood} onChange={set("neighborhood")} />
        </div>
        <div className="grid grid-cols-[1fr_80px] gap-2">
          <Field label="Cidade" autoComplete="off" value={v.city} onChange={set("city")} />
          <Field label="UF" maxLength={2} autoComplete="off" value={v.state} onChange={set("state")} />
        </div>
        <Field label="CEP (opcional)" inputMode="numeric" autoComplete="off" value={v.zip} onChange={set("zip")} />
        <Field label="Complemento" autoComplete="off" value={v.complement} onChange={set("complement")} />
        <Field label="Referência" autoComplete="off" value={v.reference} onChange={set("reference")} />
      </div>
      {error && (
        <div className="mt-4">
          <InlineError message={error} />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Btn kind="secondary" disabled={busy} onClick={onClose}>
          Voltar
        </Btn>
        <Btn loading={busy} disabled={!valid} onClick={() => void onConfirm(v)}>
          Salvar endereço
        </Btn>
      </div>
    </>
  );
}
