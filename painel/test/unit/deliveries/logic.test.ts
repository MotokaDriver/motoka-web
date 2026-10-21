import { describe, expect, it } from "vitest";
import { addDays, spDay } from "@/lib/time/saoPaulo";
import {
  availableActions,
  canWhatsApp,
  deliveryAlerts,
  otherDayLine,
  trackCell,
  trackingMessage,
} from "@/features/deliveries/logic";
import {
  applyCustomerAddress,
  edit,
  fieldsForError,
  initialForm,
  toInput,
  validate,
} from "@/features/deliveries/newOrder";
import { parseDetail, parseList, parseLookup, paymentLabel, STATUS } from "@/features/deliveries/model";
import { formatMoney } from "@/features/team/model";

const raw = (over: Record<string, unknown> = {}) => ({
  id: "e0000001-0000-4000-8000-000000000000",
  number: 184,
  origin: "manual",
  channel: "whatsapp",
  status: "preparing",
  customer: { name: "Lucas Ferraz", phone: "5541996401177", phone_localizer: null, address: { street: "Rua Chile", number: "1880", neighborhood: "Rebouças", city: "Curitiba", state: "PR" } },
  driver: null,
  tracking: { mode: "motoka", sent_at: null, opened_count: 0, expired: false },
  cancellation: null,
  problem: null,
  code_locked: false,
  geocode_status: "ok",
  needs_attention: false,
  created_at: "2026-10-05T21:00:00Z",
  payment: { type: "offline", method: "cash", amount_to_collect: "41.00", change_for: "50.00" },
  code: { mode: "motoka", value: "4821", failed_attempts: 0, locked: false },
  tracking_url: "https://painel.test/r/#tok",
  flags: { delivered_after_cancel: false, late_pickup: false },
  after_cancel: null,
  events: [],
  ...over,
});
const detail = (over: Record<string, unknown> = {}) => parseDetail(raw(over));
const time = (iso: string) => iso.slice(11, 16);

describe("matriz de ações (R-4)", () => {
  const ids = (d: ReturnType<typeof detail>) => availableActions(d).actions.map((a) => a.id);

  it("manual: preparing tem pronto e cancelar; ready só cancelar", () => {
    expect(ids(detail())).toEqual(["ready", "cancel"]);
    expect(ids(detail({ status: "ready" }))).toEqual(["cancel"]);
  });
  it("a caminho: confirmar, devolvido e cancelar; problema: tentar de novo primeiro", () => {
    expect(ids(detail({ status: "on_the_way" }))).toEqual(["confirm_delivery", "confirm_return", "cancel"]);
    expect(ids(detail({ status: "problem" }))).toEqual(["retry", "confirm_return", "confirm_delivery", "cancel"]);
  });
  it("voltando: com cancelamento só o retorno; sem cancelamento, retorno e tentar de novo", () => {
    expect(ids(detail({ status: "returning", cancellation: { by: "establishment", at: "x", reason: null, after_pickup: true } }))).toEqual(["confirm_return"]);
    expect(ids(detail({ status: "returning" }))).toEqual(["confirm_return", "retry"]);
  });
  it("terminais não têm ação", () => {
    for (const status of ["delivered", "cancelled", "returned", "rejected"]) expect(ids(detail({ status }))).toEqual([]);
  });
  it("origem de integração: sem cancelar nem pronto, com a nota de onde cancelar", () => {
    const bar = availableActions(detail({ origin: "ifood", status: "preparing" }));
    expect(bar.actions).toEqual([]);
    expect(bar.originNote).toBe("Cancele no iFood; o Motoka atualiza sozinho.");
    expect(availableActions(detail({ origin: "saipos", status: "on_the_way" })).actions.map((a) => a.id)).toEqual(["confirm_delivery", "confirm_return"]);
    expect(availableActions(detail({ origin: "manual", status: "preparing" })).originNote).toBeNull();
  });
  it("retirada depois do cancelamento: o retorno vira a ação principal", () => {
    const bar = availableActions(detail({ status: "returning", flags: { delivered_after_cancel: false, late_pickup: true }, cancellation: { by: "establishment", at: "x", reason: null, after_pickup: true } }));
    expect(bar.actions.find((a) => a.id === "confirm_return")?.primary).toBe(true);
  });
});

describe("TrackCell (5 estados)", () => {
  const t = (over: Partial<{ mode: string; sent_at: string | null; opened_count: number; expired: boolean }>) =>
    parseList({ total: 1, items: [raw({ tracking: { mode: "motoka", sent_at: null, opened_count: 0, expired: false, ...over } })], counts: {} }).items[0]!.tracking;
  it("cobre cada estado", () => {
    expect(trackCell("preparing", t({ mode: "none" })).text).toBe("cliente vê no iFood");
    expect(trackCell("preparing", t({ expired: true })).text).toBe("link expirado");
    expect(trackCell("preparing", t({ opened_count: 3, sent_at: "x" })).text).toBe("link aberto 3×");
    expect(trackCell("preparing", t({ sent_at: "x" })).text).toBe("link enviado");
    expect(trackCell("preparing", t({})).text).toBe("link não enviado");
    expect(trackCell("cancelled", t({})).kind).toBe("none");
  });
});

describe("mensagem do WhatsApp", () => {
  const url = "https://painel.test/r/#tok";
  it("antes da retirada: está sendo preparado", () => {
    expect(trackingMessage(detail(), "Padaria", url)).toBe(`Oi, Lucas! Seu pedido #184 da Padaria está sendo preparado. Acompanhe aqui: ${url}`);
  });
  it("depois da retirada: saiu com o motoboy", () => {
    const d = detail({ status: "on_the_way", driver: { id: "d1", short_name: "Diego R.", initials: "DR" } });
    expect(trackingMessage(d, "Padaria", url)).toContain("saiu com Diego R.");
  });
  it("iFood nunca tem WhatsApp, nem sem celular válido", () => {
    expect(canWhatsApp(detail())).toBe(true);
    expect(canWhatsApp(detail({ origin: "ifood", tracking: { mode: "none", sent_at: null, opened_count: 0, expired: false } }))).toBe(false);
    expect(canWhatsApp(detail({ customer: { name: "x", phone: null, address: {} } }))).toBe(false);
    expect(canWhatsApp(detail({ customer: { name: "x", phone: "123", address: {} } }))).toBe(false);
  });
});

describe("alertas e geocode", () => {
  it("geocode not_configured não é erro; failed alerta", () => {
    expect(deliveryAlerts(detail({ geocode_status: "not_configured" }), time)).toEqual([]);
    expect(deliveryAlerts(detail({ geocode_status: "failed" }), time).map((a) => a.id)).toEqual(["geocode"]);
  });
  it("cancelado antes e depois da retirada, problema, código bloqueado e retirada tardia", () => {
    const before = deliveryAlerts(detail({ status: "cancelled", cancellation: { by: "establishment", at: "2026-10-05T21:41:00Z", reason: null, after_pickup: false } }), time);
    expect(before[0]?.text).toBe("Cancelado às 21:41, antes da retirada.");
    const after = deliveryAlerts(
      detail({ status: "returning", driver: { id: "d", short_name: "Rafa", initials: "R" }, cancellation: { by: "origin", at: "2026-10-05T21:41:00Z", reason: null, after_pickup: true }, origin: "saipos" }),
      time,
    );
    expect(after[0]?.text).toBe("Cancelado no Saipos às 21:41. Rafa foi avisado e volta com o pedido.");
    const problem = deliveryAlerts(detail({ status: "problem", origin: "cardapio_web", problem: { reason: "other", reported_at: "2026-10-05T21:53:00Z", description: "Portão fechado" } }), time);
    expect(problem[0]?.text).toBe("Outro motivo: Portão fechado · informado às 21:53. O motoboy espera até 5 min no local. O Motoka não cancela no Cardápio Web: a loja decide lá.");
    expect(deliveryAlerts(detail({ code: { mode: "motoka", value: "1", failed_attempts: 5, locked: true } }), time)[0]?.id).toBe("code-locked");
    expect(deliveryAlerts(detail({ flags: { delivered_after_cancel: false, late_pickup: true } }), time)[0]?.id).toBe("late-pickup");
  });
});

describe("modelo e dia SP", () => {
  it("status desconhecido não quebra", () => {
    expect(STATUS[detail({ status: "algo_novo" }).status].label).toBe("Status desconhecido");
  });
  it("pagamento por origem", () => {
    expect(paymentLabel(detail().payment, "manual", formatMoney)).toBe("Cobrar R$ 41,00 · dinheiro · troco para R$ 50,00");
    expect(paymentLabel(detail({ payment: { type: "online" } }).payment, "ifood", formatMoney)).toBe("Pago no iFood · nada a cobrar");
  });
  it("'ontem 23:50' só para pedido de outro dia (fuso de SP)", () => {
    const now = new Date("2026-10-05T15:00:00Z");
    expect(otherDayLine("2026-10-05T12:00:00Z", now)).toBeNull();
    expect(otherDayLine("2026-10-05T02:50:00Z", now)).toBe("ontem 23:50");
    expect(otherDayLine("2026-10-01T12:00:00Z", now)).toBe("01/10 09:00");
    expect(spDay(new Date("2026-10-06T02:30:00Z"))).toBe("2026-10-05");
    expect(addDays("2026-10-05", 1)).toBe("2026-10-06");
  });
});

describe("novo pedido", () => {
  const store = { city: "Curitiba", state: "PR" };
  const fill = () => ({ ...initialForm(store), phone: "(41) 99640-1177", name: "Lucas", street: "Rua Chile", number: "1880", neighborhood: "Rebouças", amount: "R$ 58,00" });

  it("abre com cidade e UF da loja e valida o essencial", () => {
    const form = initialForm(store);
    expect(form.city).toBe("Curitiba");
    expect(Object.keys(validate(form))).toEqual(expect.arrayContaining(["phone", "name", "street", "number", "neighborhood", "amount"]));
    expect(validate(fill())).toEqual({});
  });
  it("balcão sem celular é válido e desliga o link de rastreio", () => {
    const counter = edit({ ...fill(), channel: "counter" }, { phone: "" });
    expect(validate(counter).phone).toBeUndefined();
    expect(counter.sendTracking).toBe(false);
    expect(toInput(counter, "c1").sendTrackingLink).toBe(false);
    expect(validate(edit(fill(), { channel: "phone", phone: "" })).phone).toBe("Informe o celular do cliente.");
  });
  it("endereço do cliente recorrente guarda as coordenadas; editar o endereço as descarta", () => {
    const [address] = parseLookup({ phone: "x", name: "L", addresses: [{ street: "Rua Chile", number: "1880", neighborhood: "Rebouças", city: "Curitiba", state: "PR", zip_code: "80220020", complement: "Ap 2", reference: "portão azul", location: { lat: -25.4, lng: -49.2 }, last_used_at: "2026-10-03T12:00:00Z" }] }).addresses;
    const picked = applyCustomerAddress(initialForm(store), address!);
    expect(picked).toMatchObject({ lat: -25.4, lng: -49.2, complementText: "Ap 2 · portão azul" });
    const body = toInput({ ...picked, phone: "(41) 99640-1177", name: "L", amount: "R$ 1,00" }, "c1").address;
    expect(body).toMatchObject({ complement: "Ap 2", reference: "portão azul", lat: -25.4, lng: -49.2 });
    const moved = edit(picked, { number: "1900" });
    expect(moved.lat).toBeNull();
    expect(toInput({ ...moved, phone: "(41) 99640-1177", name: "L", amount: "R$ 1,00" }, "c1").address.lat).toBeNull();
    // Editar o complemento também separa os dois campos e descarta o ponto.
    const typed = edit(picked, { complementText: "Ap 3" });
    expect(typed.split).toBeNull();
    expect(toInput({ ...typed, phone: "(41) 99640-1177", name: "L", amount: "R$ 1,00" }, "c1").address).toMatchObject({ complement: "Ap 3", reference: null });
  });
  it("corpo da API: só dígitos DDD+número, dinheiro como string, client_request_id e motoboy", () => {
    const input = toInput({ ...fill(), method: "cash", changeFor: "R$ 100,00", fee: "R$ 7,00" }, "req-1");
    expect(input).toMatchObject({
      clientRequestId: "req-1",
      customerPhone: "41996401177",
      payment: { type: "offline", method: "cash", amountToCollect: "58.00", changeFor: "100.00" },
      deliveryFee: "7.00",
      driver: { mode: "auto", driverId: null },
      sendTrackingLink: true,
    });
    expect(toInput({ ...fill(), paid: true }, "r").payment).toEqual({ type: "online", method: null, amountToCollect: null, changeFor: null });
  });
  it("troco menor que o valor é recusado", () => {
    expect(validate({ ...fill(), method: "cash", changeFor: "R$ 10,00" }).changeFor).toBeDefined();
  });
  it("erros da API apontam o campo", () => {
    expect(fieldsForError("DELIVERY_CUSTOMER_PHONE_REQUIRED")).toEqual(["phone"]);
    expect(fieldsForError("DELIVERY_ADDRESS_INVALID")).toContain("street");
    expect(fieldsForError("DELIVERY_PAYMENT_INVALID")).toEqual(["payment"]);
    expect(fieldsForError("DELIVERY_DRIVER_NOT_ON_SHIFT")).toEqual(["driver"]);
    expect(fieldsForError("OUTRO")).toEqual([]);
  });
});
