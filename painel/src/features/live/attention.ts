import { PROBLEM_LABEL, ORIGIN_INFO, type DeliveryItem } from "@/features/deliveries/model";

/**
 * Bloco "Precisa da sua atenção" do mapa (WS-10 §5): só entram itens com `needs_attention` (o servidor
 * decide); este classificador só dá a categoria, na ordem de urgência. A primeira regra que casa vale.
 */
export type AttentionKind =
  | "awaiting_acceptance"
  | "origin_unconfirmed"
  | "cancelled_by_origin"
  | "problem"
  | "code_locked"
  | "delivered_after_cancel"
  | "no_driver"
  | "generic";

export interface AttentionItem {
  readonly id: string;
  readonly kind: AttentionKind;
  readonly title: string;
  readonly subtitle: string;
  readonly tone: "warning" | "error" | "neutral";
}

export function classify(item: DeliveryItem): AttentionItem {
  const n = `#${item.number}`;
  const driver = item.driver?.shortName ?? null;
  const base = { id: item.id };
  if (item.status === "awaiting_acceptance") {
    return { ...base, kind: "awaiting_acceptance", title: `${n} · Esperando seu aceite`, subtitle: "Responda no painel de pedidos", tone: "warning" };
  }
  if (item.originUnconfirmed) {
    const origin = ORIGIN_INFO[item.origin].label;
    return { ...base, kind: "origin_unconfirmed", title: `${n} · ${origin} não confirmou o aceite`, subtitle: "Confira no seu sistema e cancele se for o caso", tone: "error" };
  }
  if (item.status === "returning" && item.cancellation) {
    const origin = ORIGIN_INFO[item.origin].label;
    return {
      ...base,
      kind: "cancelled_by_origin",
      title: item.cancellation.afterPickup ? `${n} · Cancelado no ${origin}` : `${n} · Cancelado no ${origin}`,
      subtitle: item.cancellation.afterPickup ? (driver ? `${driver} avisado · volta com o pedido` : "volta com o pedido") : "Cancelado antes da retirada",
      tone: "error",
    };
  }
  if (item.status === "problem") {
    return { ...base, kind: "problem", title: `${n} · Problema na entrega`, subtitle: item.problem ? PROBLEM_LABEL[item.problem.reason] : "Abra o pedido", tone: "error" };
  }
  if (item.codeLocked) {
    return { ...base, kind: "code_locked", title: `${n} · Código bloqueado`, subtitle: "Muitas tentativas erradas na entrega", tone: "error" };
  }
  if (item.status === "delivered") {
    return { ...base, kind: "delivered_after_cancel", title: `${n} · Entregue depois do cancelamento`, subtitle: "Confirme o que aconteceu", tone: "warning" };
  }
  if ((item.status === "preparing" || item.status === "ready") && item.driver === null) {
    const suggestion = item.suggestedDriver?.shortName;
    return {
      ...base,
      kind: "no_driver",
      title: `${n} · Sem motoboy`,
      subtitle: item.status === "ready" ? "Pronto na loja" : suggestion ? `Em preparo · sugestão: ${suggestion}` : "Em preparo",
      tone: "neutral",
    };
  }
  return { ...base, kind: "generic", title: `${n} · Precisa de atenção`, subtitle: "Abra o pedido", tone: "neutral" };
}

const URGENCY: AttentionKind[] = ["awaiting_acceptance", "origin_unconfirmed", "cancelled_by_origin", "problem", "code_locked", "delivered_after_cancel", "no_driver", "generic"];

/** Itens classificados, do mais urgente ao menos. Só os `needs_attention`. */
export function classifyAll(items: readonly DeliveryItem[]): AttentionItem[] {
  return items
    .filter((item) => item.needsAttention)
    .map(classify)
    .sort((a, b) => URGENCY.indexOf(a.kind) - URGENCY.indexOf(b.kind));
}
