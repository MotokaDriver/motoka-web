"use client";

import { useState } from "react";
import { currencyInput, currencyToDecimal, formatMoney } from "@/features/team/model";
import { Btn } from "@/ui/Btn";
import { Chip } from "@/ui/Chip";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { Dialog } from "@/ui/Dialog";
import { Field } from "@/ui/Field";
import { RadioRow } from "@/ui/RadioRow";
import { InlineError } from "@/ui/InlineError";
import { acceptNegotiation, offerNegotiation, rejectNegotiation } from "./api";
import { useServiceAction } from "./hooks";
import { NEGOTIATION_LABEL, OFFER_LABEL, OFFER_TONE, authorLabel, diffLabel, isClosed, latestOffer, offerDiffPercent, turnOf } from "./logic";
import type { Negotiation, Offer, Order } from "./model";

function offerAmount(offer: Offer): string {
  const fixed = offer.value !== null && Number(offer.value) > 0 ? formatMoney(offer.value) : null;
  const each = offer.valuePerDelivery !== null && Number(offer.valuePerDelivery) > 0 ? formatMoney(offer.valuePerDelivery) : null;
  if (fixed && each) return `${fixed} + ${each}/entrega`;
  return fixed ?? (each ? `${each}/entrega` : formatMoney("0.00") ?? "");
}

/** Histórico da conversa, em ordem cronológica. A última oferta fica em destaque. */
function Thread({ negotiation }: { negotiation: Negotiation }) {
  const closed = isClosed(negotiation);
  const sorted = [...negotiation.offers].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const last = latestOffer(negotiation);
  return (
    <ol className="flex flex-col gap-1.5" aria-label="Histórico da proposta">
      {sorted.map((offer) => {
        // Negociação encerrada com oferta ainda "pendente" (legado): mostra o desfecho da negociação.
        const legacy = closed && offer.status === "pending";
        return (
          <li key={offer.id} className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 ${offer === last ? "bg-surface-variant" : ""}`}>
            <span className="type-body-sm min-w-0 text-text-secondary">
              <span className="font-semibold text-text-primary">{authorLabel(offer.createdBy)}</span>
              {` · ${offerAmount(offer)}`}
            </span>
            {legacy ? (
              <Chip tone={negotiation.status === "accepted" ? "success" : negotiation.status === "rejected" ? "error" : "neutral"}>{NEGOTIATION_LABEL[negotiation.status] ?? "Encerrada"}</Chip>
            ) : (
              <Chip tone={OFFER_TONE[offer.status]}>{OFFER_LABEL[offer.status]}</Chip>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Contraproposta (`negotiation_offer_sheet`): fixo, ou fixo + por entrega; valores sempre maiores que zero. */
function OfferDialog({ open, negotiation, busy, error, onClose, onSend }: { open: boolean; negotiation: Negotiation; busy: boolean; error: string | null; onClose: () => void; onSend: (value: string, perDelivery: string | null) => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()} title="Fazer contraproposta" description="O motoboy recebe a sua proposta e pode aceitar, recusar ou responder.">
      {open && <OfferForm negotiation={negotiation} busy={busy} error={error} onClose={onClose} onSend={onSend} />}
    </Dialog>
  );
}

function OfferForm({ negotiation, busy, error, onClose, onSend }: { negotiation: Negotiation; busy: boolean; error: string | null; onClose: () => void; onSend: (value: string, perDelivery: string | null) => void }) {
  const last = latestOffer(negotiation);
  const [withBonus, setWithBonus] = useState(last?.valuePerDelivery !== null && last?.valuePerDelivery !== undefined && Number(last.valuePerDelivery) > 0);
  const [fixed, setFixed] = useState(() => (last?.value ? currencyInput(last.value.replace(".", "")) : ""));
  const [each, setEach] = useState(() => (last?.valuePerDelivery && Number(last.valuePerDelivery) > 0 ? currencyInput(last.valuePerDelivery.replace(".", "")) : ""));
  const [touched, setTouched] = useState(false);

  const fixedDecimal = currencyToDecimal(fixed);
  const eachDecimal = currencyToDecimal(each);
  const fixedError = fixedDecimal === null || Number(fixedDecimal) <= 0 ? "Informe um valor fixo válido." : undefined;
  const eachError = withBonus && (eachDecimal === null || Number(eachDecimal) <= 0) ? "Informe um valor por entrega válido." : undefined;

  return (
    <>
      <div className="mt-5 flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="type-label-md mb-1 text-text-secondary">Tipo de cobrança</legend>
          <RadioRow name="offer-kind" checked={!withBonus} onChange={() => setWithBonus(false)} label="Valor fixo" hint="O valor fixo é pago pelo período completo, independente do número de entregas." />
          <RadioRow name="offer-kind" checked={withBonus} onChange={() => setWithBonus(true)} label="Fixo + taxa por entrega" hint="O valor fixo, mais um adicional por cada entrega feita no período." />
        </fieldset>
        <Field label="Valor fixo" inputMode="numeric" autoComplete="off" value={fixed} error={touched ? fixedError : undefined} onChange={(event) => setFixed(currencyInput(event.target.value))} />
        {withBonus && <Field label="Valor por entrega" inputMode="numeric" autoComplete="off" value={each} error={touched ? eachError : undefined} onChange={(event) => setEach(currencyInput(event.target.value))} />}
      </div>
      {error && (
        <div className="mt-4">
          <InlineError message={error} />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Btn kind="secondary" disabled={busy} onClick={onClose}>
          Cancelar
        </Btn>
        <Btn
          loading={busy}
          onClick={() => {
            setTouched(true);
            if (fixedError || eachError || fixedDecimal === null) return;
            onSend(fixedDecimal, withBonus ? eachDecimal : null);
          }}
        >
          Enviar proposta
        </Btn>
      </div>
    </>
  );
}

/**
 * Uma proposta de motoboy: histórico, diferença contra o valor anunciado e as ações. A loja só age quando a última
 * oferta, pendente, é do motoboy; quem inicia ou cancela a negociação é o motoboy, não a loja.
 */
export function NegotiationCard({ order, negotiation, highlighted }: { order: Order; negotiation: Negotiation; highlighted?: boolean }) {
  const action = useServiceAction();
  const [offering, setOffering] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const turn = turnOf(negotiation);
  const last = latestOffer(negotiation);
  const diff = offerDiffPercent(last?.value ?? null, order.value);
  const name = negotiation.driver?.fullName || "Motoboy";

  const run = async (call: () => Promise<unknown>, success: string) => {
    const result = await action.run(call, { success, orderId: order.id });
    return result.ok;
  };

  return (
    <li className={`flex flex-col gap-3 rounded-lg border p-3.5 ${highlighted ? "border-primary" : "border-border"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="type-body-md truncate font-semibold text-text-primary">{name}</p>
          {negotiation.driver?.rating != null && <p className="type-caption text-text-tertiary">{`Nota ${negotiation.driver.rating.toFixed(1).replace(".", ",")}`}</p>}
        </div>
        {order.value !== null && Number(order.value) > 0 && <Chip tone={diff > 0 ? "error" : "success"}>{`${diffLabel(diff)} do anunciado`}</Chip>}
      </div>
      <Thread negotiation={negotiation} />
      {turn.kind === "act" ? (
        <div className="flex flex-wrap gap-2">
          <Btn
            kind="danger"
            disabled={action.busy}
            onClick={() =>
              setConfirm({
                title: "Recusar proposta",
                description: `Recusar a proposta de ${name}? O motoboy será avisado.`,
                confirmLabel: "Recusar",
                danger: true,
                onConfirm: () => void run(() => rejectNegotiation(order.id, negotiation.id), "Proposta recusada."),
              })
            }
          >
            Recusar
          </Btn>
          <Btn kind="secondary" disabled={action.busy} onClick={() => setOffering(true)}>
            Fazer contraproposta
          </Btn>
          <Btn loading={action.busy} onClick={() => void run(() => acceptNegotiation(order.id, negotiation.id), "Proposta aceita.")}>
            Aceitar
          </Btn>
        </div>
      ) : (
        <p className="type-body-sm text-text-secondary">{turn.text}</p>
      )}
      {action.error && !offering && <InlineError message={action.error} />}
      <OfferDialog
        open={offering}
        negotiation={negotiation}
        busy={action.busy}
        error={action.error}
        onClose={() => {
          setOffering(false);
          action.reset();
        }}
        onSend={(value, perDelivery) => void run(() => offerNegotiation(order.id, negotiation.id, { value, valuePerDelivery: perDelivery }), "Contraproposta enviada.").then((ok) => ok && setOffering(false))}
      />
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </li>
  );
}
