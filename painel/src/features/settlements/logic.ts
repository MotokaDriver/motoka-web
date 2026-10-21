import type { Tone } from "@/ui/Chip";
import type { SettlementDetail, SettlementStatus, SettlementSummary } from "./model";

export const STATUS_LABEL: Record<SettlementStatus, { label: string; tone: Tone }> = {
  pending_driver: { label: "Aguardando o motoboy", tone: "neutral" },
  pending_store: { label: "Para você confirmar", tone: "warning" },
  disputed: { label: "Contestado", tone: "error" },
  confirmed: { label: "Confirmado", tone: "info" },
  paid: { label: "Pago", tone: "success" },
  unknown: { label: "Status desconhecido", tone: "neutral" },
};

/** Filtros da lista: o servidor decide `needs_action` (pending_store e disputed). */
export type StatusFilter = "todos" | "atencao" | "motoboy" | "contestado" | "confirmado" | "pago";

export const FILTERS: ReadonlyArray<{ key: StatusFilter; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "atencao", label: "Precisam de você" },
  { key: "motoboy", label: "Aguardando o motoboy" },
  { key: "contestado", label: "Contestados" },
  { key: "confirmado", label: "Confirmados" },
  { key: "pago", label: "Pagos" },
];

export function filterParams(filter: StatusFilter): { status?: SettlementStatus[]; needsAction?: boolean } {
  switch (filter) {
    case "atencao":
      return { needsAction: true };
    case "motoboy":
      return { status: ["pending_driver"] };
    case "contestado":
      return { status: ["disputed"] };
    case "confirmado":
      return { status: ["confirmed"] };
    case "pago":
      return { status: ["paid"] };
    default:
      return {};
  }
}

/** Por que a entrega ainda não tem desfecho (valores de `pending.reason`, WS-11 §5.3). */
export const PENDING_REASON: Record<string, string> = {
  returning: "o pedido ainda está voltando para a loja",
  in_progress: "a entrega ainda está em andamento",
  return_receipt: "falta confirmar que o pedido voltou para a loja",
  after_cancel_ack: "falta dizer se houve cobrança do cliente",
};

export const pendingReason = (reason: string): string => PENDING_REASON[reason] ?? "falta resolver esta entrega";

export const RETURN_REASON: Record<string, string> = { cancelled: "cancelado depois da retirada", problem: "voltou por problema" };

export interface SettlementActions {
  /** A loja pode confirmar (S8). Em `pending_driver` o servidor recusa: espera o motoboy ou as 24 h. */
  readonly canConfirm: boolean;
  readonly confirmLabel: string;
  readonly canAdjust: boolean;
  readonly canPay: boolean;
  /** Texto de por que não dá para confirmar agora. */
  readonly hint: string | null;
}

/** Ações por estado (WS-11 D-W11-07). `frozen` (confirmado ou pago) não muda mais. */
export function actionsFor(d: Pick<SettlementDetail, "status" | "frozen" | "dealIncomplete" | "pending">): SettlementActions {
  const open = !d.frozen && d.status !== "confirmed" && d.status !== "paid";
  if (d.status === "pending_driver") {
    return {
      canConfirm: false,
      confirmLabel: "Confirmar acerto",
      canAdjust: open,
      canPay: false,
      hint: "O motoboy ainda não conferiu o acerto. Se ele não responder em 24 h, o acerto libera para você.",
    };
  }
  if (d.status === "pending_store" || d.status === "disputed") {
    const blocked =
      d.pending.length > 0
        ? "Ainda há entregas deste turno sem desfecho. Resolva-as antes de confirmar."
        : d.dealIncomplete
          ? "Informe o valor combinado com o motoboy antes de confirmar."
          : null;
    return { canConfirm: blocked === null, confirmLabel: d.status === "disputed" ? "Confirmar mesmo assim" : "Confirmar acerto", canAdjust: open, canPay: false, hint: blocked };
  }
  if (d.status === "confirmed") return { canConfirm: false, confirmLabel: "Confirmar acerto", canAdjust: false, canPay: true, hint: null };
  return { canConfirm: false, confirmLabel: "Confirmar acerto", canAdjust: false, canPay: false, hint: null };
}

/** Precisa da atenção da loja agora (mesma regra do servidor, `needs_action`). */
export const needsAction = (s: Pick<SettlementSummary, "status">): boolean => s.status === "pending_store" || s.status === "disputed";

export const HISTORY_LABEL: Record<string, string> = {
  created: "Acerto criado",
  driver_confirmed: "O motoboy confirmou",
  disputed: "O motoboy contestou",
  auto_confirmed: "Confirmado sozinho depois de 24 h",
  adjusted: "Você ajustou o acerto",
  store_confirmed: "Você confirmou",
  paid: "Marcado como pago",
  supplement_opened: "Acerto complementar aberto",
  dismissal_reopened: "Entrega reaberta",
};
