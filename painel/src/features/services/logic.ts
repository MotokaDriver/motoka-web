import { addDays, isValidDay, SP_TIME_ZONE, spDay, spTime } from "@/lib/time/saoPaulo";
import { formatMoney } from "@/features/team/model";
import type { Tone } from "@/ui/Chip";
import type { Negotiation, Offer, Order, OrderStatus, OrderType, Payment } from "./model";

/** Regras de tela do WN-7, extraídas do app (`features/establishment`). O painel não calcula valor de serviço. */

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Pendente",
  paid: "Pago",
  waiting_for_drivers: "Aguardando motoboys",
  pending_service_start: "Início em breve",
  service_started: "Em andamento",
  finished: "Finalizado",
  cancelled: "Cancelado",
  unknown: "Pendente",
};

export const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending_payment: "warning",
  paid: "warning",
  waiting_for_drivers: "warning",
  pending_service_start: "warning",
  service_started: "success",
  finished: "success",
  cancelled: "error",
  unknown: "warning",
};

export const TYPE_LABEL: Record<OrderType, string> = {
  fixed_value: "Valor fixo",
  per_delivery: "Valor por entrega",
  fixed_plus_per_delivery: "Valor fixo + bônus por entrega",
};

const positive = (value: string | null): value is string => value !== null && Number(value) > 0;

/** "R$ 50,00 + R$ 7,50/entrega", "R$ 50,00", "R$ 7,50/entrega" ou "A combinar". */
export function payoutLabel(value: string | null, perDelivery: string | null): string {
  const fixed = positive(value) ? formatMoney(value) : null;
  const each = positive(perDelivery) ? formatMoney(perDelivery) : null;
  if (fixed && each) return `${fixed} + ${each}/entrega`;
  if (fixed) return fixed;
  if (each) return `${each}/entrega`;
  return "A combinar";
}

export const orderPayout = (order: Order): string => payoutLabel(order.value, order.pricePerDelivery);

// --- Datas (sempre em São Paulo, DN-20) ------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: SP_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const shortFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: SP_TIME_ZONE, day: "2-digit", month: "2-digit" });

export const formatDate = (iso: string): string => (Number.isNaN(Date.parse(iso)) ? "" : dateFormatter.format(new Date(iso)));
export const formatTime = (iso: string): string => (Number.isNaN(Date.parse(iso)) ? "" : spTime(new Date(iso)));
export const formatDateTime = (iso: string): string => (Number.isNaN(Date.parse(iso)) ? "" : `${formatDate(iso)} às ${formatTime(iso)}`);

/** "Agora", "Hoje, 05/10", "Amanhã, 06/10" ou "07/10/2026" (título do card). */
export function dayTitle(order: Order, now: Date): string {
  if (order.status === "service_started") return "Agora";
  const start = new Date(order.startDate);
  if (Number.isNaN(start.getTime())) return "";
  const day = spDay(start);
  const today = spDay(now);
  if (day === today) return `Hoje, ${shortFormatter.format(start)}`;
  if (day === addDays(today, 1)) return `Amanhã, ${shortFormatter.format(start)}`;
  return dateFormatter.format(start);
}

/** "45 min", "3h", "3h30min". */
export function durationLabel(startIso: string, endIso: string): string {
  const minutes = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, "0")}min`;
}

/** Instante UTC (ISO) de `dia` + `HH:mm` em São Paulo, sem assumir UTC−3. `null` se o dia ou a hora forem inválidos. */
export function spInstant(day: string, time: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!isValidDay(day) || !match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const wanted = Date.parse(`${day}T${time}:00Z`);
  let guess = wanted + 3 * 3_600_000;
  // Corrige pela diferença entre o que São Paulo mostra e o que se quer (uma volta basta: sem horário de verão).
  for (let i = 0; i < 2; i += 1) {
    const shown = Date.parse(`${spDay(new Date(guess))}T${spTime(new Date(guess))}:00Z`);
    guess += wanted - shown;
  }
  const shownNow = `${spDay(new Date(guess))} ${spTime(new Date(guess))}`;
  return shownNow === `${day} ${time}` ? new Date(guess).toISOString() : null;
}

/** Hoje 00:00 em São Paulo (ISO UTC): o piso da lista de próximos serviços. */
export function todayStart(now: Date): string {
  return spInstant(spDay(now), "00:00") ?? now.toISOString();
}

// --- Cancelamento ----------------------------------------------------------------------------

export const CANCEL_CUTOFF_MS = 3 * 3_600_000;

export type CancelRule = { readonly canCancel: true } | { readonly canCancel: false; readonly reason: string | null };

/** Regra do app (`_cancelBlockedReason`): a API é a palavra final; isto só evita o clique que ela vai recusar. */
export function cancelRule(order: Order, now: Date): CancelRule {
  switch (order.status) {
    case "cancelled":
    case "finished":
      return { canCancel: false, reason: null };
    case "service_started":
      return { canCancel: false, reason: "Este serviço já está em andamento e não pode ser cancelado por aqui. Fale com o suporte." };
    case "pending_payment":
    case "paid":
      return { canCancel: true };
    default: {
      const start = Date.parse(order.startDate);
      if (Number.isNaN(start)) return { canCancel: true };
      if (start <= now.getTime()) return { canCancel: false, reason: "O horário de início deste serviço já passou. Fale com o suporte para cancelá-lo." };
      if (start - now.getTime() < CANCEL_CUTOFF_MS) return { canCancel: false, reason: "O cancelamento só é possível até 3 horas antes do início do serviço." };
      return { canCancel: true };
    }
  }
}

export const CANCEL_NOTICE =
  "Em caso de cancelamento, faça com antecedência de 3hrs. Cancelamentos após esse prazo com motoboy confirmado não terão reembolso.";

export const REFUND_NOTE = "A taxa de serviço já paga não é devolvida automaticamente: depois de cancelar, fale com o suporte para pedir o estorno.";

const REASON_LABEL: Record<string, string> = {
  expired_no_drivers: "Nenhum motoboy aceitou o serviço até o horário de início.",
  "system:expired_no_drivers": "Nenhum motoboy aceitou o serviço até o horário de início.",
  "system:auto_start": "Iniciado automaticamente no horário programado.",
  "system:auto_start_partial": "Iniciado automaticamente com a equipe incompleta.",
  "system:auto_finish": "Finalizado automaticamente no horário programado.",
  "driver removed": "Um motoboy foi removido do serviço.",
};

const SLUG = /^[a-z0-9]+([_.:-][a-z0-9]+)*$/;

/** Motivo do cancelamento: os conhecidos viram texto; um slug desconhecido não aparece; texto livre de admin vai como veio. */
export function cancellationReasonLabel(reason: string | null): string | null {
  if (reason === null) return null;
  const known = REASON_LABEL[reason];
  if (known) return known;
  return SLUG.test(reason) ? null : reason;
}

// --- Negociação ------------------------------------------------------------------------------

export const NEGOTIATION_LABEL: Record<string, string> = { pending: "Pendente", accepted: "Aceita", rejected: "Recusada", cancelled: "Cancelada" };
export const OFFER_LABEL: Record<Offer["status"], string> = { pending: "Pendente", accepted: "Aceita", rejected: "Recusada", superseded: "Substituída", unknown: "Pendente" };
export const OFFER_TONE: Record<Offer["status"], Tone> = { pending: "warning", accepted: "success", rejected: "error", superseded: "neutral", unknown: "neutral" };

export const isClosed = (n: Negotiation): boolean => n.status === "accepted" || n.status === "rejected" || n.status === "cancelled";

/** A oferta mais recente (maior `created_at`; empate fica com a última da lista). */
export function latestOffer(n: Negotiation): Offer | null {
  let best: Offer | null = null;
  for (const offer of n.offers) {
    if (best === null || Date.parse(offer.createdAt) >= Date.parse(best.createdAt)) best = offer;
  }
  return best;
}

export type NegotiationTurn =
  | { readonly kind: "act" }
  | { readonly kind: "closed"; readonly text: string }
  | { readonly kind: "answered"; readonly text: string }
  | { readonly kind: "waiting"; readonly text: string };

/** A loja só age quando a negociação está aberta e a última oferta, pendente, é do motoboy. */
export function turnOf(n: Negotiation): NegotiationTurn {
  if (n.status === "accepted") return { kind: "closed", text: "Proposta aceita" };
  if (n.status === "rejected") return { kind: "closed", text: "Proposta recusada" };
  if (n.status === "cancelled") return { kind: "closed", text: "Proposta cancelada ou expirada" };
  const last = latestOffer(n);
  if (last === null || last.status !== "pending") return { kind: "answered", text: "Esta proposta já foi respondida e não pode mais ser aceita." };
  if (last.createdBy === "driver") return { kind: "act" };
  return { kind: "waiting", text: "Aguardando resposta do motoboy" };
}

/** Diferença % da oferta contra o valor anunciado: `round((oferta - valor) / valor * 100)`; 0 sem valor. */
export function offerDiffPercent(offerValue: string | null, advertised: string | null): number {
  const offer = Number(offerValue ?? "0");
  const base = Number(advertised ?? "0");
  if (!(base > 0) || !Number.isFinite(offer)) return 0;
  return Math.round(((offer - base) / base) * 100);
}

export const diffLabel = (percent: number): string => (percent > 0 ? `+${percent}%` : `${percent}%`);

export function authorLabel(createdBy: string): string {
  return createdBy === "establishment" ? "Você" : createdBy === "driver" ? "Motoboy" : "";
}

// --- Pagamento -------------------------------------------------------------------------------

export const PAYMENT_STATUS_LABEL: Record<Payment["status"], string> = {
  created: "Criado",
  processing: "Processando",
  pending: "Pendente",
  paid: "Pago",
  failed: "Falhou",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  expired: "Expirado",
  unknown: "Pendente",
};

const GATEWAY_FAILURE: Record<string, string> = {
  unpaid: "O banco emissor não autorizou a cobrança. Confira os dados do cartão ou use outro cartão.",
  contested: "A cobrança foi contestada pelo banco emissor. Use outro cartão para concluir o pedido.",
  canceled: "A cobrança do cartão foi cancelada. Você pode tentar novamente.",
  cancelled: "A cobrança foi cancelada. Você pode tentar novamente.",
  expired: "A cobrança expirou antes de ser confirmada. Faça um novo pagamento para confirmar o pedido.",
  refunded: "O valor foi estornado. Faça um novo pagamento para confirmar o pedido.",
  under_dispute: "A cobrança está em disputa e não pôde ser confirmada. Faça um novo pagamento para confirmar o pedido.",
};

/** Texto da falha do pagamento: pelo status do gateway, depois pelo status; nunca o texto cru do provedor. */
export function paymentFailure(payment: Payment): string {
  const byGateway = payment.gatewayStatus ? GATEWAY_FAILURE[payment.gatewayStatus] : undefined;
  if (byGateway) return byGateway;
  if (payment.status === "expired") return "O prazo deste pagamento expirou. Gere uma nova cobrança para confirmar o pedido.";
  if (payment.status === "cancelled") return "A cobrança foi cancelada. Você pode tentar novamente.";
  if (payment.status === "refunded") return GATEWAY_FAILURE.refunded ?? "";
  return "O pagamento não foi concluído. Tente novamente.";
}

/** "MM:SS" que falta até `expiresAt`; `null` se já passou ou a data é inválida. */
export function countdown(expiresAt: string | null, now: number): string | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return null;
  const seconds = Math.ceil((end - now) / 1000);
  if (seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export const PAYMENT_TERMINAL_FAILURE: ReadonlySet<Payment["status"]> = new Set(["failed", "cancelled", "refunded", "expired"]);

export const CARD_TYPE_LABEL = (type: string): string => (type.toLowerCase() === "debit" ? "Débito" : "Crédito");

export const CARD_APP_NOTE = "Para cadastrar um cartão novo, use o app Motoka. Os cartões salvos lá aparecem aqui.";

/** O pagamento principal do card: o valor fixo, ou o por entrega quando não há fixo. */
export function primaryPayout(order: Order): string {
  if (positive(order.value)) return formatMoney(order.value) ?? "A combinar";
  if (positive(order.pricePerDelivery)) return `${formatMoney(order.pricePerDelivery)}/entrega`;
  return "A combinar";
}
