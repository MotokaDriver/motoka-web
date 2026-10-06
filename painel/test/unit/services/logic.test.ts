import { describe, expect, it } from "vitest";
import { cancelRule, cancellationReasonLabel, countdown, dayTitle, durationLabel, offerDiffPercent, paymentFailure, payoutLabel, spInstant, todayStart, turnOf } from "@/features/services/logic";
import { emptyForm, toInput, validate, type ServiceForm } from "@/features/services/newService";
import { decimal, parseNegotiation, parseOrder, parsePayment, type Order } from "@/features/services/model";

const NOW = new Date("2026-10-05T15:00:00Z"); // 12:00 em São Paulo
const order = (over: Record<string, unknown> = {}): Order =>
  parseOrder({ id: "a0000001-0000-4000-8000-000000000001", status: "waiting_for_drivers", type: "fixed_value", start_date: "2026-10-06T15:00:00Z", end_date: "2026-10-06T19:00:00Z", requested_drivers: 2, assigned_drivers: 1, value: "50.00", internal_fee: "5.00", ...over });

describe("pagamento e datas", () => {
  it("payoutLabel", () => {
    expect(payoutLabel("50.00", "7.50")).toBe("R$ 50,00 + R$ 7,50/entrega");
    expect(payoutLabel("50.00", null)).toBe("R$ 50,00");
    expect(payoutLabel(null, "7.50")).toBe("R$ 7,50/entrega");
    expect(payoutLabel("0.00", "0.00")).toBe("A combinar");
  });

  it("duração compacta e título do dia", () => {
    expect(durationLabel("2026-10-06T15:00:00Z", "2026-10-06T15:45:00Z")).toBe("45 min");
    expect(durationLabel("2026-10-06T15:00:00Z", "2026-10-06T18:00:00Z")).toBe("3h");
    expect(durationLabel("2026-10-06T15:00:00Z", "2026-10-06T18:30:00Z")).toBe("3h30min");
    expect(dayTitle(order(), NOW)).toBe("Amanhã, 06/10");
    expect(dayTitle(order({ start_date: "2026-10-05T20:00:00Z" }), NOW)).toBe("Hoje, 05/10");
    expect(dayTitle(order({ status: "service_started" }), NOW)).toBe("Agora");
  });

  it("spInstant converte horário de São Paulo para UTC e recusa horário inválido", () => {
    expect(spInstant("2026-10-06", "12:00")).toBe("2026-10-06T15:00:00.000Z");
    expect(spInstant("2026-10-06", "25:00")).toBeNull();
    expect(spInstant("2026-13-40", "10:00")).toBeNull();
    expect(todayStart(NOW)).toBe("2026-10-05T03:00:00.000Z");
  });

  it("decimal aceita string e número, e recusa lixo", () => {
    expect(decimal(12.5)).toBe("12.50");
    expect(decimal("7.5")).toBe("7.5");
    expect(decimal("abc")).toBeNull();
    expect(decimal(null)).toBeNull();
  });
});

describe("cancelamento (regra do app)", () => {
  it("pending_payment e paid cancelam sempre", () => {
    expect(cancelRule(order({ status: "pending_payment", start_date: "2026-10-05T15:30:00Z" }), NOW).canCancel).toBe(true);
    expect(cancelRule(order({ status: "paid" }), NOW).canCancel).toBe(true);
  });
  it("aguardando motoboys: 3 h de antecedência", () => {
    expect(cancelRule(order(), NOW).canCancel).toBe(true);
    expect(cancelRule(order({ start_date: "2026-10-05T17:00:00Z" }), NOW)).toEqual({ canCancel: false, reason: "O cancelamento só é possível até 3 horas antes do início do serviço." });
    expect(cancelRule(order({ start_date: "2026-10-05T14:00:00Z" }), NOW)).toMatchObject({ canCancel: false, reason: expect.stringContaining("já passou") });
  });
  it("em andamento, finalizado e cancelado não têm botão", () => {
    expect(cancelRule(order({ status: "service_started" }), NOW)).toMatchObject({ canCancel: false, reason: expect.stringContaining("Fale com o suporte") });
    expect(cancelRule(order({ status: "finished" }), NOW)).toEqual({ canCancel: false, reason: null });
    expect(cancelRule(order({ status: "cancelled" }), NOW)).toEqual({ canCancel: false, reason: null });
  });
  it("motivo: conhecido vira texto, slug desconhecido some, texto livre aparece", () => {
    expect(cancellationReasonLabel("system:expired_no_drivers")).toBe("Nenhum motoboy aceitou o serviço até o horário de início.");
    expect(cancellationReasonLabel("some_unknown_slug")).toBeNull();
    expect(cancellationReasonLabel("Cancelado a pedido do suporte")).toBe("Cancelado a pedido do suporte");
    expect(cancellationReasonLabel(null)).toBeNull();
  });
});

const neg = (offers: Array<Record<string, unknown>>, status = "pending") => parseNegotiation({ id: "n1", order_id: "o1", status, offers });

describe("negociação", () => {
  it("a loja só age quando a última oferta pendente é do motoboy", () => {
    const driver = { id: "1", created_at: "2026-10-05T10:00:00Z", created_by: "driver", status: "pending", value: "60.00" };
    expect(turnOf(neg([driver])).kind).toBe("act");
    expect(turnOf(neg([{ ...driver, created_by: "establishment" }])).kind).toBe("waiting");
    expect(turnOf(neg([{ ...driver, status: "superseded" }])).kind).toBe("answered");
    expect(turnOf(neg([driver], "accepted"))).toEqual({ kind: "closed", text: "Proposta aceita" });
    expect(turnOf(neg([driver], "cancelled"))).toEqual({ kind: "closed", text: "Proposta cancelada ou expirada" });
  });
  it("usa a oferta mais recente, não a última da lista", () => {
    const older = { id: "1", created_at: "2026-10-05T11:00:00Z", created_by: "establishment", status: "pending", value: "55.00" };
    const newer = { id: "2", created_at: "2026-10-05T10:00:00Z", created_by: "driver", status: "pending", value: "60.00" };
    expect(turnOf(neg([older, newer])).kind).toBe("waiting");
  });
  it("diferença percentual contra o anunciado", () => {
    expect(offerDiffPercent("60.00", "50.00")).toBe(20);
    expect(offerDiffPercent("45.00", "50.00")).toBe(-10);
    expect(offerDiffPercent("60.00", null)).toBe(0);
  });
});

describe("pagamento", () => {
  it("falha: pelo gateway, depois pelo status; nunca texto cru", () => {
    const p = (over: Record<string, unknown>) => parsePayment({ id: "p", status: "failed", payment_method: "credit_card", amount: 5, ...over });
    expect(paymentFailure(p({ payment_metadata: { gateway_status: "UNPAID", reason: "texto cru do banco" } }))).toContain("não autorizou");
    expect(paymentFailure(p({ status: "expired" }))).toContain("prazo");
    expect(paymentFailure(p({}))).toBe("O pagamento não foi concluído. Tente novamente.");
  });
  it("PIX: o QR só vira imagem se for base64 de verdade", () => {
    expect(parsePayment({ id: "p", status: "pending", payment_method: "pix", amount: 5, qr_code_base64: "iVBORw0KGgo=" }).qrImage).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(parsePayment({ id: "p", status: "pending", payment_method: "pix", amount: 5, qr_code_base64: "javascript:alert(1)" }).qrImage).toBeNull();
  });
  it("contagem regressiva", () => {
    const at = Date.parse("2026-10-05T15:00:00Z");
    expect(countdown("2026-10-05T15:01:05Z", at)).toBe("01:05");
    expect(countdown("2026-10-05T14:59:00Z", at)).toBeNull();
    expect(countdown(null, at)).toBeNull();
  });
});

describe("formulário de solicitar serviço", () => {
  const ok: ServiceForm = { ...emptyForm(), startDay: "2026-10-06", startTime: "12:00", endDay: "2026-10-06", endTime: "16:00", drivers: "2", type: "fixed_plus_per_delivery", value: "R$ 50,00", perDelivery: "R$ 6,00" };
  it("válido gera o corpo com UTC e só os valores do tipo", () => {
    expect(validate(ok, NOW)).toEqual({});
    expect(toInput(ok, "u", NOW)).toMatchObject({ requestedDrivers: 2, startDate: "2026-10-06T15:00:00.000Z", endDate: "2026-10-06T19:00:00.000Z", value: "50.00", pricePerDelivery: "6.00" });
    expect(toInput({ ...ok, type: "per_delivery" }, "u", NOW)).toMatchObject({ value: null, pricePerDelivery: "6.00" });
    expect(toInput({ ...ok, type: "fixed_value" }, "u", NOW)).toMatchObject({ value: "50.00", pricePerDelivery: null });
  });
  it("erros do app e limites", () => {
    expect(validate(emptyForm(), NOW)).toMatchObject({ startDay: "Obrigatório", drivers: "Obrigatório", type: "Escolha o tipo de serviço" });
    expect(validate({ ...ok, startDay: "2026-10-05", startTime: "11:00", endDay: "2026-10-05" }, NOW).startTime).toBe("O horário de início deve ser no futuro");
    expect(validate({ ...ok, endTime: "11:00" }, NOW).endTime).toBe("A data/hora final deve ser posterior à inicial");
    expect(validate({ ...ok, drivers: "9" }, NOW).drivers).toBeUndefined();
    expect(validate({ ...ok, drivers: "0" }, NOW).drivers).toBe("Informe a quantidade de motoboys.");
    expect(validate({ ...ok, startDay: "2026-12-30", endDay: "2026-12-30" }, NOW).startDay).toBe("Escolha uma data nos próximos 30 dias.");
    expect(validate({ ...ok, value: "" }, NOW).value).toBe("Informe o valor por motoboy");
    expect(validate({ ...ok, perDelivery: "R$ 0,00" }, NOW).perDelivery).toBe("O valor deve ser maior que zero");
  });
});
