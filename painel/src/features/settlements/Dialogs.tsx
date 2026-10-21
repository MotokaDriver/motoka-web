"use client";

import { useState } from "react";
import { currencyInput, currencyToDecimal } from "@/features/team/model";
import { Btn } from "@/ui/Btn";
import { Dialog } from "@/ui/Dialog";
import { Field } from "@/ui/Field";
import { InlineError } from "@/ui/InlineError";
import { Switch } from "@/ui/Switch";
import type { AdjustInput } from "./api";
import type { SettlementDetail } from "./model";

/** Valor com sinal no campo ("-R$ 5,00"): o "-" no começo vira negativo; o resto são os centavos. */
export function signedCurrencyInput(raw: string): string {
  const negative = raw.trim().startsWith("-");
  const text = currencyInput(raw);
  return text === "" ? (negative ? "-" : "") : negative ? `-${text}` : text;
}

/** "-R$ 5,00" → "-5.00"; "" ou só "-" → `null`. */
export function signedToDecimal(text: string): string | null {
  const decimal = currencyToDecimal(text);
  if (decimal === null) return null;
  return text.trim().startsWith("-") ? `-${decimal}` : decimal;
}

const usesDaily = (payType: string) => payType !== "per_delivery";
const usesPerDelivery = (payType: string) => payType !== "fixed_value";

/**
 * "Ajustar acerto" (S7): chuva, ajuste com nota e, quando a tarifa congelada está nula, as tarifas. Só manda o que a
 * pessoa mudou. As linhas retiradas do acerto ficam no painel (Retirar e Desfazer), não aqui.
 */
export function AdjustDialog({
  open,
  detail,
  busy,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  detail: SettlementDetail;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: Omit<AdjustInput, "version">, version: number) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()} title="Ajustar acerto" description="O servidor refaz as contas. Se o total mudar, o motoboy confere de novo.">
      {open && <AdjustForm detail={detail} busy={busy} error={error} onClose={onClose} onSave={onSave} />}
    </Dialog>
  );
}

function AdjustForm({ detail, busy, error, onClose, onSave }: { detail: SettlementDetail; busy: boolean; error: string | null; onClose: () => void; onSave: (input: Omit<AdjustInput, "version">, version: number) => void | Promise<void> }) {
  const hasRain = detail.deal.rainBonusPercent !== null;
  const needsDaily = detail.deal.dailyRate === null && usesDaily(detail.deal.payType);
  const needsPerDelivery = detail.deal.perDeliveryRate === null && usesPerDelivery(detail.deal.payType);
  const [openedVersion] = useState(detail.version); // a versão que a pessoa viu ao abrir: o S7 manda esta, não a do polling
  const stale = detail.version !== openedVersion;
  const [rain, setRain] = useState(detail.rain.applied);
  const [amount, setAmount] = useState(() => (detail.adjustment.amount === "0.00" ? "" : signedCurrencyInput(detail.adjustment.amount.replace(".", ""))));
  const [note, setNote] = useState(detail.adjustment.note ?? "");
  const [daily, setDaily] = useState("");
  const [perDelivery, setPerDelivery] = useState("");

  const decimal = signedToDecimal(amount);
  const nextAmount = amount === "" || amount === "-" ? "0.00" : decimal;
  const nextNote = note.trim() || null;
  const noteMissing = nextAmount !== null && Number(nextAmount) !== 0 && nextNote === null;
  const adjustmentChanged = nextAmount !== null && (Number(nextAmount) !== Number(detail.adjustment.amount) || nextNote !== detail.adjustment.note);
  const dailyDecimal = needsDaily ? currencyToDecimal(daily) : null;
  const perDeliveryDecimal = needsPerDelivery ? currencyToDecimal(perDelivery) : null;
  const input: Omit<AdjustInput, "version"> = {
    ...(hasRain && rain !== detail.rain.applied ? { rainApplied: rain } : {}),
    ...(adjustmentChanged ? { adjustmentAmount: nextAmount, adjustmentNote: nextNote } : {}),
    ...(dailyDecimal ? { dailyRate: dailyDecimal } : {}),
    ...(perDeliveryDecimal ? { perDeliveryRate: perDeliveryDecimal } : {}),
  };
  const changed = Object.keys(input).length > 0;

  return (
    <>
      <div className="mt-5 flex flex-col gap-4">
        {hasRain && (
          <Switch label={`Adicional de chuva (${detail.deal.rainBonusPercent}%)`} description="Soma o adicional ao valor das entregas deste turno." checked={rain} onCheckedChange={setRain} />
        )}
        <Field
          label="Ajuste (use - para descontar)"
          inputMode="text"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(signedCurrencyInput(event.target.value))}
        />
        <Field
          label="Motivo do ajuste"
          maxLength={200}
          autoComplete="off"
          value={note}
          error={noteMissing ? "Escreva o motivo do ajuste." : undefined}
          onChange={(event) => setNote(event.target.value)}
        />
        {needsDaily && <Field label="Diária combinada" inputMode="numeric" autoComplete="off" value={daily} onChange={(event) => setDaily(currencyInput(event.target.value))} />}
        {needsPerDelivery && (
          <Field label="Valor por entrega" inputMode="numeric" autoComplete="off" value={perDelivery} onChange={(event) => setPerDelivery(currencyInput(event.target.value))} />
        )}
      </div>
      {stale && (
        <div className="mt-4">
          <InlineError message="O acerto mudou enquanto você ajustava. Feche e revise os valores antes de salvar." />
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
        <Btn loading={busy} disabled={!changed || noteMissing || stale} onClick={() => void onSave(input, openedVersion)}>
          Salvar ajuste
        </Btn>
      </div>
    </>
  );
}

/** "Marcar como pago" (S9): o Motoka não paga; a loja paga por Pix fora do app. A nota é opcional (até 200). */
export function PaidDialog({ open, busy, error, onClose, onConfirm }: { open: boolean; busy: boolean; error: string | null; onClose: () => void; onConfirm: (note: string | null) => void | Promise<void> }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()} title="Marcar como pago" description="Use depois de pagar o motoboy por Pix, fora do app. O Motoka não movimenta dinheiro: aqui só fica o registro.">
      {open && <PaidForm busy={busy} error={error} onClose={onClose} onConfirm={onConfirm} />}
    </Dialog>
  );
}

function PaidForm({ busy, error, onClose, onConfirm }: { busy: boolean; error: string | null; onClose: () => void; onConfirm: (note: string | null) => void | Promise<void> }) {
  const [note, setNote] = useState("");
  return (
    <>
      <div className="mt-5">
        <Field label="Observação (opcional)" maxLength={200} autoComplete="off" value={note} onChange={(event) => setNote(event.target.value)} />
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
        <Btn loading={busy} onClick={() => void onConfirm(note.trim() || null)}>
          Marcar como pago
        </Btn>
      </div>
    </>
  );
}
