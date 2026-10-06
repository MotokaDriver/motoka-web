import { spDay, relativeDayTime } from "@/lib/time/saoPaulo";
import { phoneDigits } from "@/lib/links/links";
import { ORIGIN_INFO, PROBLEM_LABEL, type DeliveryDetail, type DeliveryItem, type DeliveryStatus, type Origin, type Tracking } from "./model";

/** Regras puras do painel de pedidos: matriz de ações, TrackCell, texto do WhatsApp, "ontem 23:50". */

export type ActionId = "ready" | "cancel" | "confirm_delivery" | "confirm_return" | "retry";

export interface ActionSpec {
  readonly id: ActionId;
  readonly label: string;
  readonly primary: boolean;
  readonly danger: boolean;
}

export interface ActionBar {
  readonly actions: readonly ActionSpec[];
  /** Pedido de integração: "Cancelar" e "Pronto" não existem aqui, o painel diz onde fazer. */
  readonly originNote: string | null;
}

const IN_TRANSIT: ReadonlySet<DeliveryStatus> = new Set(["picked_up", "on_the_way", "arrived"]);

/** Aviso do pedido que a origem não confirmou (WS-13 §4.4). */
export const originUnconfirmedText = (origin: Origin): string => `O ${ORIGIN_INFO[origin].label} não confirmou o aceite. Confira o pedido no seu sistema.`;

export const originNote = (origin: Origin): string => `Cancele no ${ORIGIN_INFO[origin].label}; o Motoka atualiza sozinho.`;

/**
 * Matriz de ações por estado e origem (WS-05 §5.3, R-4). "Cancelar" e "Pronto" só existem em pedido
 * manual: nas outras origens não mudariam nada no sistema de origem. `late_pickup` torna "Pedido voltou
 * para a loja" a ação primária (o acerto só paga o retorno com a confirmação da loja).
 */
export function availableActions(d: Pick<DeliveryDetail, "status" | "origin" | "cancellation" | "flags"> & { readonly originUnconfirmed?: boolean }): ActionBar {
  const manual = d.origin === "manual";
  // Origem que não confirmou o aceite (WS-13, B4): a loja ganha o direito de cancelar o pedido de integração.
  const mayCancel = manual || d.originUnconfirmed === true;
  const out: ActionSpec[] = [];
  const add = (id: ActionId, label: string, opts: { primary?: boolean; danger?: boolean } = {}) =>
    out.push({ id, label, primary: opts.primary ?? false, danger: opts.danger ?? false });
  let needsOriginNote = false;
  const cancel = () => (mayCancel ? add("cancel", "Cancelar pedido", { danger: true }) : (needsOriginNote = true));

  if (d.status === "preparing") {
    if (manual) add("ready", "Pronto para retirar", { primary: true });
    else needsOriginNote = true;
    cancel();
  } else if (d.status === "ready") {
    cancel();
  } else if (IN_TRANSIT.has(d.status)) {
    add("confirm_delivery", "Confirmar entrega", { primary: true });
    add("confirm_return", "Encerrar como devolvido");
    cancel();
  } else if (d.status === "problem") {
    add("retry", "Tentar de novo", { primary: true });
    add("confirm_return", "Encerrar como devolvido");
    add("confirm_delivery", "Confirmar entrega");
    cancel();
  } else if (d.status === "returning") {
    add("confirm_return", "Pedido voltou para a loja", { primary: true });
    if (d.cancellation === null) add("retry", "Tentar de novo");
  }
  // Retirada depois do cancelamento: o retorno vira a ação principal.
  const fixed = d.flags.latePickup ? out.map((a) => ({ ...a, primary: a.id === "confirm_return" })) : out;
  return { actions: fixed, originNote: needsOriginNote ? originNote(d.origin) : null };
}

export type TrackKind = "platform" | "expired" | "opened" | "sent" | "unsent" | "none";

export interface TrackCellInfo {
  readonly kind: TrackKind;
  readonly text: string;
}

/** `TrackCell` da lista: os 5 estados do rastreio. Cancelado não mostra nada. */
export function trackCell(status: DeliveryStatus, tracking: Tracking): TrackCellInfo {
  if (status === "cancelled") return { kind: "none", text: "" };
  if (tracking.mode === "none") return { kind: "platform", text: "cliente vê no iFood" };
  if (tracking.expired) return { kind: "expired", text: "link expirado" };
  if (tracking.openedCount > 0) return { kind: "opened", text: `link aberto ${tracking.openedCount}×` };
  if (tracking.sentAt) return { kind: "sent", text: "link enviado" };
  return { kind: "unsent", text: "link não enviado" };
}

const PICKED: ReadonlySet<DeliveryStatus> = new Set(["picked_up", "on_the_way", "arrived", "problem", "returning", "delivered"]);

/**
 * Mensagem do WhatsApp para o cliente. Antes da retirada o pedido "está sendo preparado"; depois, "saiu
 * com {motoboy}". `store` é a razão social ou o nome da loja.
 */
export function trackingMessage(d: Pick<DeliveryItem, "number" | "status" | "driver" | "customerName">, store: string, url: string): string {
  const first = d.customerName?.trim().split(/\s+/)[0] ?? "";
  const hello = first ? `Oi, ${first}!` : "Oi!";
  const state = PICKED.has(d.status) ? `saiu ${d.driver ? `com ${d.driver.shortName}` : "para a entrega"}` : "está sendo preparado";
  // O nome curto do motoboy termina em ponto ("Diego R."): não dobra o ponto da frase.
  const sentence = `${hello} Seu pedido #${d.number} da ${store} ${state}`;
  return `${sentence}${sentence.endsWith(".") ? "" : "."} Acompanhe aqui: ${url}`;
}

/** O WhatsApp só abre com um celular válido (iFood nunca: o telefone é mascarado e o modo é `none`). */
export const canWhatsApp = (d: Pick<DeliveryDetail, "origin" | "tracking" | "customerPhone">): boolean =>
  d.origin !== "ifood" && d.tracking.mode !== "none" && d.customerPhone !== null && phoneDigits(d.customerPhone) !== null;

/** "ontem 23:50" / "03/10 23:50" para pedido de outro dia (o "Em aberto" traz dias anteriores); senão `null`. */
export function otherDayLine(createdAt: string, now: Date): string | null {
  if (!createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime()) || spDay(created) === spDay(now)) return null;
  return relativeDayTime(created, now);
}

/** Endereço em uma linha a partir do detalhe: "Rua Chile, 1880 · Rebouças". */
export function addressText(d: DeliveryDetail): string {
  const a = d.address;
  const street = [a.street, a.number].filter(Boolean).join(", ");
  return [street, a.neighborhood].filter(Boolean).join(" · ") || d.addressLine || "";
}

export const hasAddressWarning = (d: Pick<DeliveryItem, "geocodeStatus">): boolean => d.geocodeStatus === "failed";

export interface DeliveryAlert {
  readonly id: string;
  readonly text: string;
}

export const DELIVERY_ERROR_OVERRIDES: Readonly<Record<string, string>> = {
  DELIVERY_CANCELLED: "Este pedido foi cancelado. A tela foi atualizada.",
  DELIVERY_ANOTHER_IN_PROGRESS: "O motoboy está com outra entrega em andamento. Tente de novo quando ela terminar.",
  DELIVERY_CODE_LOCKED: "O código foi bloqueado por tentativas. Confirme a entrega se o cliente recebeu.",
};

/** Alertas do painel (WS-05 §5.3 item 2), do mais grave ao menos. Textos fixos; só `description` é dado. */
export function deliveryAlerts(d: DeliveryDetail, time: (iso: string) => string): DeliveryAlert[] {
  const out: DeliveryAlert[] = [];
  const driver = d.driver?.shortName ?? "O motoboy";
  if (d.cancellation) {
    const c = d.cancellation;
    const who = c.by === "establishment" ? "pela loja" : `no ${ORIGIN_INFO[d.origin].label}`;
    out.push({
      id: "cancelled",
      text: c.afterPickup
        ? `Cancelado ${who} às ${time(c.at)}. ${driver} foi avisado e volta com o pedido.`
        : `Cancelado às ${time(c.at)}, antes da retirada.`,
    });
  }
  if (d.originUnconfirmed) {
    out.push({ id: "origin-unconfirmed", text: originUnconfirmedText(d.origin) });
  }
  if (d.problem) {
    const p = d.problem;
    const reason = p.reason === "other" && p.description ? `Outro motivo: ${p.description}` : PROBLEM_LABEL[p.reason];
    const when = p.reportedAt ? ` · informado às ${time(p.reportedAt)}` : "";
    const wait = ` ${driver} espera até 5 min no local.`;
    const cw = d.origin === "cardapio_web" ? " O Motoka não cancela no Cardápio Web: a loja decide lá." : "";
    out.push({ id: "problem", text: `${reason}${when}.${wait}${cw}` });
  }
  if (d.flags.latePickup) {
    out.push({ id: "late-pickup", text: `${driver} informou que retirou o pedido depois do cancelamento. Confirme quando o pedido voltar.` });
  }
  if (d.code.locked || d.codeLocked) {
    out.push({ id: "code-locked", text: "O código foi digitado errado 5 vezes. Se o cliente recebeu, confirme a entrega." });
  }
  // `not_configured` (deploy sem geocodificador) não é erro do endereço: só `failed` alerta.
  if (hasAddressWarning(d)) {
    out.push({ id: "geocode", text: "Não encontramos este endereço no mapa. Confira o número e a rua." });
  }
  return out;
}

/** O cartão "Houve cobrança?" vale para entregue depois de cancelado (E15, B-3). */
export const needsAfterCancel = (d: Pick<DeliveryDetail, "flags">): boolean => d.flags.deliveredAfterCancel;
