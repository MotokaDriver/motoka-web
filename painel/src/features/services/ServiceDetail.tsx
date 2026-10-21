"use client";

import { Tabs } from "@base-ui/react/tabs";
import { useState } from "react";
import { useSession } from "@/features/session/useSession";
import { formatMoney } from "@/features/team/model";
import { Btn } from "@/ui/Btn";
import { Chip } from "@/ui/Chip";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { InlineError } from "@/ui/InlineError";
import { Spinner } from "@/ui/Spinner";
import { cancelOrder } from "./api";
import { useNegotiations, useOrderDrivers, useServiceAction } from "./hooks";
import {
  CANCEL_NOTICE,
  REFUND_NOTE,
  STATUS_LABEL,
  STATUS_TONE,
  TYPE_LABEL,
  cancelRule,
  cancellationReasonLabel,
  formatDate,
  formatTime,
  isClosed,
  orderPayout,
  payoutLabel,
} from "./logic";
import type { Order } from "./model";
import { NegotiationCard } from "./Negotiation";
import { PayPanel } from "./PayPanel";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="type-body-sm text-text-secondary">{label}</dt>
      <dd className="type-body-md text-right font-semibold text-text-primary">{value}</dd>
    </div>
  );
}

const TAB = "type-label-md min-h-10 flex-1 cursor-pointer border-b-2 border-transparent px-3 font-semibold text-text-secondary data-[selected]:border-primary data-[selected]:text-primary-text";

function Accepted({ orderId }: { orderId: string }) {
  const drivers = useOrderDrivers(orderId, true);
  if (drivers.isPending) return <Spinner size={20} label="Carregando os motoboys" />;
  if (drivers.isError) return <InlineError message="Não foi possível carregar os motoboys deste serviço." onRetry={() => void drivers.refetch()} />;
  if (drivers.data.length === 0) return <p className="type-body-sm text-text-tertiary">Nenhum motoboy aceito ainda.</p>;
  return (
    <ul aria-label="Motoboys aceitos" className="flex flex-col gap-2">
      {drivers.data.map((driver) => {
        const agreed = driver.agreedValue || driver.agreedValuePerDelivery ? payoutLabel(driver.agreedValue, driver.agreedValuePerDelivery) : null;
        return (
          <li key={driver.id} className="rounded-lg border border-border p-3">
            <p className="type-body-md font-semibold text-text-primary">{driver.fullName || "Motoboy"}</p>
            {driver.rating !== null && <p className="type-caption text-text-tertiary">{`Nota ${driver.rating.toFixed(1).replace(".", ",")}`}</p>}
            {agreed && <p className="type-body-sm mt-1 text-text-secondary">{`Valor acordado: ${agreed}`}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function Proposals({ order, highlight }: { order: Order; highlight: string | null }) {
  const negotiations = useNegotiations(order.id, true);
  if (negotiations.isPending) return <Spinner size={20} label="Carregando as propostas" />;
  if (negotiations.isError) return <InlineError message="Não foi possível carregar as propostas." onRetry={() => void negotiations.refetch()} />;
  // Como no app: as pendentes, mais a que veio do aviso (mesmo já respondida).
  const shown = negotiations.data.filter((n) => !isClosed(n) || n.id === highlight);
  if (shown.length === 0) return <p className="type-body-sm text-text-tertiary">Quando motoboys enviarem contrapropostas, elas aparecem aqui.</p>;
  return (
    <ul aria-label="Propostas" className="flex flex-col gap-2.5">
      {shown.map((n) => (
        <NegotiationCard key={n.id} order={order} negotiation={n} highlighted={n.id === highlight} />
      ))}
    </ul>
  );
}

/** O serviço aberto: dados, equipe (aceitos e propostas), cancelamento e pagamento da taxa. */
export function ServiceDetail({ order, onGone, highlightNegotiation = null }: { order: Order; onGone: () => void; highlightNegotiation?: string | null }) {
  const session = useSession();
  const action = useServiceAction();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const userId = session.status === "authenticated" ? session.user.id : "";
  const now = new Date();
  const rule = cancelRule(order, now);
  const reason = order.status === "cancelled" ? cancellationReasonLabel(order.cancellationReason) : null;
  const open = order.status !== "cancelled" && order.status !== "finished";
  const showNegotiation = order.status === "waiting_for_drivers" || order.status === "pending_service_start" || order.status === "service_started";
  // A API ainda não estorna a taxa ao cancelar um serviço já pago: avisa antes, sem repetir a falha calado.
  const refundNote = order.status !== "pending_payment" && Number(order.internalFee) > 0;
  const needsPayment = order.status === "pending_payment" && Number(order.internalFee) > 0;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="type-title-lg font-bold text-text-primary">Detalhes do serviço</h2>
        <Chip tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Chip>
      </div>
      {reason && <p className="type-body-sm text-text-secondary">{`Motivo: ${reason}`}</p>}

      <dl className="flex flex-col gap-2">
        <Row label="Período" value={`${formatDate(order.startDate)} - ${formatDate(order.endDate)}`} />
        <Row label="Horário" value={`${formatTime(order.startDate)} - ${formatTime(order.endDate)}`} />
        <Row label="Tipo" value={TYPE_LABEL[order.type]} />
        <Row label="Valor por motoboy" value={orderPayout(order)} />
        {order.rainBonusPercent !== null && <Row label="Adicional de chuva" value={`${order.rainBonusPercent}%`} />}
        <Row label="Taxa de serviço" value={Number(order.internalFee) > 0 ? (formatMoney(order.internalFee) ?? "") : "Isento"} />
      </dl>

      <div className="rounded-lg border border-success/40 bg-success/10 p-3.5">
        <p className="type-title-md font-bold text-text-primary">{`${order.assignedDrivers}/${order.requestedDrivers} ${order.requestedDrivers === 1 ? "motoboy" : "motoboys"}`}</p>
        <p className="type-body-sm text-text-secondary">{order.assignedDrivers >= order.requestedDrivers ? "Equipe completa!" : "Aguardando motoboys"}</p>
      </div>

      {needsPayment && userId !== "" && <PayPanel orderId={order.id} userId={userId} fee={order.internalFee} startDate={order.startDate} />}

      {showNegotiation && (
        <Tabs.Root defaultValue={highlightNegotiation ? "propostas" : "aceitos"}>
          <Tabs.List className="flex border-b border-border" aria-label="Motoboys do serviço">
            <Tabs.Tab value="aceitos" className={TAB}>
              Aceitos
            </Tabs.Tab>
            <Tabs.Tab value="propostas" className={TAB}>
              Propostas
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="aceitos" className="pt-3">
            <Accepted orderId={order.id} />
          </Tabs.Panel>
          <Tabs.Panel value="propostas" className="pt-3">
            <Proposals order={order} highlight={highlightNegotiation} />
          </Tabs.Panel>
        </Tabs.Root>
      )}

      {open && (
        <div className="flex flex-col gap-2">
          {rule.canCancel ? (
            <>
              <Btn
                kind="danger"
                loading={action.busy}
                onClick={() =>
                  setConfirm({
                    title: "Cancelar serviço",
                    description: refundNote ? `Tem certeza que deseja cancelar este serviço? Essa ação não pode ser desfeita. ${REFUND_NOTE}` : "Tem certeza que deseja cancelar este serviço? Essa ação não pode ser desfeita.",
                    confirmLabel: "Cancelar serviço",
                    cancelLabel: "Voltar",
                    danger: true,
                    onConfirm: () => void action.run(() => cancelOrder(order.id), { success: "Serviço cancelado.", orderId: order.id }).then((r) => r.ok && onGone()),
                  })
                }
              >
                Cancelar serviço
              </Btn>
              <p className="type-caption text-text-tertiary">{CANCEL_NOTICE}</p>
            </>
          ) : rule.reason ? (
            <p className="type-body-sm text-text-secondary">{rule.reason}</p>
          ) : null}
          {action.error && <InlineError message={action.error} />}
        </div>
      )}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
