import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { establishmentUser } from "../helpers";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/avisos/",
  useSearchParams: () => new URLSearchParams(""),
}));

const sessionState = vi.hoisted(() => ({ current: null as unknown }));
const http = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => ({ subscribe: () => () => undefined, getState: () => sessionState.current, logout: vi.fn() }),
  apiFetch: (path: string, init?: unknown) => http.fetch(path, init),
}));
vi.mock("@/features/deliveries/viacep", () => ({ lookupZip: vi.fn(async () => ({ street: "Rua Chile", neighborhood: "Rebouças", city: "Curitiba", state: "PR" })) }));

const { NoticesScreen } = await import("@/features/notices/NoticesScreen");
const { PhoneEditor, AddressEditor, CardsSection, maskPhone, validateAddress } = await import("@/features/account/AccountEdit");
const { ToastProvider } = await import("@/ui/Toast");
const { targetOf, relativeTime } = await import("@/features/notices/logic");
const { parseNoticeList } = await import("@/features/notices/model");

const ORDER = "a0000001-0000-4000-8000-000000000001";
const NEG = "b0000001-0000-4000-8000-000000000001";
const USER = "d0000001-0000-4000-8000-000000000001";

function mount(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
  return { user };
}

const notice = (over: Record<string, unknown> = {}) => ({
  id: "e0000001-0000-4000-8000-000000000001",
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  type: "negotiation_new_offer",
  title: "Nova proposta",
  body: "Diego fez uma contraproposta",
  is_read: false,
  data: { order_id: ORDER, negotiation_id: NEG },
  ...over,
});

beforeEach(() => {
  sessionState.current = { status: "authenticated", user: establishmentUser(USER) };
  nav.push.mockReset();
  http.fetch.mockReset();
});

describe("Avisos", () => {
  it("destino por tipo, só com ids em UUID", () => {
    const parse = (raw: Record<string, unknown>) => parseNoticeList({ items: [raw] }).items[0]!;
    expect(targetOf(parse(notice()))).toBe(`/servicos/?pedido=${ORDER}&proposta=${NEG}`);
    expect(targetOf(parse(notice({ type: "settlement_disputed", data: { settlement_id: ORDER } })))).toBe(`/acertos/?acerto=${ORDER}`);
    expect(targetOf(parse(notice({ type: "delivery_problem", data: { delivery_id: ORDER } })))).toBe(`/pedidos/?pedido=${ORDER}`);
    expect(targetOf(parse(notice({ type: "team_member_joined", data: {} })))).toBe("/equipe/");
    expect(targetOf(parse(notice({ data: { order_id: "../../x" } })))).toBeNull();
    expect(targetOf(parse(notice({ type: "algo_novo", data: {} })))).toBeNull();
  });

  it("tempo relativo", () => {
    const now = new Date("2026-10-05T15:00:00Z");
    expect(relativeTime("2026-10-05T14:59:40Z", now)).toBe("Agora");
    expect(relativeTime("2026-10-05T14:55:00Z", now)).toBe("5 min atrás");
    expect(relativeTime("2026-10-05T12:00:00Z", now)).toBe("3 horas atrás");
    expect(relativeTime("2026-10-04T21:00:00Z", now)).toBe("Ontem, 18:00");
  });

  it("lista, marca como lido ao tocar e abre o destino", async () => {
    http.fetch.mockImplementation(async (path: string) => {
      if (path === "/notifications") return { total: 2, items: [notice(), notice({ id: "e0000002-0000-4000-8000-000000000002", is_read: true, title: "Já lido", type: "algo_novo", data: {} })] };
      if (path === "/notifications/unread-count") return { count: 1 };
      return {};
    });
    const { user } = mount(<NoticesScreen />);
    const list = await screen.findByRole("list", { name: "Avisos" });
    expect(await screen.findByText("Você tem 1 aviso não lido")).toBeInTheDocument();
    expect(within(list).getByText("Já lido")).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: /Nova proposta/ }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/notifications/e0000001-0000-4000-8000-000000000001/read", expect.objectContaining({ method: "PATCH" })));
    expect(nav.push).toHaveBeenCalledWith(`/servicos/?pedido=${ORDER}&proposta=${NEG}`);
  });

  it("filtro Não lidos e Marcar todos como lidos", async () => {
    http.fetch.mockImplementation(async (path: string, init?: { query?: Record<string, unknown> }) => {
      if (path === "/notifications") return { total: 1, items: [notice()], echo: init?.query?.is_read };
      if (path === "/notifications/unread-count") return { count: 3 };
      return { updated: 3 };
    });
    const { user } = mount(<NoticesScreen />);
    await screen.findByRole("list", { name: "Avisos" });
    await user.click(screen.getByRole("button", { name: "Não lidos" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/notifications", expect.objectContaining({ query: expect.objectContaining({ is_read: false }) })));
    await user.click(screen.getByRole("button", { name: "Marcar todos como lidos" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/notifications/read-all", expect.objectContaining({ method: "POST" })));
  });

  it("vazio e erro", async () => {
    http.fetch.mockImplementation(async (path: string) => (path === "/notifications" ? { total: 0, items: [] } : { count: 0 }));
    mount(<NoticesScreen />);
    expect(await screen.findByText("Sem avisos")).toBeInTheDocument();
  });

  it("erro ao marcar como lido mostra o texto do catálogo", async () => {
    http.fetch.mockImplementation(async (path: string) => {
      if (path === "/notifications") return { total: 1, items: [notice()] };
      if (path === "/notifications/unread-count") return { count: 1 };
      throw new ApiError({ status: 404, code: "NOTIFICATION_NOT_FOUND" });
    });
    const { user } = mount(<NoticesScreen />);
    await user.click(await screen.findByRole("button", { name: /Nova proposta/ }));
    expect(await screen.findByText("Notificação não encontrada.")).toBeInTheDocument();
  });
});

describe("Conta: contato, endereço e cartões", () => {
  it("máscara e validação do telefone e do endereço", () => {
    expect(maskPhone("11977776666")).toBe("(11) 97777-6666");
    expect(validateAddress({ postalCode: "80", street: "", number: "1a", complement: "", neighborhood: "", city: "", state: "P" })).toMatchObject({
      postalCode: "Insira um CEP válido",
      city: "Informe a cidade",
      state: "Informe a UF",
      street: "Informe o endereço",
      neighborhood: "Informe o bairro",
      number: "Informe apenas números",
    });
  });

  it("telefone: celular com DDD e 9 dígitos; envia só os dígitos", async () => {
    http.fetch.mockResolvedValue(undefined);
    const { user } = mount(<PhoneEditor userId={USER} current="11977776666" />);
    const field = screen.getByLabelText("Telefone");
    await user.clear(field);
    await user.type(field, "1133334444");
    await user.click(screen.getByRole("button", { name: "Salvar telefone" }));
    expect(await screen.findByText("Informe um celular com DDD e 9 dígitos.")).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, "41988887777");
    await user.click(screen.getByRole("button", { name: "Salvar telefone" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith(`/users/${USER}`, expect.objectContaining({ method: "PATCH", body: { type: "establishment", phone: "41988887777" } })));
  });

  it("endereço: carrega, busca CEP e salva", async () => {
    http.fetch.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === "PUT") return { postal_code: "80000000", street: "Rua Chile", number: 1880, neighborhood: "Rebouças", city: "Curitiba", state: "PR" };
      return { postal_code: "80000-000", street: "Rua A", number: 10, neighborhood: "Centro", city: "Curitiba", state: "PR" };
    });
    const { user } = mount(<AddressEditor userId={USER} />);
    const zip = await screen.findByLabelText("CEP");
    await user.clear(zip);
    await user.type(zip, "80230000");
    await waitFor(() => expect(screen.getByLabelText("Endereço")).toHaveValue("Rua Chile"));
    await user.click(screen.getByRole("button", { name: "Salvar endereço" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith(`/users/${USER}/address`, expect.objectContaining({ method: "PUT", body: expect.objectContaining({ postal_code: "80230000", number: 10, state: "PR" }) })));
  });

  it("cartões: lista, exclui com confirmação, e explica que cartão novo é só no app", async () => {
    http.fetch.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === "DELETE") return undefined;
      return { count: 1, items: [{ id: "c0000001-0000-4000-8000-000000000001", mask: "•••• 4242", type: "credit" }] };
    });
    const { user } = mount(<CardsSection userId={USER} />);
    const list = await screen.findByRole("list", { name: "Cartões salvos" });
    expect(within(list).getByText("Crédito · •••• 4242")).toBeInTheDocument();
    expect(screen.getByText("Para cadastrar um cartão novo, use o app Motoka. Os cartões salvos lá aparecem aqui.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cadastrar/ })).toBeNull();
    await user.click(within(list).getByRole("button", { name: "Excluir" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Excluir cartão" })).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith(`/users/${USER}/bank-cards/c0000001-0000-4000-8000-000000000001`, expect.objectContaining({ method: "DELETE" })));
  });
});
