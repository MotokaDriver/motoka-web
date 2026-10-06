import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { resetOverlays } from "@/ui/overlays";
import { establishmentUser } from "../helpers";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, prefetch: vi.fn() }),
  usePathname: () => "/pedidos/",
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
  fetchList: vi.fn(),
  fetchDelivery: vi.fn(),
  lookupCustomer: vi.fn(),
  markReady: vi.fn(),
  retryDelivery: vi.fn(),
  confirmReturn: vi.fn(),
  cancelDelivery: vi.fn(),
  confirmDelivery: vi.fn(),
  assignDriver: vi.fn(),
  updateAddress: vi.fn(),
  unassignDriver: vi.fn(),
  afterCancelAck: vi.fn(),
  trackingLinkSent: vi.fn(),
  createDelivery: vi.fn(),
  PAGE_SIZE: 100,
}));
vi.mock("@/features/deliveries/api", () => api);

const teamApi = vi.hoisted(() => ({ fetchOnShift: vi.fn() }));
vi.mock("@/features/team/api", () => teamApi);

const viacep = vi.hoisted(() => ({ searchStreet: vi.fn(), lookupZip: vi.fn() }));
vi.mock("@/features/deliveries/viacep", () => viacep);

const { DeliveriesScreen } = await import("@/features/deliveries/DeliveriesScreen");
const { ShortcutsProvider } = await import("@/features/shell/ShortcutsProvider");
const { ToastProvider } = await import("@/ui/Toast");
const model = await import("@/features/deliveries/model");

const ID1 = "e0000001-0000-4000-8000-000000000001";
const ID2 = "e0000002-0000-4000-8000-000000000002";
const NOW = new Date().toISOString();

const rawItem = (over: Record<string, unknown> = {}) => ({
  id: ID1,
  number: 184,
  origin: "manual",
  channel: "whatsapp",
  status: "preparing",
  customer: { name: "Lucas Ferraz", address_line: "Rua Chile, 1880", neighborhood: "Rebouças" },
  driver: null,
  tracking: { mode: "motoka", sent_at: null, opened_count: 0, expired: false },
  cancellation: null,
  problem: null,
  code_locked: false,
  geocode_status: "ok",
  needs_attention: false,
  created_at: NOW,
  ...over,
});

const rawDetail = (over: Record<string, unknown> = {}) => ({
  ...rawItem(),
  customer: { name: "Lucas Ferraz", phone: "5541996401177", phone_localizer: null, address: { street: "Rua Chile", number: "1880", neighborhood: "Rebouças", city: "Curitiba", state: "PR" } },
  payment: { type: "offline", method: "cash", amount_to_collect: "41.00", change_for: "50.00" },
  code: { mode: "motoka", value: "4821", failed_attempts: 0, locked: false },
  tracking_url: `${location.origin}/r/#tok`,
  flags: { delivered_after_cancel: false, late_pickup: false },
  after_cancel: null,
  events: [{ seq: 1, type: "created", to_status: "preparing", actor: "establishment", recorded_at: NOW }],
  ...over,
});

function setupList(items: Array<Record<string, unknown>>, counts = { open: items.length, all: items.length }) {
  api.fetchList.mockImplementation(async () => model.parseList({ total: items.length, items, counts }));
  api.fetchDelivery.mockImplementation(async (id: string) => {
    const found = items.find((i) => i.id === id) ?? rawItem({ id });
    return model.parseDetail({ ...rawDetail(), ...found, customer: rawDetail().customer });
  });
}

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ShortcutsProvider>
          <DeliveriesScreen />
        </ShortcutsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, queryClient, view };
}

beforeEach(() => {
  sessionState.current = { status: "authenticated", user: establishmentUser() };
  resetOverlays();
  nav.replace.mockReset();
  nav.search = "";
  for (const fn of Object.values(api)) if (typeof fn === "function" && "mockReset" in fn) (fn as { mockReset: () => void }).mockReset();
  teamApi.fetchOnShift.mockReset().mockResolvedValue([]);
  viacep.searchStreet.mockReset().mockResolvedValue([]);
  viacep.lookupZip.mockReset().mockResolvedValue(null);
});

describe("lista", () => {
  it("mostra contadores, marcador de atenção, dia anterior, TrackCell e 'sem' motoboy", async () => {
    setupList([
      rawItem({ needs_attention: true }),
      rawItem({ id: ID2, number: 183, origin: "ifood", channel: null, status: "on_the_way", created_at: "2026-10-01T15:00:00Z", driver: { id: "d1", short_name: "Diego R.", initials: "DR" }, tracking: { mode: "none", sent_at: null, opened_count: 0, expired: false } }),
    ]);
    mount();
    expect(await screen.findByRole("button", { name: "Em aberto 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Todos 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pedido 184, precisa da sua atenção/ })).toBeInTheDocument();
    expect(screen.getByText("link não enviado")).toBeInTheDocument();
    expect(screen.getByText("cliente vê no iFood")).toBeInTheDocument();
    expect(screen.getByText("01/10 12:00")).toBeInTheDocument();
    expect(screen.getByText("sem")).toBeInTheDocument();
    expect(api.fetchList.mock.calls[0]?.[0]).toMatchObject({ scope: "open" });
    expect(screen.getByText("Selecione um pedido para ver os detalhes.")).toBeInTheDocument();
  });

  it("'Em aberto' nunca manda date; 'Todos' manda o dia de SP", async () => {
    nav.search = "filtro=todos";
    setupList([rawItem()]);
    mount();
    await screen.findByRole("button", { name: "Todos 1" });
    expect(api.fetchList.mock.calls[0]?.[0]).toMatchObject({ scope: "all", date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it("'Mostrar mais' pede a próxima página por offset", async () => {
    const page = (start: number, count: number) =>
      Array.from({ length: count }, (_, i) =>
        rawItem({ id: `e${String(start + i).padStart(7, "0")}-0000-4000-8000-000000000000`, number: start + i }),
      );
    api.fetchList.mockImplementation(async (params: { offset?: number }) =>
      model.parseList({ total: 150, items: params.offset ? page(1000, 50) : page(1, 100), counts: { open: 150, all: 150 } }),
    );
    const { user } = mount();
    const more = await screen.findByRole("button", { name: "Mostrar mais" });
    await user.click(more);
    await waitFor(() => expect(api.fetchList.mock.calls.some((c) => c[0].offset === 100)).toBe(true));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mostrar mais" })).toBeNull());
  });

  it("vazio hoje e vazio em aberto", async () => {
    setupList([], { open: 0, all: 0 });
    const { view } = mount();
    expect(await screen.findByText("Nenhum pedido hoje")).toBeInTheDocument();
    view.unmount();
    setupList([], { open: 0, all: 3 });
    mount();
    expect(await screen.findByText("Nenhum pedido em aberto agora.")).toBeInTheDocument();
  });

  it("?pedido= inválido não chama a API do detalhe", async () => {
    nav.search = "pedido=nao-e-uuid";
    setupList([rawItem()]);
    mount();
    expect(await screen.findByText("Pedido não encontrado.")).toBeInTheDocument();
    expect(api.fetchDelivery).not.toHaveBeenCalled();
  });

  it("atalhos 2, j e n", async () => {
    setupList([rawItem(), rawItem({ id: ID2, number: 183 })]);
    const { user } = mount();
    await screen.findByRole("button", { name: "Em aberto 2" });
    await user.keyboard("2");
    expect(nav.replace).toHaveBeenLastCalledWith("/pedidos/?filtro=todos");
    await user.keyboard("j");
    expect(nav.replace).toHaveBeenLastCalledWith(`/pedidos/?pedido=${ID1}`);
    await user.keyboard("n");
    expect(await screen.findByRole("dialog", { name: "Novo pedido" })).toBeInTheDocument();
  });
});

describe("painel do pedido", () => {
  it("manual: link, mensagem antes da retirada, WhatsApp e E11 ao clicar", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem()]);
    api.trackingLinkSent.mockResolvedValue(undefined);
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    expect(await within(panel).findByText("Cobrar R$ 41,00 · dinheiro · troco para R$ 50,00")).toBeInTheDocument();
    expect(within(panel).getByText("4821")).toBeInTheDocument();
    expect(within(panel).getByText(/Seu pedido #184 da .* está sendo preparado\./)).toBeInTheDocument();
    const link = within(panel).getByRole("link", { name: /Enviar pelo WhatsApp/ });
    expect(link).toHaveAttribute("href", expect.stringContaining("https://wa.me/5541996401177?text="));
    link.addEventListener("click", (e) => e.preventDefault());
    await user.click(link);
    await waitFor(() => expect(api.trackingLinkSent).toHaveBeenCalledWith(ID1));
    expect(await within(panel).findByRole("link", { name: "Enviado" })).toBeInTheDocument();
  });

  it("iFood: sem WhatsApp, e nota de onde cancelar", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem({ origin: "ifood", channel: null, tracking: { mode: "none", sent_at: null, opened_count: 0, expired: false } })]);
    mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    expect(await within(panel).findByText(/O cliente acompanha pelo app do iFood/)).toBeInTheDocument();
    expect(within(panel).queryByText("Enviar pelo WhatsApp")).toBeNull();
    expect(within(panel).queryByRole("link", { name: /WhatsApp/ })).toBeNull();
    expect(within(panel).getByText("Cancele no iFood; o Motoka atualiza sozinho.")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Cancelar pedido" })).toBeNull();
  });

  it("link de rastreio de outro host não é mostrado", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem()]);
    api.fetchDelivery.mockImplementation(async () => model.parseDetail(rawDetail({ tracking_url: "https://evil.example/r/#x" })));
    mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    expect(await within(panel).findByText("Não foi possível gerar o link agora.")).toBeInTheDocument();
    expect(within(panel).queryByTestId("tracking-url")).toBeNull();
  });

  it("geocode not_configured não alerta; failed alerta", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem({ geocode_status: "not_configured" })]);
    const { view } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    await within(panel).findByText("Pagamento");
    expect(within(panel).queryByRole("alert")).toBeNull();
    view.unmount();
    setupList([rawItem({ geocode_status: "failed" })]);
    mount();
    expect(await screen.findByText("Não encontramos este endereço no mapa. Confira o número e a rua.")).toBeInTheDocument();
  });

  it("cancelar: motivo obrigatório; erro de rede reaproveita o mesmo action_id", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem()]);
    api.cancelDelivery.mockRejectedValueOnce(new ApiError({ status: null })).mockResolvedValue(model.parseDetail(rawDetail({ status: "cancelled" })));
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    await user.click(await within(panel).findByRole("button", { name: "Cancelar pedido" }));
    const dialog = await screen.findByRole("dialog", { name: "Cancelar o pedido #184?" });
    expect(within(dialog).getByRole("button", { name: "Cancelar pedido" })).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: "Cliente desistiu" }));
    await user.click(within(dialog).getByRole("button", { name: "Cancelar pedido" }));
    expect(await within(dialog).findByText(/Não foi possível conectar ao Motoka/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar pedido" }));
    await waitFor(() => expect(api.cancelDelivery).toHaveBeenCalledTimes(2));
    const [first, second] = api.cancelDelivery.mock.calls;
    expect(first?.[1]).toBe(second?.[1]);
    expect(first?.[2]).toBe("Cliente desistiu");
    expect(await screen.findByText("Pedido #184 cancelado.")).toBeInTheDocument();
  });

  it("502 da Cloudflare mantém o action_id; 429 também; resposta definitiva descarta", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem()]);
    const ok = model.parseDetail(rawDetail({ status: "ready" }));
    api.markReady
      .mockRejectedValueOnce(new ApiError({ status: 502 }))
      .mockRejectedValueOnce(new ApiError({ status: 429, code: "RATE_LIMIT_EXCEEDED" }))
      .mockRejectedValueOnce(new ApiError({ status: 409, code: "DELIVERY_INVALID_TRANSITION" }))
      .mockResolvedValue(ok);
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    const button = () => within(panel).getByRole("button", { name: "Pronto para retirar" });
    await user.click(await within(panel).findByRole("button", { name: "Pronto para retirar" }));
    await waitFor(() => expect(api.markReady).toHaveBeenCalledTimes(1));
    await user.click(button());
    await waitFor(() => expect(api.markReady).toHaveBeenCalledTimes(2));
    await user.click(button());
    await waitFor(() => expect(api.markReady).toHaveBeenCalledTimes(3));
    await user.click(button());
    await waitFor(() => expect(api.markReady).toHaveBeenCalledTimes(4));
    const ids = api.markReady.mock.calls.map((c) => c[1]);
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).toBe(ids[0]);
    // O 409 é definitivo: o toque seguinte nasce com action_id novo.
    expect(ids[3]).not.toBe(ids[0]);
  });

  it("Corrigir endereço (E10): só com geocode failed e antes da retirada, envia o PUT com action_id", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem({ geocode_status: "failed" })]);
    api.updateAddress.mockResolvedValue(model.parseDetail(rawDetail({ geocode_status: "ok" })));
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    await user.click(await within(panel).findByRole("button", { name: "Corrigir endereço" }));
    const dialog = await screen.findByRole("dialog", { name: "Corrigir endereço" });
    expect(within(dialog).getByLabelText("Rua")).toHaveValue("Rua Chile");
    await user.clear(within(dialog).getByLabelText("Número"));
    await user.type(within(dialog).getByLabelText("Número"), "1900");
    await user.click(within(dialog).getByRole("button", { name: "Salvar endereço" }));
    await waitFor(() => expect(api.updateAddress).toHaveBeenCalled());
    expect(api.updateAddress.mock.calls[0]).toEqual([ID1, expect.any(String), expect.objectContaining({ street: "Rua Chile", number: "1900", city: "Curitiba", state: "PR" })]);
    expect(await screen.findByText("Endereço corrigido.")).toBeInTheDocument();
  });

  it("depois da retirada o geocode failed não oferece corrigir", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem({ geocode_status: "failed", status: "on_the_way" })]);
    mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    expect(await within(panel).findByText(/Não encontramos este endereço/)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Corrigir endereço" })).toBeNull();
  });

  it("erro de negócio usa texto fixo e o toque seguinte gera action_id novo", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem()]);
    api.markReady.mockRejectedValueOnce(new ApiError({ status: 409, code: "DELIVERY_CANCELLED" })).mockResolvedValue(model.parseDetail(rawDetail({ status: "ready" })));
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    await user.click(await within(panel).findByRole("button", { name: "Pronto para retirar" }));
    expect(await within(panel).findByText("Este pedido foi cancelado. A tela foi atualizada.")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Pronto para retirar" }));
    await waitFor(() => expect(api.markReady).toHaveBeenCalledTimes(2));
    expect(api.markReady.mock.calls[0]?.[1]).not.toBe(api.markReady.mock.calls[1]?.[1]);
  });

  it("atribuir: sugestão primeiro e turno não iniciado", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem({ suggested_driver: { id: "e1111111-1111-4111-8111-111111111112", short_name: "Rafa L." } })]);
    teamApi.fetchOnShift.mockResolvedValue([
      { membershipId: "m1", driver: { id: "e1111111-1111-4111-8111-111111111111", shortName: "Diego R.", initials: "DR" }, shiftId: "s", endsAt: null, sessionStarted: false },
      { membershipId: "m2", driver: { id: "e1111111-1111-4111-8111-111111111112", shortName: "Rafa L.", initials: "RL" }, shiftId: "s", endsAt: null, sessionStarted: true },
    ]);
    api.assignDriver.mockResolvedValue(model.parseDetail(rawDetail({ driver: { id: "e1111111-1111-4111-8111-111111111112", short_name: "Rafa L.", initials: "RL" } })));
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    const select = await within(panel).findByLabelText("Motoboy em turno");
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(3));
    const labels = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual(["Escolha o motoboy", "Rafa L. · sugestão", "Diego R. · turno não iniciado"]);
    // Sem sessão de turno aberta (DW-41) a opção fica desabilitada, e o motivo aparece.
    expect(within(select).getByRole("option", { name: "Diego R. · turno não iniciado" })).toBeDisabled();
    expect(within(select).getByRole("option", { name: "Rafa L. · sugestão" })).toBeEnabled();
    expect(within(panel).getByText(/Só recebe pedido quem já abriu o turno no app/)).toBeInTheDocument();
    await user.selectOptions(select, "e1111111-1111-4111-8111-111111111112");
    await user.click(within(panel).getByRole("button", { name: "Atribuir" }));
    await waitFor(() => expect(api.assignDriver).toHaveBeenCalledWith(ID1, expect.any(String), "e1111111-1111-4111-8111-111111111112"));
  });

  it("sem ninguém em turno: link para Minha equipe", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem()]);
    mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    expect(await within(panel).findByText("Adicione um turno em Minha equipe.")).toHaveAttribute("href", expect.stringMatching(/^.equipe.?$/));
  });

  it("entregue depois de cancelado: 'Houve cobrança?' (E15) e registro", async () => {
    nav.search = `pedido=${ID1}`;
    setupList([rawItem({ status: "delivered" })]);
    const flags = { delivered_after_cancel: true, late_pickup: false };
    let acked = false;
    api.fetchDelivery.mockImplementation(async () =>
      model.parseDetail(rawDetail({ status: "delivered", flags, after_cancel: acked ? { acknowledged_at: NOW, charged: true, charged_amount: "58.00" } : null })),
    );
    api.afterCancelAck.mockImplementation(async () => {
      acked = true;
      return model.parseDetail(rawDetail({ status: "delivered", flags, after_cancel: { acknowledged_at: NOW, charged: true, charged_amount: "58.00" } }));
    });
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do pedido" });
    expect(await within(panel).findByText(/Houve cobrança do cliente\?/)).toBeInTheDocument();
    await user.type(within(panel).getByLabelText("Valor cobrado (se houve)"), "5800");
    await user.click(within(panel).getByRole("button", { name: "Sim, houve cobrança" }));
    await waitFor(() => expect(api.afterCancelAck).toHaveBeenCalledWith(ID1, true, "58.00"));
    expect(await within(panel).findByText("Registrado: houve cobrança de R$ 58,00.")).toBeInTheDocument();
  });
});

describe("novo pedido", () => {
  const openDrawer = async () => {
    setupList([]);
    const ctx = mount();
    await screen.findByText("Nenhum pedido hoje");
    await ctx.user.click(screen.getAllByRole("button", { name: "Novo pedido" })[0]!);
    const drawer = await screen.findByRole("dialog", { name: "Novo pedido" });
    return { ...ctx, drawer };
  };

  it("lookup com debounce de 300 ms, até 3 endereços, escolhe e envia coordenadas", async () => {
    api.lookupCustomer.mockResolvedValue(
      model.parseLookup({
        phone: "41996401177",
        name: "Lucas Ferraz",
        addresses: [1, 2, 3, 4].map((n) => ({ street: `Rua ${n}`, number: String(n), neighborhood: "Centro", city: "Curitiba", state: "PR", zip_code: null, complement: null, reference: null, location: { lat: -25.4, lng: -49.2 }, last_used_at: "2026-10-03T12:00:00Z" })),
      }),
    );
    api.createDelivery.mockResolvedValue(model.parseDetail(rawDetail()));
    const { user, drawer } = await openDrawer();
    await user.type(within(drawer).getByLabelText("Celular"), "41996401177");
    expect(api.lookupCustomer).not.toHaveBeenCalled();
    await waitFor(() => expect(api.lookupCustomer).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(api.lookupCustomer.mock.calls[0]?.[0]).toBe("41996401177");
    expect(await within(drawer).findByLabelText("Cliente", { exact: true })).toHaveValue("Lucas Ferraz");
    const options = within(drawer).getAllByRole("radio");
    expect(options).toHaveLength(4); // 3 endereços + "Outro endereço"
    await user.click(within(drawer).getByRole("radio", { name: /Rua 2, 2/ }));
    expect(within(drawer).getByLabelText("Rua", { exact: true })).toHaveValue("Rua 2");
    await user.click(within(drawer).getByRole("button", { name: "Cobrar na entrega" }));
    await user.type(within(drawer).getByLabelText("Valor a cobrar"), "5800");
    await user.click(within(drawer).getByRole("button", { name: "Criar pedido" }));
    await waitFor(() => expect(api.createDelivery).toHaveBeenCalled());
    expect(api.createDelivery.mock.calls[0]?.[0].address).toMatchObject({ street: "Rua 2", lat: -25.4, lng: -49.2, city: "Curitiba", state: "PR" });
    expect(await screen.findByText("Pedido #184 criado.")).toBeInTheDocument();
  });

  it("429 do lookup é silencioso e o preenchimento segue livre", async () => {
    api.lookupCustomer.mockRejectedValue(new ApiError({ status: 429, code: "RATE_LIMIT_EXCEEDED" }));
    const { user, drawer } = await openDrawer();
    await user.type(within(drawer).getByLabelText("Celular"), "41996401177");
    await waitFor(() => expect(api.lookupCustomer).toHaveBeenCalled(), { timeout: 2000 });
    expect(within(drawer).queryByRole("alert")).toBeNull();
    expect(within(drawer).getByLabelText("Rua", { exact: true })).toBeEnabled();
  });

  it("editar o endereço depois de escolher descarta as coordenadas", async () => {
    api.lookupCustomer.mockResolvedValue(
      model.parseLookup({ phone: "x", name: "L", addresses: [{ street: "Rua 1", number: "1", neighborhood: "Centro", city: "Curitiba", state: "PR", zip_code: null, complement: null, reference: null, location: { lat: -25.4, lng: -49.2 }, last_used_at: null }] }),
    );
    api.createDelivery.mockResolvedValue(model.parseDetail(rawDetail()));
    const { user, drawer } = await openDrawer();
    await user.type(within(drawer).getByLabelText("Celular"), "41996401177");
    await user.click(await within(drawer).findByRole("radio", { name: /Rua 1, 1/ }));
    await user.type(within(drawer).getByLabelText("Número", { exact: true }), "0");
    await user.click(within(drawer).getByRole("button", { name: "Cobrar na entrega" }));
    await user.type(within(drawer).getByLabelText("Valor a cobrar"), "1000");
    await user.click(within(drawer).getByRole("button", { name: "Criar pedido" }));
    await waitFor(() => expect(api.createDelivery).toHaveBeenCalled());
    expect(api.createDelivery.mock.calls[0]?.[0].address).toMatchObject({ number: "10", lat: null, lng: null });
  });

  it("balcão sem celular: sem link de rastreio; erros por campo; mesmo client_request_id ao repetir", async () => {
    api.createDelivery
      .mockRejectedValueOnce(new ApiError({ status: 400, code: "DELIVERY_CUSTOMER_PHONE_REQUIRED" }))
      .mockResolvedValue(model.parseDetail(rawDetail()));
    const { user, drawer } = await openDrawer();
    await user.click(within(drawer).getByRole("button", { name: "Balcão" }));
    const tracking = within(drawer).getByRole("switch", { name: /Mandar link de rastreio/ });
    expect(tracking).toHaveAttribute("aria-disabled", "true");
    expect(within(drawer).getByText("Sem celular, não dá para mandar o link.")).toBeInTheDocument();
    await user.type(within(drawer).getByLabelText("Cliente", { exact: true }), "Zé");
    await user.type(within(drawer).getByLabelText("Rua", { exact: true }), "Rua A");
    await user.type(within(drawer).getByLabelText("Número", { exact: true }), "5");
    await user.type(within(drawer).getByLabelText("Bairro"), "Centro");
    await user.click(within(drawer).getByRole("button", { name: "Cobrar na entrega" }));
    await user.type(within(drawer).getByLabelText("Valor a cobrar"), "1000");
    await user.click(within(drawer).getByRole("button", { name: "Criar pedido" }));
    expect(await within(drawer).findByText("Informe o celular do cliente.")).toBeInTheDocument();
    await user.click(within(drawer).getByRole("button", { name: "Criar pedido" }));
    await waitFor(() => expect(api.createDelivery).toHaveBeenCalledTimes(2));
    const [a, b] = api.createDelivery.mock.calls.map((c) => c[0]);
    expect(a.clientRequestId).toBe(b.clientRequestId);
    expect(b.sendTrackingLink).toBe(false);
    expect(b.customerPhone).toBeNull();
  });
});
