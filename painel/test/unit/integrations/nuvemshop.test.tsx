import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, prefetch: vi.fn() }),
  usePathname: () => "/integracoes/",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const http = vi.hoisted(() => ({ fetch: vi.fn() }));
const sessionState = vi.hoisted(() => ({ current: { status: "authenticated" } as { status: string } }));
vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => ({ subscribe: () => () => undefined, getState: () => sessionState.current }),
  apiFetch: (path: string, init?: unknown) => http.fetch(path, init),
}));

const { IntegrationsScreen } = await import("@/features/integrations/IntegrationsScreen");
const { OauthReturn } = await import("@/features/integrations/OauthReturn");
const { PartnerReturn } = await import("@/features/integrations/PartnerReturn");
const { parseShippingSettings } = await import("@/features/integrations/api");
const { parseDetail } = await import("@/features/integrations/model");
const { maskCep, parseCities, toForm, toSettings, validateSettings, CACHE_NOTICE } = await import("@/features/integrations/NuvemshopSettings");
const { savePendingOauth } = await import("@/lib/prefs/prefs");
const { ToastProvider } = await import("@/ui/Toast");

const STATE = "estado-nuvemshop-1234567890abcdef";
const AUTHORIZE = `https://www.tiendanube.com/apps/123/authorize?state=${STATE}`;

const cards = (nv: Record<string, unknown>) =>
  [
    { type: "open_delivery", status: "available", state: null },
    { type: "cardapio_web", status: "available", state: null },
    { type: "ifood", status: "soon", state: null },
    { type: "nuvemshop", status: "available", state: null, ...nv },
  ].map((c) => ({ last_outbound_ok_at: null, needs_attention: false, ...c }));

const detail = (over: Record<string, unknown> = {}) => ({
  type: "nuvemshop",
  status: "connected",
  state: "connected",
  external_merchant_id: "1234567",
  webhook_url: null,
  delivery_price: "0.00",
  operator_base_url: "",
  token_url: "",
  client_id: null,
  secret_hint: null,
  credential_version: 0,
  credential_rotated_at: null,
  health: { last_token_at: null, last_inbound_at: null, last_outbound_ok_at: null, pending_events: 0, dead_events_24h: 0 },
  ...over,
});

const settings = (over: Record<string, unknown> = {}) => ({
  price: "9.90",
  eta_minutes: 60,
  cep_ranges: [["80000000", "82999999"]],
  cities: ["Curitiba"],
  active: false,
  open_from: null,
  open_until: null,
  notice: "texto do servidor que não vai para a tela",
  ...over,
});

type Route = (init?: { method?: string; body?: Record<string, unknown> }) => unknown;
function serve(routes: Record<string, Route>) {
  http.fetch.mockImplementation(async (path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
    const route = routes[`${init?.method ?? "GET"} ${path}`];
    if (!route) {
      if (path === "/integrations/activity") return { items: [], next_cursor: null };
      throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
    }
    const result = route(init);
    if (result instanceof Error) throw result;
    return result;
  });
}

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

let assign: ReturnType<typeof vi.fn>;
beforeEach(() => {
  sessionState.current = { status: "authenticated" };
  http.fetch.mockReset();
  nav.replace.mockReset();
  nav.search = "";
  window.sessionStorage.clear();
  assign = vi.fn();
  Object.defineProperty(window, "location", { configurable: true, value: { pathname: "/integracoes/nuvemshop/retorno/", href: "http://localhost/", assign } });
});

const openNuvemshop = async (user: ReturnType<typeof userEvent.setup>, name: RegExp) => {
  await user.click(await screen.findByRole("button", { name }));
};

describe("regras da cotação (as da API)", () => {
  it("máscara de CEP e cidades por linha", () => {
    expect(maskCep("80230000")).toBe("80230-000");
    expect(maskCep("8023")).toBe("8023");
    expect(parseCities("  Curitiba \n\n São   José dos Pinhais\n")).toEqual(["Curitiba", "São José dos Pinhais"]);
  });
  it("validação: prazo, faixas, horário e limites", () => {
    const ok = toForm({ price: "9.90", etaMinutes: 60, cepRanges: [["80000000", "82999999"]], cities: ["Curitiba"], active: true, openFrom: "08:00", openUntil: "18:00" });
    expect(validateSettings(ok)).toEqual({});
    expect(validateSettings({ ...ok, eta: "0" }).eta).toBe("Informe o prazo de 1 a 600 minutos.");
    expect(validateSettings({ ...ok, eta: "601" }).eta).toBe("Informe o prazo de 1 a 600 minutos.");
    expect(validateSettings({ ...ok, price: "R$ 10.000,00" }).price).toBe("O valor máximo é R$ 9.999,99.");
    expect(validateSettings({ ...ok, ranges: [{ from: "8000", to: "82999-999" }] }).ranges).toBe("Cada faixa precisa de dois CEPs com 8 dígitos.");
    expect(validateSettings({ ...ok, ranges: [{ from: "83000-000", to: "82999-999" }] }).ranges).toBe("Em cada faixa, o CEP inicial não pode ser maior que o final.");
    expect(validateSettings({ ...ok, openUntil: "" }).hours).toBe("Preencha o início e o fim do horário, ou deixe os dois em branco.");
    expect(validateSettings({ ...ok, openFrom: "19:00" }).hours).toBe("O início do horário não pode ser depois do fim.");
    expect(validateSettings({ ...ok, ranges: Array.from({ length: 201 }, () => ({ from: "80000-000", to: "80000-001" })) }).ranges).toBe("No máximo 200 faixas de CEP.");
  });
  it("corpo da API: preço decimal, só dígitos nos CEPs, horário nulo quando em branco", () => {
    const form = { ...toForm({ price: "0.00", etaMinutes: 45, cepRanges: [], cities: [], active: false, openFrom: null, openUntil: null }), price: "R$ 12,50", ranges: [{ from: "80000-000", to: "82999-999" }], cities: "Curitiba" };
    expect(toSettings(form)).toEqual({ price: "12.50", etaMinutes: 45, cepRanges: [["80000000", "82999999"]], cities: ["Curitiba"], active: false, openFrom: null, openUntil: null });
  });
});

describe("preço normalizado (nunca R$ 0,15 para \"15\")", () => {
  it("a API pode mandar \"15\", \"15.5\" ou \"15.00\": o texto sempre ganha 2 casas antes da máscara", () => {
    const form = (price: string) => toForm(parseShippingSettings({ price, eta_minutes: 60, cep_ranges: [], cities: [], active: false }));
    expect(parseShippingSettings({ price: "15" }).price).toBe("15.00");
    expect(parseShippingSettings({ price: 15 }).price).toBe("15.00");
    expect(form("15").price).toBe("R$ 15,00");
    expect(form("15.5").price).toBe("R$ 15,50");
    expect(form("15.00").price).toBe("R$ 15,00");
    expect(form("0.15").price).toBe("R$ 0,15");
    expect(form("0").price).toBe("");
    // O mesmo vale para o preço do Open Delivery.
    expect(parseDetail({ type: "open_delivery", status: "available", state: "disconnected", delivery_price: "15", health: {} }).deliveryPrice).toBe("15.00");
  });

  it("um Salvar sem mudanças não troca R$ 15,00 por R$ 0,15", async () => {
    serve({
      "GET /integrations": () => cards({ status: "connected", state: "connected" }),
      "GET /integrations/nuvemshop": () => detail(),
      "GET /integrations/nuvemshop/shipping-settings": () => settings({ price: "15" }),
      "PUT /integrations/nuvemshop/shipping-settings": () => settings({ price: "15.00" }),
    });
    const { user } = mount(<IntegrationsScreen />);
    await openNuvemshop(user, /^Nuvemshop, Conectado/);
    const panel = screen.getByRole("complementary", { name: "Detalhe da integração" });
    expect(await within(panel).findByLabelText("Preço do frete")).toHaveValue("R$ 15,00");
    await user.click(within(panel).getByRole("button", { name: "Salvar cotação" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations/nuvemshop/shipping-settings", expect.objectContaining({ method: "PUT", body: expect.objectContaining({ price: "15.00" }) })));
  });
});

describe("instalação pela loja de apps (sem o state do painel)", () => {
  it("sem sessão: explica o caminho, com botão de entrar que volta a Integrações, e não chama a API", async () => {
    sessionState.current = { status: "anonymous" };
    nav.search = "code=codigo-da-nuvemshop";
    mount(<PartnerReturn type="nuvemshop" />);
    expect(await screen.findByText("Para concluir, entre no painel Motoka e conecte em Integrações.")).toBeInTheDocument();
    const login = screen.getByRole("link", { name: "Entrar no painel" });
    expect(login.getAttribute("href")).toContain("/entrar");
    expect(decodeURIComponent(login.getAttribute("href") ?? "")).toContain("de=/integracoes/");
    expect(http.fetch).not.toHaveBeenCalled();
  });

  it("logado, mas sem state guardado: mesma explicação, com atalho para Integrações", async () => {
    nav.search = "code=codigo-da-nuvemshop";
    mount(<PartnerReturn type="nuvemshop" />);
    expect(await screen.findByText("Para concluir, entre no painel Motoka e conecte em Integrações.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para Integrações" })).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalled();
  });

  it("logado com o state do painel: segue o fluxo normal", async () => {
    savePendingOauth({ type: "nuvemshop", state: STATE });
    nav.search = `code=c&state=${STATE}`;
    serve({ "POST /integrations/nuvemshop/authorize/complete": () => ({ state: "connected" }) });
    mount(<PartnerReturn type="nuvemshop" />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/integracoes/"));
  });
});

describe("conectar a Nuvemshop", () => {
  it("Conectar à Nuvemshop guarda o state da aba (tipo nuvemshop) e leva ao portal", async () => {
    serve({ "GET /integrations": () => cards({}), "POST /integrations/nuvemshop/authorize": () => ({ authorize_url: AUTHORIZE, expires_in: 600 }) });
    const { user } = mount(<IntegrationsScreen />);
    await openNuvemshop(user, /^Nuvemshop, Conectar/);
    await user.click(await screen.findByRole("button", { name: "Conectar à Nuvemshop" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(AUTHORIZE));
    const stored = JSON.parse(window.sessionStorage.getItem("motoka.panel.oauth-pending") ?? "{}") as { type?: string; state?: string };
    expect(stored).toMatchObject({ type: "nuvemshop", state: STATE });
  });

  it("volta: a API diz connected → toast e volta para Integrações", async () => {
    savePendingOauth({ type: "nuvemshop", state: STATE });
    nav.search = `code=c&state=${STATE}`;
    serve({ "POST /integrations/nuvemshop/authorize/complete": () => ({ state: "connected", external_merchant_id: "1234567" }) });
    mount(<OauthReturn type="nuvemshop" />);
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations/nuvemshop/authorize/complete", expect.objectContaining({ body: { code: "c", state: STATE } })));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/integracoes/"));
  });

  it("volta: a API diz incomplete → mensagem do cadastro, sem dizer conectado", async () => {
    savePendingOauth({ type: "nuvemshop", state: STATE });
    nav.search = `code=c&state=${STATE}`;
    serve({ "POST /integrations/nuvemshop/authorize/complete": () => ({ state: "incomplete", external_merchant_id: "1234567" }) });
    mount(<OauthReturn type="nuvemshop" />);
    expect(await screen.findByText(/o cadastro da entrega na Nuvemshop não terminou/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Configuração incompleta" })).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("state guardado de outro parceiro não vale na volta da Nuvemshop", async () => {
    savePendingOauth({ type: "cardapio_web", state: STATE });
    nav.search = `code=c&state=${STATE}`;
    mount(<OauthReturn type="nuvemshop" />);
    expect(await screen.findByText("Não foi possível confirmar a conexão. Comece de novo pelo painel.")).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalled();
  });
});

describe("Nuvemshop conectada: cotação, endereço de cotação e cadastro", () => {
  const routes = (extra: Record<string, Route> = {}) => ({
    "GET /integrations": () => cards({ status: "connected", state: "connected" }),
    "GET /integrations/nuvemshop": () => detail(),
    "GET /integrations/nuvemshop/shipping-settings": () => settings(),
    ...extra,
  });

  it("mostra a cotação salva e o aviso do cache (texto do Motoka, não do servidor); sem vínculos nem sincronizar", async () => {
    serve(routes());
    const { user } = mount(<IntegrationsScreen />);
    await openNuvemshop(user, /^Nuvemshop, Conectado/);
    const panel = screen.getByRole("complementary", { name: "Detalhe da integração" });
    expect(await within(panel).findByLabelText("Prazo de entrega (minutos)")).toHaveValue("60");
    expect(within(panel).getByLabelText("Preço do frete")).toHaveValue("R$ 9,90");
    expect(within(panel).getByLabelText("CEP inicial da faixa 1")).toHaveValue("80000-000");
    expect(within(panel).getByLabelText("Cidades atendidas")).toHaveValue("Curitiba");
    expect(within(panel).getByText(CACHE_NOTICE)).toBeInTheDocument();
    expect(screen.queryByText(/texto do servidor/)).toBeNull();
    expect(within(panel).queryByRole("region", { name: "Motoboys e entregadores" })).toBeNull();
    expect(within(panel).queryByRole("button", { name: "Sincronizar agora" })).toBeNull();
    expect(within(panel).getByText(/não cancela o pedido na Nuvemshop/)).toBeInTheDocument();
  });

  it("salvar manda o corpo da API; erro de validação não chama a API", async () => {
    serve(routes({ "PUT /integrations/nuvemshop/shipping-settings": () => settings({ price: "12.50", eta_minutes: 45, active: true }) }));
    const { user } = mount(<IntegrationsScreen />);
    await openNuvemshop(user, /^Nuvemshop, Conectado/);
    const panel = screen.getByRole("complementary", { name: "Detalhe da integração" });
    const eta = await within(panel).findByLabelText("Prazo de entrega (minutos)");
    await user.clear(eta);
    await user.type(eta, "0");
    await user.click(within(panel).getByRole("button", { name: "Salvar cotação" }));
    expect(await within(panel).findByText("Informe o prazo de 1 a 600 minutos.")).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalledWith("/integrations/nuvemshop/shipping-settings", expect.objectContaining({ method: "PUT" }));

    await user.clear(eta);
    await user.type(eta, "45");
    const price = within(panel).getByLabelText("Preço do frete");
    await user.clear(price);
    await user.type(price, "1250");
    await user.click(within(panel).getByRole("switch", { name: /Oferecer a entrega por motoboy/ }));
    await user.click(within(panel).getByRole("button", { name: "Adicionar faixa de CEP" }));
    await user.type(within(panel).getByLabelText("CEP inicial da faixa 2"), "83000000");
    await user.type(within(panel).getByLabelText("CEP final da faixa 2"), "83999999");
    await user.click(within(panel).getByRole("button", { name: "Salvar cotação" }));
    await waitFor(() =>
      expect(http.fetch).toHaveBeenCalledWith(
        "/integrations/nuvemshop/shipping-settings",
        expect.objectContaining({
          method: "PUT",
          body: { price: "12.50", eta_minutes: 45, cep_ranges: [["80000000", "82999999"], ["83000000", "83999999"]], cities: ["Curitiba"], active: true, open_from: null, open_until: null },
        }),
      ),
    );
    expect(await screen.findByText("Cotação salva.")).toBeInTheDocument();
  });

  it("ligado sem área avisa que ninguém é atendido", async () => {
    serve(routes({ "GET /integrations/nuvemshop/shipping-settings": () => settings({ cep_ranges: [], cities: [], active: true }) }));
    const { user } = mount(<IntegrationsScreen />);
    await openNuvemshop(user, /^Nuvemshop, Conectado/);
    expect(await screen.findByText(/sem faixa de CEP nem cidade: nenhum cliente é atendido/)).toBeInTheDocument();
  });

  it("gerar novo endereço de cotação pede confirmação", async () => {
    serve(routes({ "POST /integrations/nuvemshop/shipping-settings/route-token": () => ({ rotated: true }) }));
    const { user } = mount(<IntegrationsScreen />);
    await openNuvemshop(user, /^Nuvemshop, Conectado/);
    await user.click(await screen.findByRole("button", { name: "Gerar novo endereço de cotação" }));
    expect(http.fetch).not.toHaveBeenCalledWith("/integrations/nuvemshop/shipping-settings/route-token", expect.anything());
    await user.click(within(await screen.findByRole("dialog", { name: "Gerar novo endereço de cotação?" })).getByRole("button", { name: "Gerar novo endereço" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations/nuvemshop/shipping-settings/route-token", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText("Novo endereço de cotação gerado.")).toBeInTheDocument();
  });

  it("sem configuração criada (404): explica e manda refazer o cadastro", async () => {
    serve(routes({ "GET /integrations/nuvemshop/shipping-settings": () => new ApiError({ status: 404, code: "INTEGRATION_NOT_FOUND" }) }));
    const { user } = mount(<IntegrationsScreen />);
    await openNuvemshop(user, /^Nuvemshop, Conectado/);
    expect(await screen.findByText(/A configuração da cotação ainda não existe/)).toBeInTheDocument();
  });

  it("estado incomplete (cadastro da entrega falhou): Refazer cadastro, e o resultado vem da API", async () => {
    let result = "incomplete";
    serve(
      routes({
        "GET /integrations": () => cards({ status: "incomplete", state: "connected" }),
        "POST /integrations/nuvemshop/setup": () => ({ state: result }),
      }),
    );
    const { user } = mount(<IntegrationsScreen />);
    await openNuvemshop(user, /^Nuvemshop, Configuração incompleta/);
    const panel = screen.getByRole("complementary", { name: "Detalhe da integração" });
    expect(await within(panel).findByText(/o cadastro da entrega na Nuvemshop não terminou/)).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Refazer cadastro" }));
    expect(await within(panel).findByText("O cadastro ainda não terminou na Nuvemshop. Tente de novo em instantes.")).toBeInTheDocument();
    result = "connected";
    await user.click(within(panel).getByRole("button", { name: "Refazer cadastro" }));
    expect(await screen.findByText("Cadastro refeito.")).toBeInTheDocument();
    expect(http.fetch.mock.calls.filter(([path]) => path === "/integrations/nuvemshop/setup")).toHaveLength(2);
  });

  it("reprocessar com a conexão caída ou muitas tentativas mostra o texto do catálogo", async () => {
    serve(routes({ "GET /integrations": () => cards({ status: "incomplete", state: "connected" }), "POST /integrations/nuvemshop/setup": () => new ApiError({ status: 409, code: "INTEGRATION_REAUTH_REQUIRED" }) }));
    const { user } = mount(<IntegrationsScreen />);
    await openNuvemshop(user, /^Nuvemshop, Configuração incompleta/);
    await user.click(await screen.findByRole("button", { name: "Refazer cadastro" }));
    expect(await screen.findByText("A conexão com o parceiro caiu. Reconecte a integração.")).toBeInTheDocument();
  });

  it("desconectar a Nuvemshop pede confirmação com o texto dela", async () => {
    serve(routes({ "DELETE /integrations/nuvemshop": () => undefined }));
    const { user } = mount(<IntegrationsScreen />);
    await openNuvemshop(user, /^Nuvemshop, Conectado/);
    await user.click(await screen.findByRole("button", { name: "Desconectar" }));
    const dialog = await screen.findByRole("dialog", { name: "Desconectar a Nuvemshop?" });
    expect(dialog).toHaveTextContent("checkout");
    await user.click(within(dialog).getByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations/nuvemshop", expect.objectContaining({ method: "DELETE" })));
  });

  it("iFood continua em breve, sem botão", async () => {
    serve(routes());
    mount(<IntegrationsScreen />);
    const grid = await screen.findByRole("list", { name: "Conectores" });
    expect(within(grid).queryByRole("button", { name: /iFood/ })).toBeNull();
    expect(within(grid).getByText("Em breve")).toBeInTheDocument();
  });
});
