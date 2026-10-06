"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DELIVERY_ERROR_OVERRIDES } from "@/features/deliveries/logic";
import { ORIGIN_INFO } from "@/features/deliveries/model";
import { useDeliveryAction } from "@/features/deliveries/hooks";
import { SourceBadge } from "@/features/deliveries/SourceBadge";
import { Paths } from "@/lib/routing/routes";
import { Btn } from "@/ui/Btn";
import { Chip } from "@/ui/Chip";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { Dialog } from "@/ui/Dialog";
import { InlineError } from "@/ui/InlineError";
import { acceptDelivery, rejectDelivery } from "./api";
import { canAccept, clock, secondsLeft, type Awaiting, type AwaitingItem } from "./model";

/** Drawer com as ações de cada pedido esperando o aceite. Carrega sob demanda: o banner fica no shell de toda tela. */
export default function AcceptanceDrawer({ open, onOpenChange, data, now }: { open: boolean; onOpenChange: (open: boolean) => void; data: Awaiting; now: number }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} variant="right" size="md" title="Pedidos esperando o aceite" description="Sem resposta até o fim da contagem, o Motoka recusa o pedido e o sistema de origem é avisado.">
      <ul aria-label="Pedidos esperando o aceite" className="mt-4 flex flex-col gap-3">
        {data.items.map((item) => (
          <AwaitingCard key={item.id} item={item} data={data} now={now} onDone={() => onOpenChange(false)} />
        ))}
      </ul>
    </Dialog>
  );
}

function AwaitingCard({ item, data, now, onDone }: { item: AwaitingItem; data: Awaiting; now: number; onDone: () => void }) {
  const router = useRouter();
  const action = useDeliveryAction(DELIVERY_ERROR_OVERRIDES);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const left = secondsLeft(item.acceptDeadlineAt, data.offsetMs, now);
  const expired = left === 0;
  const origin = ORIGIN_INFO[item.origin].label;
  const preview = item.previewedDriver;
  const free = preview ? data.teamNow.find((member) => member.id === preview.id)?.freeInMinutes : null;
  const accept = canAccept(item);

  const run = async (kind: "accept" | "accept_reinforce") => {
    const ok = await action.run(item.id, "accept", (id) => acceptDelivery(item.id, id), `Pedido #${item.number} aceito.`);
    if (ok && kind === "accept_reinforce") {
      onDone();
      router.push(Paths.newService);
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-title-md font-bold text-text-primary">{`Pedido #${item.number}`}</span>
        <SourceBadge origin={item.origin} channel={item.channel} />
        {left !== null && (
          <span className="ml-auto">
            <Chip tone={expired ? "error" : left <= 30 ? "error" : "warning"} icon="schedule">
              {expired ? "Prazo acabou" : clock(left)}
            </Chip>
          </span>
        )}
      </div>
      <div>
        <p className="type-body-md font-semibold text-text-primary">{item.customerName ?? "Cliente sem nome"}</p>
        {item.addressLine && <p className="type-body-sm text-text-tertiary">{[item.addressLine, item.neighborhood].filter(Boolean).join(" · ")}</p>}
      </div>
      <p className="type-body-sm text-text-secondary">
        {preview
          ? `${preview.shortName} é o motoboy previsto${typeof free === "number" ? (free <= 0 ? ", livre agora." : `, livre em ${free} min.`) : "."}`
          : item.situation === "empty"
            ? "Ninguém em turno agora: só dá para recusar."
            : "Nenhum motoboy previsto agora."}
      </p>
      {expired ? (
        <p role="status" className="type-body-sm font-semibold text-text-secondary">Recusando…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {accept && preview && (
            <>
              <Btn loading={action.busy} onClick={() => void run("accept")}>
                {`Aceitar · ${preview.shortName} leva`}
              </Btn>
              <Btn kind="secondary" disabled={action.busy} onClick={() => void run("accept_reinforce")}>
                Aceitar e chamar reforço
              </Btn>
            </>
          )}
          <Btn
            kind="danger"
            disabled={action.busy}
            onClick={() =>
              setConfirm({
                title: `Recusar o pedido #${item.number}?`,
                description: `O ${origin} será avisado e pode oferecer o pedido para outra logística.`,
                confirmLabel: "Recusar",
                danger: true,
                onConfirm: () => void action.run(item.id, "reject", (id) => rejectDelivery(item.id, id), `Pedido #${item.number} recusado. O ${origin} foi avisado.`),
              })
            }
          >
            Recusar
          </Btn>
        </div>
      )}
      {action.error && <InlineError message={action.error} />}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </li>
  );
}
