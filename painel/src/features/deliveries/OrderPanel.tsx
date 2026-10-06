"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { fetchOnShift } from "@/features/team/api";
import { teamKeys } from "@/features/team/hooks";
import { currencyInput, currencyToDecimal, formatMoney, formatPhone, entityColor } from "@/features/team/model";
import { whatsappLink } from "@/lib/links/links";
import { checkedOwnUrl } from "@/lib/links/ownUrl";
import { Paths } from "@/lib/routing/routes";
import { spTime } from "@/lib/time/saoPaulo";
import { Avatar } from "@/ui/Avatar";
import { Btn } from "@/ui/Btn";
import { Chip } from "@/ui/Chip";
import { Field } from "@/ui/Field";
import { Icon } from "@/ui/Icon";
import { InlineError } from "@/ui/InlineError";
import { Label } from "@/ui/Label";
import { SelectField } from "@/ui/SelectField";
import { cn } from "@/ui/cn";
import {
  afterCancelAck,
  assignDriver,
  cancelDelivery,
  confirmDelivery,
  confirmReturn,
  markReady,
  retryDelivery,
  trackingLinkSent,
  unassignDriver,
  updateAddress,
} from "./api";
import { AddressDialog, CancelDialog, ConfirmDeliveryDialog } from "./OrderDialogs";
import { SourceBadge } from "./SourceBadge";
import { useDeliveryAction, deliveryKeys } from "./hooks";
import { SHIFT_NOT_STARTED_NOTE, DELIVERY_ERROR_OVERRIDES, addressText, availableActions, canWhatsApp, deliveryAlerts, needsAfterCancel, trackingMessage, type ActionId } from "./logic";
import { ORIGIN_INFO, STATUS, paymentLabel, pinHint, type DeliveryDetail, type DeliveryEvent } from "./model";

const time = (iso: string): string => spTime(new Date(iso));

const EVENT_LABEL: Record<string, string> = {
  created: "Pedido criado",
  accepted: "Aceito",
  rejected: "Recusado",
  driver_assigned: "Motoboy atribuído",
  driver_unassigned: "Motoboy removido",
  ready: "Pronto para retirar",
  driver_at_store: "Motoboy na loja",
  picked_up: "Retirado",
  on_the_way: "A caminho",
  arrived: "Chegou ao destino",
  code_failed: "Código incorreto",
  code_locked: "Código bloqueado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

function eventLabel(e: DeliveryEvent): string {
  return EVENT_LABEL[e.type] ?? (e.toStatus && e.toStatus !== "unknown" ? STATUS[e.toStatus].label : "Atualização");
}

/** Painel do pedido selecionado (380 px): alertas, motoboy, pagamento, código, rastreio, histórico e ações. */
export function OrderPanel({ detail, storeName, now }: { detail: DeliveryDetail; storeName: string; now: Date }) {
  const info = ORIGIN_INFO[detail.origin];
  const status = STATUS[detail.status];
  const alerts = deliveryAlerts(detail, time);
  const bar = availableActions(detail);
  const action = useDeliveryAction(DELIVERY_ERROR_OVERRIDES);
  const [dialog, setDialog] = useState<"cancel" | "confirm" | "address" | null>(null);
  const id = detail.id;
  const closed = detail.status === "cancelled" || detail.status === "rejected";

  const runAction = (actionId: ActionId) => {
    switch (actionId) {
      case "ready":
        return void action.run(id, "ready", (a) => markReady(id, a), "Pedido marcado como pronto.");
      case "retry":
        return void action.run(id, "retry", (a) => retryDelivery(id, a), "Nova tentativa de entrega.");
      case "confirm_return":
        return void action.run(id, "confirm_return", (a) => confirmReturn(id, a), "Pedido de volta na loja.");
      case "cancel":
        action.reset();
        return setDialog("cancel");
      case "confirm_delivery":
        action.reset();
        return setDialog("confirm");
    }
  };

  const phone = detail.customerPhone ? formatPhone(detail.customerPhone) : "";
  const contact = phone || (detail.phoneLocalizer ? `via ${info.label} · localizador ${detail.phoneLocalizer}` : "");
  const address = addressText(detail);
  const readyIn = detail.estimatedReadyAt ? Math.round((Date.parse(detail.estimatedReadyAt) - now.getTime()) / 60_000) : null;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1.5 px-5 pb-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Label>{`Pedido #${detail.number}`}</Label>
          <SourceBadge origin={detail.origin} channel={detail.channel} />
          <Chip tone={status.tone}>{status.label}</Chip>
          {detail.cancellation && detail.status !== "cancelled" && <Chip tone="error">Cancelado</Chip>}
        </div>
        <h2 className="type-title-lg font-bold text-text-primary">{detail.customerName ?? "Cliente sem nome"}</h2>
        {(contact || address) && <p className="type-body-sm text-text-tertiary">{[contact, address].filter(Boolean).join(" · ")}</p>}
        {detail.externalDisplayId && (
          <p className="type-caption flex items-center gap-1.5 text-text-tertiary">
            <span className="text-success">
              <Icon name="sync" size={14} />
            </span>
            {detail.externalDisplayId}
          </p>
        )}
        {readyIn !== null && readyIn > 0 && detail.status === "preparing" && (
          <p className="type-caption text-text-tertiary">{`pronto em ~${readyIn} min`}</p>
        )}
      </div>

      {alerts.map((alert) => (
        <div key={alert.id} role="alert" className="mx-5 mb-3 flex gap-2.5 rounded-md border border-error/40 bg-error/10 p-3">
          <span className="text-error">
            <Icon name={alert.id === "cancelled" ? "cancel" : "report"} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="type-body-sm text-pretty text-text-secondary">{alert.text}</p>
            {alert.id === "geocode" && (detail.status === "preparing" || detail.status === "ready") && (
              <button
                type="button"
                onClick={() => {
                  action.reset();
                  setDialog("address");
                }}
                className="type-label-md mt-1.5 min-h-8 cursor-pointer font-semibold text-primary-text hover:underline"
              >
                Corrigir endereço
              </button>
            )}
          </div>
        </div>
      ))}

      {needsAfterCancel(detail) && <AfterCancelCard detail={detail} />}

      <div className="flex flex-col gap-5 p-5">
        <DriverSection detail={detail} />
        <Section label="Pagamento">
          <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface-variant px-3 py-2.5">
            <span className="text-text-tertiary">
              <Icon name="payments" size={18} />
            </span>
            <span className="type-body-md text-text-primary">{paymentLabel(detail.payment, detail.origin, formatMoney)}</span>
          </div>
          {detail.deliveryFee && <p className="type-caption text-text-tertiary">{`Taxa de entrega ${formatMoney(detail.deliveryFee)}`}</p>}
        </Section>
        {!closed && <CodeSection detail={detail} />}
        {!closed && <TrackingSection detail={detail} storeName={storeName} />}
        <Section label={detail.origin === "manual" ? "Histórico" : `Sincronização com ${info.label}`}>
          <ol className="flex flex-col">
            {detail.events.map((event, i) => {
              const last = i === detail.events.length - 1;
              const bad = event.toStatus === "cancelled" || event.toStatus === "problem";
              return (
                <li key={event.seq} className="grid grid-cols-[44px_14px_minmax(0,1fr)] items-start gap-2">
                  <span className="type-caption pt-px text-text-tertiary">{time(event.recordedAt)}</span>
                  <span className="flex flex-col items-center self-stretch">
                    <span aria-hidden className={cn("mt-1 size-2.5 rounded-full", bad ? "bg-error" : last ? "bg-info" : "bg-success")} />
                    {!last && <span aria-hidden className="min-h-3.5 w-0.5 flex-1 bg-border" />}
                  </span>
                  <span className={cn("type-body-sm pb-2.5 font-semibold", bad ? "text-error" : "text-text-primary")}>{eventLabel(event)}</span>
                </li>
              );
            })}
          </ol>
        </Section>

        {action.error && <InlineError message={action.error} />}
        {(bar.actions.length > 0 || bar.originNote) && (
          <div className="flex flex-col gap-2">
            {bar.actions.map((a) => (
              <Btn
                key={a.id}
                kind={a.danger ? "danger" : a.primary ? "primary" : "secondary"}
                icon={a.id === "confirm_return" ? "assignment_return" : a.id === "retry" ? "replay" : a.id === "cancel" ? "cancel" : "check"}
                disabled={action.busy}
                onClick={() => runAction(a.id)}
              >
                {a.label}
              </Btn>
            ))}
            {bar.originNote && <p className="type-caption text-text-tertiary">{bar.originNote}</p>}
          </div>
        )}
      </div>

      <CancelDialog
        open={dialog === "cancel"}
        number={detail.number}
        afterPickup={["picked_up", "on_the_way", "arrived", "problem"].includes(detail.status)}
        busy={action.busy}
        error={action.error}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          if (await action.run(id, "cancel", (a) => cancelDelivery(id, a, reason), `Pedido #${detail.number} cancelado.`)) setDialog(null);
        }}
      />
      <AddressDialog
        open={dialog === "address"}
        initial={{
          street: detail.address.street ?? "",
          number: detail.address.number ?? "",
          neighborhood: detail.address.neighborhood ?? "",
          city: detail.address.city ?? "",
          state: detail.address.state ?? "",
          zip: detail.address.zipCode ?? "",
          complement: detail.address.complement ?? "",
          reference: detail.address.reference ?? "",
        }}
        busy={action.busy}
        error={action.error}
        onClose={() => setDialog(null)}
        onConfirm={async (v) => {
          const ok = await action.run(
            id,
            "address",
            (a) =>
              updateAddress(id, a, {
                street: v.street,
                number: v.number,
                neighborhood: v.neighborhood.trim() || null,
                city: v.city,
                state: v.state,
                zipCode: v.zip.replace(/[^0-9]/g, "") || null,
                complement: v.complement.trim() || null,
                reference: v.reference.trim() || null,
              }),
            "Endereço corrigido.",
          );
          if (ok) setDialog(null);
        }}
      />
      <ConfirmDeliveryDialog
        open={dialog === "confirm"}
        busy={action.busy}
        error={action.error}
        onClose={() => setDialog(null)}
        onConfirm={async (reason, description) => {
          if (await action.run(id, "confirm_delivery", (a) => confirmDelivery(id, a, reason, description), "Entrega confirmada.")) setDialog(null);
        }}
      />
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <Label as="h3">{label}</Label>
      {children}
    </section>
  );
}

function DriverSection({ detail }: { detail: DeliveryDetail }) {
  const action = useDeliveryAction(DELIVERY_ERROR_OVERRIDES);
  const [changing, setChanging] = useState(false);
  const [choice, setChoice] = useState("");
  const editable = detail.status === "preparing" || detail.status === "ready";
  const showSelect = editable && (detail.driver === null || changing);
  const onShift = useQuery({ queryKey: teamKeys.onShift, queryFn: ({ signal }) => fetchOnShift(signal), enabled: showSelect, retry: false });
  const options = useMemo(() => {
    const items = onShift.data ?? [];
    const suggested = detail.suggestedDriver?.id;
    return [...items].sort((a, b) => Number(b.driver.id === suggested) - Number(a.driver.id === suggested));
  }, [onShift.data, detail.suggestedDriver?.id]);
  const id = detail.id;

  const hint =
    detail.status === "ready" && detail.readyAt
      ? `Pronto na loja desde ${time(detail.readyAt)}.`
      : detail.driver === null
        ? "Sugestão: quem está em turno e fica livre primeiro."
        : null;

  return (
    <Section label="Motoboy">
      {detail.driver && !showSelect ? (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface-variant px-3 py-2.5">
          <Avatar initials={detail.driver.initials} color={entityColor(detail.driver.id)} size={26} />
          <span className="type-body-md min-w-0 flex-1 truncate text-text-primary">{detail.driver.shortName}</span>
          {editable && (
            <button type="button" onClick={() => setChanging(true)} className="type-caption flex min-h-8 cursor-pointer items-center gap-1 rounded-sm px-1 text-text-tertiary hover:text-text-primary">
              <Icon name="swap_horiz" size={16} />
              trocar
            </button>
          )}
        </div>
      ) : showSelect ? (
        <div className="flex flex-col gap-2">
          {onShift.isSuccess && options.length === 0 ? (
            <p className="type-body-sm text-text-tertiary">
              Ninguém em turno agora.{" "}
              <Link href={Paths.team} className="font-semibold text-primary-text hover:underline">
                Adicione um turno em Minha equipe.
              </Link>
            </p>
          ) : (
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <SelectField
                  label="Motoboy em turno"
                  value={choice}
                  onChange={(event) => setChoice(event.target.value)}
                  hint={options.some((o) => !o.sessionStarted) ? SHIFT_NOT_STARTED_NOTE : undefined}
                >
                  <option value="">Escolha o motoboy</option>
                  {options.map((o) => (
                    <option key={o.membershipId} value={o.driver.id} disabled={!o.sessionStarted}>
                      {o.driver.shortName}
                      {o.driver.id === detail.suggestedDriver?.id ? " · sugestão" : ""}
                      {o.sessionStarted ? "" : " · turno não iniciado"}
                    </option>
                  ))}
                </SelectField>
              </div>
              <Btn
                icon="add_task"
                disabled={choice === "" || action.busy}
                loading={action.busy}
                onClick={async () => {
                  if (await action.run(id, `assign:${choice}`, (a) => assignDriver(id, a, choice), "Motoboy atribuído.")) {
                    setChanging(false);
                    setChoice("");
                  }
                }}
              >
                Atribuir
              </Btn>
            </div>
          )}
          {detail.driver && (
            <div className="flex gap-3">
              <button type="button" onClick={() => setChanging(false)} className="type-caption cursor-pointer text-text-tertiary hover:text-text-primary">
                Manter {detail.driver.shortName}
              </button>
              <button
                type="button"
                disabled={action.busy}
                onClick={async () => {
                  if (await action.run(id, "unassign", (a) => unassignDriver(id, a), "Motoboy removido do pedido.")) setChanging(false);
                }}
                className="type-caption cursor-pointer text-error hover:underline"
              >
                Remover motoboy
              </button>
            </div>
          )}
          {action.error && <InlineError message={action.error} />}
        </div>
      ) : (
        <p className="type-body-md text-text-tertiary">Sem motoboy.</p>
      )}
      {hint && <p className="type-caption text-text-tertiary">{hint}</p>}
    </Section>
  );
}

function CodeSection({ detail }: { detail: DeliveryDetail }) {
  const info = ORIGIN_INFO[detail.origin];
  const { code } = detail;
  const value = code.value ?? "";
  return (
    <Section label={info.codeLabel}>
      {code.mode === "motoka" && value !== "" ? (
        <span aria-label={`Código ${value.split("").join(" ")}`} className="font-mono text-[26px] font-bold tracking-[3px] text-text-primary">
          {value}
        </span>
      ) : code.mode === "none" ? (
        <p className="type-body-md text-text-tertiary">Esta entrega não usa código.</p>
      ) : (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface-variant px-3 py-2.5">
          <span className="text-text-tertiary">
            <Icon name="verified_user" size={18} />
          </span>
          <span className="type-body-md text-text-primary">
            {info.pinFrom === "platform" ? "Só o cliente e o iFood conhecem" : `Conferido na ${info.label} na hora da entrega`}
          </span>
        </div>
      )}
      {code.mode !== "none" && <p className="type-caption text-pretty text-text-tertiary">{pinHint(info)}</p>}
      {code.failedAttempts > 0 && <p className="type-caption text-warning">{code.failedAttempts === 1 ? "1 tentativa errada." : `${code.failedAttempts} tentativas erradas.`}</p>}
    </Section>
  );
}

function TrackingSection({ detail, storeName }: { detail: DeliveryDetail; storeName: string }) {
  const queryClient = useQueryClient();
  const [sentLocal, setSentLocal] = useState(false);
  const url = detail.trackingUrl ? checkedOwnUrl(detail.trackingUrl) : "";

  if (detail.tracking.mode === "none" || detail.origin === "ifood") {
    return (
      <Section label="Acompanhamento do cliente">
        <div className="flex gap-2.5 rounded-md border border-border bg-surface p-3">
          <span className="text-info">
            <Icon name="mobile" size={20} />
          </span>
          <p className="type-body-sm text-pretty text-text-secondary">
            O cliente acompanha pelo app do iFood. O Motoka manda cada status para o iFood; não enviamos link por WhatsApp (o telefone do iFood é mascarado).
          </p>
        </div>
      </Section>
    );
  }

  const sent = sentLocal || detail.tracking.sentAt !== null;
  const message = url ? trackingMessage(detail, storeName, url) : "";
  const whatsapp = url && canWhatsApp(detail) ? whatsappLink(message, detail.customerPhone) : null;

  return (
    <Section label="Link de rastreio do cliente">
      {url === "" ? (
        <p className="type-body-sm text-text-tertiary">Não foi possível gerar o link agora.</p>
      ) : (
        <>
          <div className="flex items-center gap-2.5 rounded-md border border-border bg-surface-variant px-3 py-2.5">
            <span className="text-primary-text">
              <Icon name="link" size={18} />
            </span>
            <span title={url} data-testid="tracking-url" className="type-body-sm min-w-0 flex-1 select-all truncate font-mono">
              {url.replace(/^https?:\/\//, "")}
            </span>
          </div>
          <p className="type-body-sm self-end rounded-[12px_12px_2px_12px] bg-success/15 px-3 py-2.5 text-text-primary" style={{ maxWidth: "92%" }}>
            {message}
          </p>
          <div className="flex gap-2">
            {whatsapp ? (
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  // E11: marca como enviado no servidor; falha aqui não atrapalha o envio.
                  setSentLocal(true);
                  void trackingLinkSent(detail.id)
                    .then(() => queryClient.invalidateQueries({ queryKey: deliveryKeys.all }))
                    .catch(() => undefined);
                }}
                className={cn(
                  "type-label-lg inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 font-semibold",
                  sent ? "border-border text-text-primary hover:bg-surface-variant" : "border-success bg-success text-black",
                )}
              >
                <Icon name={sent ? "check" : "chat"} size={18} />
                {sent ? "Enviado" : "Enviar pelo WhatsApp"}
              </a>
            ) : (
              <span
                aria-disabled="true"
                title="Cliente sem celular cadastrado."
                className="type-label-lg inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-2.5 font-semibold text-text-disabled"
              >
                <Icon name="chat" size={18} />
                Enviar pelo WhatsApp
              </span>
            )}
            <a href={url} target="_blank" rel="noopener noreferrer" className="type-label-lg inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-4 py-2.5 font-semibold text-text-primary hover:bg-surface-variant">
              <Icon name="open_in_new" size={18} />
              Ver
            </a>
          </div>
          {!whatsapp && <p className="type-caption text-text-tertiary">Cliente sem celular cadastrado.</p>}
        </>
      )}
    </Section>
  );
}

/** "Houve cobrança?" (E15): entregue depois de cancelado. Respondido mostra o registro e "Corrigir". */
function AfterCancelCard({ detail }: { detail: DeliveryDetail }) {
  const action = useDeliveryAction(DELIVERY_ERROR_OVERRIDES);
  const [asking, setAsking] = useState(false);
  const [amount, setAmount] = useState("");
  const done = detail.afterCancel?.acknowledgedAt != null;
  const id = detail.id;
  const send = async (charged: boolean, value: string | null) => {
    if (await action.run(id, `after-cancel:${charged}`, () => afterCancelAck(id, charged, value), "Resposta registrada.")) {
      setAsking(false);
      setAmount("");
    }
  };
  const charged = detail.afterCancel?.charged;
  return (
    <div className="mx-5 mb-3 flex flex-col gap-2.5 rounded-md border border-warning/40 bg-warning/10 p-3">
      {done && !asking ? (
        <>
          <p className="type-body-sm text-text-secondary">
            {charged ? `Registrado: houve cobrança de ${formatMoney(detail.afterCancel?.chargedAmount ?? null) ?? "valor não informado"}.` : "Registrado: sem cobrança."}
          </p>
          <button type="button" onClick={() => setAsking(true)} className="type-caption self-start font-semibold text-primary-text hover:underline">
            Corrigir
          </button>
        </>
      ) : (
        <>
          <p className="type-body-sm text-text-secondary">Este pedido foi entregue depois de cancelado. Houve cobrança do cliente?</p>
          <Field
            label="Valor cobrado (se houve)"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(currencyInput(event.target.value))}
          />
          <div className="flex gap-2">
            <Btn disabled={action.busy || !(Number(currencyToDecimal(amount) ?? 0) > 0)} onClick={() => void send(true, currencyToDecimal(amount))}>
              Sim, houve cobrança
            </Btn>
            <Btn kind="secondary" disabled={action.busy} onClick={() => void send(false, null)}>
              Não houve
            </Btn>
          </div>
        </>
      )}
      {action.error && <InlineError message={action.error} />}
    </div>
  );
}

