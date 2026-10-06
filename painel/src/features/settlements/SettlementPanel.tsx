"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMoney, entityColor } from "@/features/team/model";
import { Paths } from "@/lib/routing/routes";
import { spDay, spTime } from "@/lib/time/saoPaulo";
import { Avatar } from "@/ui/Avatar";
import { Btn } from "@/ui/Btn";
import { Chip } from "@/ui/Chip";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { Icon } from "@/ui/Icon";
import { InlineError } from "@/ui/InlineError";
import { Label } from "@/ui/Label";
import { useToast } from "@/ui/Toast";
import { adjustSettlement, confirmSettlement, markSettlementPaid } from "./api";
import { AdjustDialog, PaidDialog } from "./Dialogs";
import { useSettlementAction } from "./hooks";
import { HISTORY_LABEL, RETURN_REASON, STATUS_LABEL, actionsFor, pendingReason } from "./logic";
import type { SettlementDetail } from "./model";

/** Valor do servidor: só ganha "R$" e vírgula. Nulo é "A definir" (combinado incompleto). */
const money = (value: string | null): string => (value === null ? "A definir" : (formatMoney(value) ?? "A definir"));

const PIX_TYPE: Record<string, string> = { cpf: "CPF", cnpj: "CNPJ", phone: "Celular", email: "E-mail", random: "Chave aleatória" };

const dayText = (iso: string): string => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export const D18_NOTE = "O Motoka registra e confere o acerto, mas não movimenta dinheiro. Você paga o motoboy por Pix, fora do app, e depois marca como pago aqui.";

/** Painel do acerto (S6): valores do servidor, linhas, histórico e as ações do estado. */
export function SettlementPanel({ detail }: { detail: SettlementDetail }) {
  const action = useSettlementAction();
  const [dialog, setDialog] = useState<"adjust" | "paid" | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const status = STATUS_LABEL[detail.status];
  const acts = actionsFor(detail);
  const id = detail.id;
  const driver = detail.driver;
  const disputeNote = detail.status === "disputed" ? [...detail.history].reverse().find((h) => h.action === "disputed")?.note : null;

  const excludedIds = detail.excluded.map((e) => e.deliveryId);
  const setExcluded = (next: string[], success: string) =>
    void action.run(id, () => adjustSettlement(id, { version: detail.version, excludedDeliveryIds: next }), success);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1.5 px-5 pb-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Label>Acerto</Label>
          <Chip tone={status.tone}>{status.label}</Chip>
          {detail.kind === "supplement" && <Chip>Complementar</Chip>}
        </div>
        <div className="flex items-center gap-2.5">
          {driver && <Avatar initials={driver.initials} color={entityColor(driver.id)} size={34} />}
          <div className="min-w-0">
            <h2 className="type-title-lg truncate font-bold text-text-primary">{driver?.fullName ?? "Motoboy"}</h2>
            <p className="type-body-sm text-text-tertiary">
              {dayText(detail.occurrenceDate)}
              {detail.scheduled ? ` · turno ${detail.scheduled.start}–${detail.scheduled.end}` : ""}
            </p>
          </div>
        </div>
        {detail.startedAt && detail.endedAt && (
          <p className="type-caption text-text-tertiary">{`Online de ${spTime(new Date(detail.startedAt))} às ${spTime(new Date(detail.endedAt))} (${spDay(new Date(detail.startedAt)).slice(8)}/${spDay(new Date(detail.startedAt)).slice(5, 7)})`}</p>
        )}
      </div>

      {disputeNote && (
        <div role="alert" className="mx-5 mb-3 flex gap-2.5 rounded-md border border-error/40 bg-error/10 p-3">
          <span className="text-error">
            <Icon name="report" size={20} />
          </span>
          <p className="type-body-sm text-pretty text-text-secondary">{`O motoboy contestou: ${disputeNote}`}</p>
        </div>
      )}
      {detail.confirmedOverDispute && <p className="type-caption mx-5 mb-3 text-text-tertiary">Confirmado mesmo com a contestação do motoboy. O Motoka não arbitra: a contestação fica no histórico.</p>}

      <div className="flex flex-col gap-5 px-5 pb-6">
        <section className="flex flex-col gap-2" aria-label="Valores do acerto">
          <Label as="h3">Valores</Label>
          <dl className="flex flex-col gap-1.5">
            <Row label="Diária" value={money(detail.daily)} />
            <Row label={`Entregas (${detail.deliveries.count}${detail.deliveries.unit ? ` × ${money(detail.deliveries.unit)}` : ""})`} value={money(detail.deliveries.amount)} />
            <Row label={`Retornos (${detail.returns.count}${detail.returns.unit ? ` × ${money(detail.returns.unit)}` : ""})`} value={money(detail.returns.amount)} />
            <Row label="Subtotal" value={money(detail.subtotal)} />
            {detail.rain.percent !== null && <Row label={`Adicional de chuva (${detail.rain.percent}%)${detail.rain.applied ? "" : " · não aplicado"}`} value={money(detail.rain.amount)} />}
            <Row label={`Ajuste${detail.adjustment.note ? ` · ${detail.adjustment.note}` : ""}`} value={money(detail.adjustment.amount)} />
            <div className="mt-1 flex items-baseline justify-between border-t border-divider pt-2.5">
              <dt className="type-title-sm font-bold text-text-primary">Total a pagar</dt>
              <dd data-testid="settlement-total" className="type-title-lg font-bold text-text-primary">
                {money(detail.total)}
              </dd>
            </div>
          </dl>
          {detail.dealIncomplete && <p className="type-caption text-warning">O combinado deste turno não tem todos os valores. Informe-os em Ajustar acerto.</p>}
          {detail.returns.count > 0 && <p className="type-caption text-text-tertiary">Retornos: pedido que voltou para a loja depois da retirada.</p>}
        </section>

        {detail.excluded.length > 0 && (
          <section className="flex flex-col gap-2" aria-label="Entregas retiradas do acerto">
            <Label as="h3">Retiradas do acerto</Label>
            <ul className="flex flex-col gap-1.5">
              {detail.excluded.map((e) => (
                <li key={e.deliveryId} className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
                  <span className="type-body-sm min-w-0 flex-1 text-text-secondary">{`#${e.number} · fora deste acerto`}</span>
                  {acts.canAdjust && (
                    <button
                      type="button"
                      disabled={action.busy}
                      onClick={() =>
                        setExcluded(
                          excludedIds.filter((x) => x !== e.deliveryId),
                          `#${e.number} voltou para o acerto.`,
                        )
                      }
                      className="type-label-md min-h-9 cursor-pointer rounded-sm px-2 font-semibold text-primary-text hover:underline disabled:opacity-60"
                    >
                      Desfazer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-2" aria-label="Linhas do acerto">
          <Label as="h3">Entregas e retornos</Label>
          {detail.lines.length === 0 ? (
            <p className="type-body-sm text-text-tertiary">Nenhuma entrega neste turno.</p>
          ) : (
            <ul className="flex flex-col">
              {detail.lines.map((line) => {
                const pending = line.kind === "pending";
                const blocked = action.blocked.find((b) => b.deliveryId === line.deliveryId);
                const reason = pending ? (detail.pending.find((p) => p.deliveryId === line.deliveryId)?.reason ?? line.reason ?? "") : (line.reason ?? "");
                return (
                  <li key={line.deliveryId} className="flex flex-col gap-1 border-b border-divider py-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="type-body-md font-semibold text-text-primary">{`#${line.number}`}</span>
                      <span className="type-caption min-w-0 flex-1 truncate text-text-tertiary">
                        {line.kind === "return" ? `Retorno · ${RETURN_REASON[reason] ?? "voltou para a loja"}` : pending ? "Sem desfecho" : "Entrega"}
                        {line.addressLine ? ` · ${line.addressLine}` : ""}
                      </span>
                      <span className="type-body-sm font-semibold text-text-primary">{pending ? "—" : money(line.amount)}</span>
                    </div>
                    {pending && (
                      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${blocked ? "text-error" : "text-warning"}`}>
                        <span className="type-caption">{`Ainda não conta: ${pendingReason(reason)}.`}</span>
                        <Link href={`${Paths.deliveries}?pedido=${line.deliveryId}`} className="type-caption font-semibold text-primary-text hover:underline">
                          Abrir pedido
                        </Link>
                        {reason === "return_receipt" && acts.canAdjust && (
                          <button
                            type="button"
                            disabled={action.busy}
                            onClick={() => setExcluded([...excludedIds, line.deliveryId], `#${line.number} saiu do acerto.`)}
                            className="type-caption cursor-pointer font-semibold text-primary-text hover:underline disabled:opacity-60"
                          >
                            Retirar do acerto
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {(detail.status === "confirmed" || detail.status === "paid") && <PixSection detail={detail} />}

        <section className="flex flex-col gap-2" aria-label="Histórico">
          <Label as="h3">Histórico</Label>
          <ol className="flex flex-col gap-1.5">
            {detail.history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="type-body-sm text-text-secondary">
                <span className="type-caption text-text-tertiary">{`${spDay(new Date(h.at)).slice(8)}/${spDay(new Date(h.at)).slice(5, 7)} ${spTime(new Date(h.at))} · `}</span>
                {HISTORY_LABEL[h.action] ?? "Atualização"}
                {h.note ? <span className="text-text-tertiary">{`: ${h.note}`}</span> : null}
              </li>
            ))}
          </ol>
        </section>

        {detail.status === "paid" && <p className="type-body-sm text-success">{`Pago${detail.paidAt ? ` em ${dayText(spDay(new Date(detail.paidAt)))}` : ""}${detail.paidNote ? ` · ${detail.paidNote}` : ""}.`}</p>}

        {action.error && <InlineError message={action.error} />}
        {acts.hint && <p className="type-caption text-text-tertiary">{acts.hint}</p>}
        {(acts.canConfirm || acts.canAdjust || acts.canPay || acts.hint) && (
          <div className="flex flex-col gap-2">
            {acts.canConfirm || detail.status === "pending_driver" || detail.status === "pending_store" || detail.status === "disputed" ? (
              <Btn
                disabled={!acts.canConfirm || action.busy}
                onClick={() =>
                  setConfirm({
                    title: `Confirmar o acerto de ${money(detail.total)}?`,
                    description: `Depois de confirmado, o acerto não muda mais. ${D18_NOTE}`,
                    confirmLabel: "Confirmar acerto",
                    onConfirm: () => void action.run(id, () => confirmSettlement(id, detail.version, detail.total), "Acerto confirmado."),
                  })
                }
              >
                {acts.confirmLabel}
              </Btn>
            ) : null}
            {acts.canAdjust && (
              <Btn
                kind="secondary"
                disabled={action.busy}
                onClick={() => {
                  action.reset();
                  setDialog("adjust");
                }}
              >
                Ajustar acerto
              </Btn>
            )}
            {acts.canPay && (
              <Btn
                icon="check"
                disabled={action.busy}
                onClick={() => {
                  action.reset();
                  setDialog("paid");
                }}
              >
                Marcar como pago
              </Btn>
            )}
          </div>
        )}
        <p className="type-caption text-pretty text-text-tertiary">{D18_NOTE}</p>
      </div>

      <AdjustDialog
        open={dialog === "adjust"}
        detail={detail}
        busy={action.busy}
        error={action.error}
        onClose={() => setDialog(null)}
        onSave={async (input, version) => {
          if (await action.run(id, () => adjustSettlement(id, { version, ...input }), "Ajuste salvo.")) setDialog(null);
        }}
      />
      <PaidDialog
        open={dialog === "paid"}
        busy={action.busy}
        error={action.error}
        onClose={() => setDialog(null)}
        onConfirm={async (note) => {
          if (await action.run(id, () => markSettlementPaid(id, note), "Acerto marcado como pago.")) setDialog(null);
        }}
      />
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="type-body-sm text-text-secondary">{label}</dt>
      <dd className="type-body-md font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

/**
 * Chave Pix do motoboy (só `confirmed`/`paid`). O valor inteiro só vem se ele ainda é da equipe; senão, só a
 * máscara. Nunca vai para log, toast ou storage; copiar usa a área de transferência e nada mais.
 */
function PixSection({ detail }: { detail: SettlementDetail }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const key = detail.payoutKey;
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
      toast({ title: "Chave Pix copiada." });
    } catch {
      toast({ title: "Não foi possível copiar. Selecione a chave e copie." });
    }
  };
  return (
    <section className="flex flex-col gap-2" aria-label="Chave Pix do motoboy">
      <Label as="h3">Chave Pix do motoboy</Label>
      {!key ? (
        <p className="type-body-sm text-text-tertiary">O motoboy ainda não cadastrou a chave Pix. Combine o pagamento com ele.</p>
      ) : key.value ? (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 rounded-md border border-border bg-surface-variant px-3 py-2.5">
            <span className="type-caption block text-text-tertiary">{PIX_TYPE[key.type] ?? "Chave"}</span>
            <span data-testid="pix-key" className="type-body-md block select-all break-all font-mono text-text-primary">
              {key.value}
            </span>
          </div>
          <Btn kind="secondary" icon={copied ? "check" : "content_copy"} onClick={() => void copy(key.value as string)}>
            {copied ? "Copiada" : "Copiar"}
          </Btn>
        </div>
      ) : (
        <p className="type-body-sm text-text-tertiary">{`${key.masked}. Combine o pagamento com o motoboy (ele não está mais ativo na sua equipe).`}</p>
      )}
    </section>
  );
}
