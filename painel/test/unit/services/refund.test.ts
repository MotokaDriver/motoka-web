import { describe, expect, it } from "vitest";
import { lookOf } from "@/features/notices/logic";
import { PAYMENT_TERMINAL } from "@/features/services/hooks";
import { PAYMENT_STATUS_LABEL, PAYMENT_TERMINAL_FAILURE, cancellationReasonLabel, paymentFailure } from "@/features/services/logic";
import { parsePayment } from "@/features/services/model";
import { catalogMessage } from "@/lib/errors/messages";

// Estorno automático da API (motoka-api docs/estorno/PLANO.md).
describe("estorno no painel", () => {
  it("lê refund_pending e o trata como fim da espera, sem nunca virar pendente", () => {
    const payment = parsePayment({ id: "p", resource_id: "o", status: "refund_pending", payment_method: "pix" });
    expect(payment.status).toBe("refund_pending");
    expect(PAYMENT_STATUS_LABEL.refund_pending).toBe("Estorno em andamento");
    expect(PAYMENT_TERMINAL.has("refund_pending")).toBe(true);
    expect(PAYMENT_TERMINAL_FAILURE.has("refund_pending")).toBe(true);
    expect(paymentFailure(payment)).toBe("O pedido foi cancelado e o valor pago está sendo estornado.");
  });

  it("status desconhecido para o polling e não se passa por pendente", () => {
    const payment = parsePayment({ id: "p", resource_id: "o", status: "de_uma_api_nova", payment_method: "pix" });
    expect(payment.status).toBe("unknown");
    expect(PAYMENT_TERMINAL.has("unknown")).toBe(true);
    expect(PAYMENT_STATUS_LABEL.unknown).not.toBe(PAYMENT_STATUS_LABEL.pending);
  });

  it("avisos novos com o mesmo tom do app", () => {
    expect(lookOf("order_payment_expired")).toEqual({ icon: "hourglass_empty", tone: "warning" });
    expect(lookOf("order_refunded")).toEqual({ icon: "u_turn_left", tone: "info" });
  });

  it("motivos de cancelamento do tick antes da liberação", () => {
    for (const slug of ["unpaid_before_start", "system:unpaid_before_start", "paid_after_start", "system:paid_after_start"]) {
      expect(cancellationReasonLabel(slug)).not.toBeNull();
    }
    expect(cancellationReasonLabel("paid_after_start")).toContain("estornado");
  });

  it("códigos de erro novos da API", () => {
    expect(catalogMessage("ORDER_SERVICE_STARTED_CANNOT_CANCEL")).toContain("já começou");
    expect(catalogMessage("ORDER_REFUNDED_CANNOT_REOPEN")).toBe("Este pedido já foi estornado e não pode ser reaberto.");
    expect(catalogMessage("REFUND_REJECTED")).toBe("Não conseguimos estornar o valor. Fale com o suporte.");
  });
});
