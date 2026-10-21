import { describe, expect, it } from "vitest";
import { classify, classifyAll } from "@/features/live/attention";
import { parseItem } from "@/features/deliveries/model";

const item = (over: Record<string, unknown> = {}) =>
  parseItem({
    id: "e0000001-0000-4000-8000-000000000001",
    number: 187,
    origin: "cardapio_web",
    channel: null,
    status: "preparing",
    customer: { name: "Ana", address_line: "Rua A, 1", neighborhood: "Centro" },
    driver: null,
    suggested_driver: { id: "e1111111-1111-4111-8111-111111111111", short_name: "Rafa" },
    tracking: { mode: "motoka", sent_at: null, opened_count: 0, expired: false },
    cancellation: null,
    problem: null,
    code_locked: false,
    geocode_status: "ok",
    needs_attention: true,
    created_at: "2026-10-05T21:00:00Z",
    ...over,
  });

describe("classificador de atenção (WS-10 §5)", () => {
  it("cada categoria, com status e origens reais", () => {
    expect(classify(item({ status: "awaiting_acceptance", origin: "saipos" }))).toMatchObject({ kind: "awaiting_acceptance", title: "#187 · Esperando seu aceite", tone: "warning" });
    expect(classify(item({ status: "returning", origin: "ifood", driver: { id: "d1", short_name: "Diego", initials: "D" }, cancellation: { by: "origin", at: "x", reason: null, after_pickup: true } }))).toMatchObject({
      kind: "cancelled_by_origin",
      title: "#187 · Cancelado no iFood",
      subtitle: "Diego avisado · volta com o pedido",
      tone: "error",
    });
    expect(classify(item({ status: "returning", cancellation: { by: "origin", at: "x", reason: null, after_pickup: false } })).subtitle).toBe("Cancelado antes da retirada");
    expect(classify(item({ status: "problem", problem: { reason: "address_not_found", reported_at: null } }))).toMatchObject({ kind: "problem", subtitle: "Endereço não encontrado" });
    expect(classify(item({ code_locked: true, status: "on_the_way" }))).toMatchObject({ kind: "code_locked", subtitle: "Muitas tentativas erradas na entrega" });
    expect(classify(item({ status: "delivered" })).kind).toBe("delivered_after_cancel");
    expect(classify(item())).toMatchObject({ kind: "no_driver", subtitle: "Em preparo · sugestão: Rafa", tone: "neutral" });
    expect(classify(item({ status: "ready" })).subtitle).toBe("Pronto na loja");
    expect(classify(item({ status: "on_the_way", driver: { id: "d", short_name: "D", initials: "D" } })).kind).toBe("generic");
  });

  it("só entram os que o servidor marcou, do mais urgente ao menos", () => {
    const list = classifyAll([
      item({ id: "e0000001-0000-4000-8000-000000000001" }),
      item({ id: "e0000002-0000-4000-8000-000000000002", status: "problem", problem: { reason: "other", reported_at: null } }),
      item({ id: "e0000003-0000-4000-8000-000000000003", needs_attention: false, status: "problem" }),
      item({ id: "e0000004-0000-4000-8000-000000000004", status: "awaiting_acceptance" }),
    ]);
    expect(list.map((i) => i.kind)).toEqual(["awaiting_acceptance", "problem", "no_driver"]);
  });
});
