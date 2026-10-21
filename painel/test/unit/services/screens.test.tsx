import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { establishmentUser } from "../helpers";

const nav = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, prefetch: vi.fn() }),
  usePathname: () => "/servicos/",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const sessionState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => ({ subscribe: () => () => undefined, getState: () => sessionState.current }),
  apiFetch: async () => {
    throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  },
}));

const api = vi.hoisted(() => ({
  fetchOrders: vi.fn(),
  fetchOrder: vi.fn(),
  fetchOrderDrivers: vi.fn(),
  fetchNegotiations: vi.fn(),
  reviewOrder: vi.fn(),
  createOrder: vi.fn(),
  cancelOrder: vi.fn(),
  offerNegotiation: vi.fn(),
  acceptNegotiation: vi.fn(),
  rejectNegotiation: vi.fn(),
  cancelNegotiation: vi.fn(),
  payOrder: vi.fn(),
  fetchPayment: vi.fn(),
  fetchCards: vi.fn(),
  deleteCard: vi.fn(),
}));
vi.mock("@/features/services/api", () => api);

const { ServicesScreen } = await import("@/features/services/ServicesScreen");
const { NewServiceScreen } = await import("@/features/services/NewServiceScreen");
const { PayPanel } = await import("@/features/services/PayPanel");
const { ToastProvider } = await import("@/ui/Toast");
const model = await import("@/features/services/model");

const ID = "a0000001-0000-4000-8000-000000000001";
const NEG = "b0000001-0000-4000-8000-000000000001";
const CARD = "c0000001-0000-4000-8000-000000000001";
const future = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

const rawOrder = (over: Record<string, unknown> = {}) => ({
  id: ID,
  status: "waiting_for_drivers",
  type: "fixed_value",
  start_date: future(24),
  end_date: future(28),
  requested_drivers: 2,
  assigned_drivers: 1,
  value: "50.00",
  price_per_delivery: null,
  internal_fee: "5.00",
  ...over,
});
const list = (items: unknown[]) => model.parseOrderList({ total: items.length, items });
const negotiation = (over: Record<string, unknown> = {}) =>
  model.parseNegotiation({
    id: NEG,
    order_id: ID,
    status: "pending",
    driver: { id: "d1", full_name: "Diego Ramos", rating: 4.5 },
    offers: [{ id: "of1", created_at: "2026-10-05T10:00:00Z", created_by: "driver", status: "pending", value: "60.00", value_per_delivery: null }],
    ...over,
  });

function mount(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
  return { user, queryClient };
}

beforeEach(() => {
  sessionState.current = { status: "authenticated", user: establishmentUser() };
  nav.replace.mockReset();
  nav.push.mockReset();
  nav.search = `pedido=${ID}`;
  for (const fn of Object.values(api)) fn.mockReset();
  api.fetchOrders.mockImplementation(async (query: { status: string[] }) => (query.status.includes("service_started") ? list([]) : list([rawOrder()])));
  api.fetchOrder.mockResolvedValue(model.parseOrder(rawOrder()));
  api.fetchOrderDrivers.mockResolvedValue([]);
  api.fetchNegotiations.mockResolvedValue([negotiation()]);
  api.fetchCards.mockResolvedValue([{ id: CARD, mask: "•••• 4242", type: "credit" }]);
});

describe("Contratar motoboys", () => {
  it("lista os próximos serviços e abre o detalhe", async () => {
    mount(<ServicesScreen />);
    const upcoming = await screen.findByRole("list", { name: "Próximos serviços" });
    expect(within(upcoming).getByText("Aguardando motoboys")).toBeInTheDocument();
    expect(within(upcoming).getByText("1/2 vagas")).toBeInTheDocument();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do serviço" });
    expect(await within(panel).findByText("Detalhes do serviço")).toBeInTheDocument();
    expect(within(panel).getByText("R$ 50,00")).toBeInTheDocument();
    expect(api.fetchOrders).toHaveBeenCalledWith(expect.objectContaining({ status: ["service_started"] }), expect.anything());
  });

  it("pedido inválido em ?pedido= não chama a API", async () => {
    nav.search = "pedido=nao-e-uuid";
    mount(<ServicesScreen />);
    expect(await screen.findByText("Serviço não encontrado.")).toBeInTheDocument();
    expect(api.fetchOrder).not.toHaveBeenCalled();
  });

  it("vazio convida a solicitar o primeiro serviço", async () => {
    nav.search = "";
    api.fetchOrders.mockResolvedValue(list([]));
    mount(<ServicesScreen />);
    expect(await screen.findByText("Nenhum serviço ainda")).toBeInTheDocument();
  });

  it("só vira erro quando as duas consultas falham", async () => {
    nav.search = "";
    api.fetchOrders.mockImplementation(async (query: { status: string[] }) => {
      if (query.status.includes("service_started")) throw new ApiError({ status: 500 });
      return list([rawOrder()]);
    });
    mount(<ServicesScreen />);
    expect(await screen.findByRole("list", { name: "Próximos serviços" })).toBeInTheDocument();
  });

  it("proposta do motoboy: aceitar, recusar com confirmação e contrapropor", async () => {
    api.acceptNegotiation.mockResolvedValue(negotiation({ status: "accepted" }));
    api.rejectNegotiation.mockResolvedValue(negotiation({ status: "rejected" }));
    api.offerNegotiation.mockResolvedValue(negotiation());
    const { user } = mount(<ServicesScreen />);
    const panel = await screen.findByRole("complementary", { name: "Detalhe do serviço" });
    await user.click(await within(panel).findByRole("tab", { name: "Propostas" }));
    const proposals = await within(panel).findByRole("list", { name: "Propostas" });
    expect(within(proposals).getByText("+20% do anunciado")).toBeInTheDocument();

    await user.click(within(proposals).getByRole("button", { name: "Aceitar" }));
    await waitFor(() => expect(api.acceptNegotiation).toHaveBeenCalledWith(ID, NEG));

    await user.click(within(proposals).getByRole("button", { name: "Recusar" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Recusar proposta" })).getByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(api.rejectNegotiation).toHaveBeenCalledWith(ID, NEG));

    await user.click(within(proposals).getByRole("button", { name: "Fazer contraproposta" }));
    const dialog = await screen.findByRole("dialog", { name: "Fazer contraproposta" });
    await user.clear(within(dialog).getByLabelText("Valor fixo"));
    await user.click(within(dialog).getByRole("button", { name: "Enviar proposta" }));
    expect(within(dialog).getByText("Informe um valor fixo válido.")).toBeInTheDocument();
    expect(api.offerNegotiation).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText("Valor fixo"), "5500");
    await user.click(within(dialog).getByRole("button", { name: "Enviar proposta" }));
    await waitFor(() => expect(api.offerNegotiation).toHaveBeenCalledWith(ID, NEG, { value: "55.00", valuePerDelivery: null }));
  });

  it("quando a última oferta é da loja, só aguarda o motoboy (sem botões)", async () => {
    api.fetchNegotiations.mockResolvedValue([
      negotiation({ offers: [{ id: "of1", created_at: "2026-10-05T10:00:00Z", created_by: "establishment", status: "pending", value: "55.00" }] }),
    ]);
    const { user } = mount(<ServicesScreen />);
    const panel = await screen.findByRole("complementary", { name: "Detalhe do serviço" });
    await user.click(await within(panel).findByRole("tab", { name: "Propostas" }));
    expect(await within(panel).findByText("Aguardando resposta do motoboy")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Aceitar" })).toBeNull();
  });

  it("erro de negociação mostra o texto do catálogo, nunca o detail", async () => {
    api.acceptNegotiation.mockRejectedValue(new ApiError({ status: 409, code: "ORDER_POSITIONS_FULL" }));
    const { user } = mount(<ServicesScreen />);
    const panel = await screen.findByRole("complementary", { name: "Detalhe do serviço" });
    await user.click(await within(panel).findByRole("tab", { name: "Propostas" }));
    await user.click(await within(panel).findByRole("button", { name: "Aceitar" }));
    expect(await within(panel).findByText("As vagas deste pedido já foram preenchidas.")).toBeInTheDocument();
  });

  it("cancelar serviço pede confirmação; a 3 h do início some o botão", async () => {
    api.cancelOrder.mockResolvedValue(undefined);
    const { user } = mount(<ServicesScreen />);
    const panel = await screen.findByRole("complementary", { name: "Detalhe do serviço" });
    await user.click(await within(panel).findByRole("button", { name: "Cancelar serviço" }));
    const cancelDialog = await screen.findByRole("dialog", { name: "Cancelar serviço" });
    expect(cancelDialog).toHaveTextContent("não é devolvida automaticamente");
    expect(cancelDialog).toHaveTextContent("fale com o suporte");
    await user.click(within(cancelDialog).getByRole("button", { name: "Cancelar serviço" }));
    await waitFor(() => expect(api.cancelOrder).toHaveBeenCalledWith(ID));
  });

  it("serviço a menos de 3 h não pode ser cancelado por aqui", async () => {
    api.fetchOrder.mockResolvedValue(model.parseOrder(rawOrder({ start_date: future(1), end_date: future(3) })));
    mount(<ServicesScreen />);
    const panel = await screen.findByRole("complementary", { name: "Detalhe do serviço" });
    expect(await within(panel).findByText("O cancelamento só é possível até 3 horas antes do início do serviço.")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Cancelar serviço" })).toBeNull();
  });

  it("cancelado mostra o motivo conhecido e esconde o slug desconhecido", async () => {
    api.fetchOrder.mockResolvedValue(model.parseOrder(rawOrder({ status: "cancelled", cancellation_reason: "system:expired_no_drivers" })));
    mount(<ServicesScreen />);
    const panel = await screen.findByRole("complementary", { name: "Detalhe do serviço" });
    expect(await within(panel).findByText("Motivo: Nenhum motoboy aceitou o serviço até o horário de início.")).toBeInTheDocument();
  });

  it("pendente de pagamento mostra o pagamento da taxa, sem campo de cartão", async () => {
    api.fetchOrder.mockResolvedValue(model.parseOrder(rawOrder({ status: "pending_payment" })));
    mount(<ServicesScreen />);
    const panel = await screen.findByRole("complementary", { name: "Detalhe do serviço" });
    expect(await within(panel).findByText("Pagar a taxa de serviço")).toBeInTheDocument();
    expect(document.querySelector('[autocomplete="cc-number"]')).toBeNull();
  });
});

const pixPayment = (over: Record<string, unknown> = {}) =>
  model.parsePayment({ id: "p1", status: "pending", payment_method: "pix", amount: 5, copy_paste: "00020126pixcode", qr_code_base64: "iVBORw0KGgo=", expires_at: new Date(Date.now() + 600_000).toISOString(), ...over });

describe("pagamento da taxa (DN-25)", () => {
  const panel = () => mount(<PayPanel orderId={ID} userId="d0000001-0000-4000-8000-000000000001" fee="5.00" startDate={future(24)} />);

  it("PIX: QR em data:, copia-e-cola, e só vira pago pelo status da API", async () => {
    api.payOrder.mockResolvedValue(pixPayment());
    api.fetchPayment.mockResolvedValue(pixPayment());
    const { user } = panel();
    await user.click(await screen.findByRole("button", { name: "Pagar R$ 5,00" }));
    await waitFor(() => expect(api.payOrder).toHaveBeenCalledWith(ID, { method: "pix" }));
    const img = await screen.findByAltText("QR Code do PIX");
    expect(img.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    expect(screen.getByLabelText("PIX copia e cola")).toHaveValue("00020126pixcode");
    expect(screen.getByText(/Este código expira em \d\d:\d\d/)).toBeInTheDocument();
    // "Já fiz o pagamento" não confirma nada: só relê o status.
    await user.click(screen.getByRole("button", { name: "Já fiz o pagamento" }));
    expect(screen.queryByText("Pagamento confirmado")).toBeNull();
    api.fetchPayment.mockResolvedValue(pixPayment({ status: "paid", paid_at: new Date().toISOString() }));
    await user.click(screen.getByRole("button", { name: "Já fiz o pagamento" }));
    expect(await screen.findByText("Pagamento confirmado")).toBeInTheDocument();
  });

  it("PIX expirado pela API: mensagem fixa e opção de pagar de novo", async () => {
    api.payOrder.mockResolvedValue(pixPayment());
    api.fetchPayment.mockResolvedValue(pixPayment({ status: "expired" }));
    const { user } = panel();
    await user.click(await screen.findByRole("button", { name: "Pagar R$ 5,00" }));
    expect(await screen.findByText("Código expirado")).toBeInTheDocument();
    expect(screen.getByText("O prazo deste pagamento expirou. Gere uma nova cobrança para confirmar o pedido.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pagar novamente" })).toBeInTheDocument();
  });

  it("cartão já salvo: paga com bank_card_id e explica que cartão novo é só no app", async () => {
    api.payOrder.mockResolvedValue(model.parsePayment({ id: "p2", status: "processing", payment_method: "credit_card", amount: 5 }));
    api.fetchPayment.mockResolvedValue(model.parsePayment({ id: "p2", status: "processing", payment_method: "credit_card", amount: 5 }));
    const { user } = panel();
    await user.click(await screen.findByRole("radio", { name: /Cartão de crédito salvo/ }));
    expect(await screen.findByText("Para cadastrar um cartão novo, use o app Motoka. Os cartões salvos lá aparecem aqui.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar no Google Play" })).toBeInTheDocument();
    expect(document.querySelector('input[autocomplete="cc-number"], input[inputmode="numeric"][maxlength="19"]')).toBeNull();
    await user.click(await screen.findByRole("radio", { name: "Crédito · •••• 4242" }));
    await user.click(screen.getByRole("button", { name: "Pagar R$ 5,00" }));
    await waitFor(() => expect(api.payOrder).toHaveBeenCalledWith(ID, { method: "credit_card", bankCardId: CARD }));
    expect(await screen.findByText("Processando pagamento")).toBeInTheDocument();
  });

  it("cartão recusado mostra o texto por gateway_status, não o do provedor", async () => {
    api.payOrder.mockResolvedValue(model.parsePayment({ id: "p3", status: "failed", payment_method: "credit_card", amount: 5, payment_metadata: { gateway_status: "unpaid", reason: "RAW PROVIDER TEXT" } }));
    api.fetchPayment.mockResolvedValue(model.parsePayment({ id: "p3", status: "failed", payment_method: "credit_card", amount: 5, payment_metadata: { gateway_status: "unpaid", reason: "RAW PROVIDER TEXT" } }));
    const { user } = panel();
    await user.click(await screen.findByRole("radio", { name: /Cartão de crédito salvo/ }));
    await user.click(await screen.findByRole("radio", { name: "Crédito · •••• 4242" }));
    await user.click(screen.getByRole("button", { name: "Pagar R$ 5,00" }));
    expect(await screen.findByText(/O banco emissor não autorizou a cobrança/)).toBeInTheDocument();
    expect(screen.queryByText(/RAW PROVIDER TEXT/)).toBeNull();
  });

  it("erro ao criar o pagamento mostra o texto do catálogo", async () => {
    api.payOrder.mockRejectedValue(new ApiError({ status: 400, code: "ORDER_CANNOT_BE_PAID" }));
    const { user } = panel();
    await user.click(await screen.findByRole("button", { name: "Pagar R$ 5,00" }));
    expect(await screen.findByText("Este pedido não pode ser pago no momento.")).toBeInTheDocument();
  });

  it("início já passou: bloqueia o pagamento", async () => {
    mount(<PayPanel orderId={ID} userId="d0000001-0000-4000-8000-000000000001" fee="5.00" startDate={future(-1)} />);
    expect(await screen.findByText("Horário do serviço já passou")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pagar/ })).toBeNull();
  });
});

describe("Solicitar serviço", () => {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText("Data de início"), day(2));
    await user.type(screen.getByLabelText("Horário de início"), "10:00");
    await user.clear(screen.getByLabelText("Data de fim"));
    await user.type(screen.getByLabelText("Data de fim"), day(2));
    await user.type(screen.getByLabelText("Horário de fim"), "14:00");
    await user.type(screen.getByLabelText("Quantidade de motoboys"), "2");
    await user.selectOptions(screen.getByLabelText("Tipo de serviço"), "fixed_value");
    await user.type(screen.getByLabelText("Valor por motoboy"), "5000");
  }

  it("mostra erros de campo ao tentar enviar vazio", async () => {
    const { user } = mount(<NewServiceScreen />);
    await user.click(screen.getByRole("button", { name: "Solicitar" }));
    expect((await screen.findAllByText("Obrigatório")).length).toBeGreaterThan(0);
    expect(screen.getByText("Escolha o tipo de serviço")).toBeInTheDocument();
    expect(api.createOrder).not.toHaveBeenCalled();
  });

  it("prévia da API, confirmação, criação e pagamento da taxa", async () => {
    api.reviewOrder.mockResolvedValue(model.parseReview({ value: "50.00", total_value: "100.00", service_charge: "5.00", amount_to_pay: "5.00" }));
    api.createOrder.mockResolvedValue(model.parseOrder(rawOrder({ status: "pending_payment" })));
    const { user } = mount(<NewServiceScreen />);
    await fill(user);
    expect(await screen.findByText("R$ 100,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 5,00").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Solicitar" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirmar solicitação" });
    expect(dialog).toHaveTextContent("antecedência de 3hrs");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar solicitação" }));
    await waitFor(() => expect(api.createOrder).toHaveBeenCalledTimes(1));
    expect(api.createOrder.mock.calls[0]?.[0]).toMatchObject({ requestedDrivers: 2, type: "fixed_value", value: "50.00", pricePerDelivery: null });
    expect(await screen.findByText("Pagar a taxa de serviço")).toBeInTheDocument();
  });

  it("isenção (internal_fee 0 na resposta): pula o pagamento", async () => {
    api.reviewOrder.mockResolvedValue(model.parseReview({ value: "50.00", total_value: "100.00", service_charge: "0.00", amount_to_pay: "0.00" }));
    api.createOrder.mockResolvedValue(model.parseOrder(rawOrder({ status: "waiting_for_drivers", internal_fee: "0.00" })));
    const { user } = mount(<NewServiceScreen />);
    await fill(user);
    expect(await screen.findByText("Isento")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Solicitar" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Confirmar solicitação" })).getByRole("button", { name: "Confirmar solicitação" }));
    expect(await screen.findByText("Serviço solicitado com sucesso!")).toBeInTheDocument();
    expect(screen.queryByText("Pagar a taxa de serviço")).toBeNull();
  });

  it("erro da API no início vai para o campo, com o texto do catálogo", async () => {
    api.reviewOrder.mockResolvedValue(model.parseReview({ value: "50.00", total_value: "100.00", service_charge: "5.00", amount_to_pay: "5.00" }));
    api.createOrder.mockRejectedValue(new ApiError({ status: 400, code: "ORDER_START_DATE_EXPIRED" }));
    const { user } = mount(<NewServiceScreen />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Solicitar" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Confirmar solicitação" })).getByRole("button", { name: "Confirmar solicitação" }));
    expect(await screen.findByText(/O horário de início deste serviço já passou/)).toBeInTheDocument();
  });
});
