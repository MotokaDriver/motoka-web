import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => ({ subscribe: () => () => undefined, getState: () => ({ status: "authenticated" }) }),
  apiFetch: (path: string, init?: unknown) => http.fetch(path, init),
}));

const { IntegrationsScreen } = await import("@/features/integrations/IntegrationsScreen");
const { OauthReturn } = await import("@/features/integrations/OauthReturn");
const { safePortalUrl } = await import("@/features/integrations/OauthPanel");
const { cardTone, visibleCards, attentionText } = await import("@/features/integrations/logic");
const { parseCards, parseActivity } = await import("@/features/integrations/model");
const { savePendingOauth, takePendingOauth } = await import("@/lib/prefs/prefs");
const { ToastProvider } = await import("@/ui/Toast");

const STATE = "estado-pkce-de-teste-1234567890";
const AUTHORIZE = `https://portal.cardapioweb.com/cw-apps?client_id=abc&state=${STATE}&code_challenge=xyz&code_challenge_method=S256`;
const DRIVER_A = "d0000001-0000-4000-8000-000000000001";
const DRIVER_B = "d0000002-0000-4000-8000-000000000002";

const cards = (cw: Record<string, unknown>) =>
  [
    { type: "open_delivery", status: "available", state: null },
    { type: "saipos", status: "soon", state: null },
    { type: "cardapio_web", status: "available", state: null, ...cw },
    { type: "ifood", status: "soon", state: null },
    { type: "nuvemshop", status: "soon", state: null },
  ].map((c) => ({ last_outbound_ok_at: null, needs_attention: false, ...c }));

const cwDetail = (over: Record<string, unknown> = {}) => ({
  type: "cardapio_web",
  status: "connected",
  state: "connected",
  external_merchant_id: "7731",
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

const drivers = (over: Record<string, unknown> = {}) => ({
  team: [
    { driver_id: DRIVER_A, name: "Diego Ramos", external_driver_id: null, external_driver_name: null },
    { driver_id: DRIVER_B, name: "Rafa Lima", external_driver_id: "55", external_driver_name: "Rafael Lima" },
  ],
  external: [
    { id: "77", name: "Diego R." },
    { id: "55", name: "Rafael Lima" },
  ],
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
  return { user, queryClient };
}

let assign: ReturnType<typeof vi.fn>;
beforeEach(() => {
  http.fetch.mockReset();
  nav.replace.mockReset();
  nav.search = "";
  window.sessionStorage.clear();
  window.localStorage.clear();
  assign = vi.fn();
  Object.defineProperty(window, "location", { configurable: true, value: { pathname: "/integracoes/", href: "http://localhost/integracoes/", assign } });
});

describe("cards e textos (WN-4c)", () => {
  it("Cardápio Web sem configuração no ambiente: Indisponível neste ambiente; incomplete: Configuração incompleta; iFood e Nuvemshop: Em breve", () => {
    const list = visibleCards(parseCards(cards({ status: "soon" })));
    expect(list.map((c) => c.type)).toEqual(["open_delivery", "cardapio_web", "ifood", "nuvemshop"]);
    expect(cardTone(list.find((c) => c.type === "cardapio_web")!).label).toBe("Indisponível neste ambiente");
    expect(cardTone(parseCards(cards({ status: "incomplete", state: "disconnected" })).find((c) => c.type === "cardapio_web")!).label).toBe("Configuração incompleta");
    expect(cardTone(list.find((c) => c.type === "ifood")!).label).toBe("Em breve");
    expect(cardTone(parseCards(cards({ status: "connected", state: "connected" })).find((c) => c.type === "cardapio_web")!).label).toBe("Conectado");
    expect(cardTone(parseCards(cards({ state: "error" })).find((c) => c.type === "cardapio_web")!).label).toBe("Reconectar");
  });
  it("só https para o portal (e localhost fora de prod); credenciais na URL não", () => {
    expect(safePortalUrl(AUTHORIZE)).toBe(AUTHORIZE);
    expect(safePortalUrl("http://localhost:8790/portal?state=x")).not.toBeNull();
    expect(safePortalUrl("http://portal.cardapioweb.com/x")).toBeNull();
    expect(safePortalUrl("javascript:alert(1)")).toBeNull();
    expect(safePortalUrl("https://user:pass@portal.cardapioweb.com/x")).toBeNull();
  });
  it("atenção: texto fixo por motivo; o meta cru nunca é lido", () => {
    expect(attentionText(189, "Cardápio Web", "driver_not_linked")).toBe("Pedido #189: sem entregador vinculado. Vincule o motoboy a um entregador do Cardápio Web.");
    const page = parseActivity({ items: [{ id: "1", type: "cardapio_web", kind: "attention", delivery_id: DRIVER_A, delivery_number: 189, meta: { reason: "driver_not_linked", segredo: "X" }, created_at: "2026-10-06T12:00:00Z" }], next_cursor: null });
    expect(page.items[0]?.reason).toBe("driver_not_linked");
    expect(JSON.stringify(page)).not.toContain("segredo");
    expect(parseActivity({ items: [{ id: "2", type: "cardapio_web", kind: "attention", meta: { reason: "texto livre" }, created_at: "x" }], next_cursor: null }).items[0]?.reason).toBeNull();
  });
  it("o state pendente vale uma vez e só por 10 min, na aba", () => {
    savePendingOauth({ type: "cardapio_web", state: STATE });
    expect(window.localStorage.length).toBe(0);
    expect(takePendingOauth()).toEqual({ type: "cardapio_web", state: STATE });
    expect(takePendingOauth()).toBeNull();
    savePendingOauth({ type: "cardapio_web", state: STATE });
    vi.useFakeTimers({ now: Date.now() + 11 * 60_000 });
    try {
      expect(takePendingOauth()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("conectar o Cardápio Web (PKCE)", () => {
  it("mostra Indisponível neste ambiente quando o ambiente não está configurado, sem botão de conectar", async () => {
    serve({ "GET /integrations": () => cards({ status: "soon" }) });
    const { user } = mount(<IntegrationsScreen />);
    const grid = await screen.findByRole("list", { name: "Conectores" });
    await user.click(within(grid).getByRole("button", { name: "Cardápio Web, Indisponível neste ambiente" }));
    const panel = screen.getByRole("complementary", { name: "Detalhe da integração" });
    expect(within(panel).getByText(/ainda não foi configurada neste ambiente/)).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Conectar/ })).toBeNull();
    expect(within(grid).getAllByText("Em breve")).toHaveLength(2);
  });

  it("Conectar guarda só o state na aba e leva ao portal", async () => {
    serve({
      "GET /integrations": () => cards({}),
      "POST /integrations/cardapio_web/authorize": () => ({ authorize_url: AUTHORIZE, expires_in: 600 }),
    });
    const { user } = mount(<IntegrationsScreen />);
    const grid = await screen.findByRole("list", { name: "Conectores" });
    await user.click(within(grid).getByRole("button", { name: "Cardápio Web, Conectar" }));
    const panel = screen.getByRole("complementary", { name: "Detalhe da integração" });
    await user.click(within(panel).getByRole("button", { name: "Conectar ao Cardápio Web" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(AUTHORIZE));
    const stored = window.sessionStorage.getItem("motoka.panel.oauth-pending") ?? "";
    expect(stored).toContain(STATE);
    expect(stored).not.toContain("verifier");
    expect(window.localStorage.length).toBe(0);
  });

  it("URL de portal insegura não é aberta", async () => {
    serve({
      "GET /integrations": () => cards({}),
      "POST /integrations/cardapio_web/authorize": () => ({ authorize_url: "http://portal.cardapioweb.com/x?state=a", expires_in: 600 }),
    });
    const { user } = mount(<IntegrationsScreen />);
    await user.click(await screen.findByRole("button", { name: "Cardápio Web, Conectar" }));
    await user.click(await screen.findByRole("button", { name: "Conectar ao Cardápio Web" }));
    expect(await screen.findByText("Não foi possível abrir a conexão com o parceiro. Tente de novo.")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("incomplete (sem a loja do parceiro): Configuração incompleta e conectar de novo", async () => {
    serve({ "GET /integrations": () => cards({ status: "incomplete", state: "disconnected" }), "GET /integrations/cardapio_web": () => cwDetail({ status: "incomplete", state: "disconnected", external_merchant_id: null }) });
    const { user } = mount(<IntegrationsScreen />);
    await user.click(await screen.findByRole("button", { name: "Cardápio Web, Configuração incompleta" }));
    expect(await screen.findByText(/Configuração incompleta: o Cardápio Web não informou a loja\. Conecte de novo\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar de novo ao Cardápio Web" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sincronizar agora" })).toBeNull();
  });

  it("estado de erro pede para reconectar", async () => {
    serve({ "GET /integrations": () => cards({ state: "error" }), "GET /integrations/cardapio_web": () => cwDetail({ state: "error", status: "available" }) });
    const { user } = mount(<IntegrationsScreen />);
    await user.click(await screen.findByRole("button", { name: "Cardápio Web, Reconectar" }));
    expect(await screen.findByText(/Reconecte o Cardápio Web/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconectar o Cardápio Web" })).toBeInTheDocument();
  });
});

describe("volta do portal (callback)", () => {
  it("state conferido: troca o código, limpa a URL e volta para Integrações", async () => {
    savePendingOauth({ type: "cardapio_web", state: STATE });
    nav.search = `code=codigo123&state=${STATE}`;
    const replaceState = vi.spyOn(window.history, "replaceState");
    serve({ "POST /integrations/cardapio_web/authorize/complete": () => ({ state: "connected", external_merchant_id: "7731" }) });
    mount(<OauthReturn />);
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations/cardapio_web/authorize/complete", expect.objectContaining({ method: "POST", body: { code: "codigo123", state: STATE } })));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/integracoes/"));
    expect(replaceState).toHaveBeenCalledWith(null, "", "/integracoes/");
    expect(window.sessionStorage.length).toBe(0);
    replaceState.mockRestore();
  });

  it("state diferente do que o painel guardou: recusa sem chamar a API", async () => {
    savePendingOauth({ type: "cardapio_web", state: STATE });
    nav.search = "code=codigo123&state=outro-state";
    mount(<OauthReturn />);
    expect(await screen.findByText("Não foi possível confirmar a conexão. Comece de novo pelo painel.")).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("sem state guardado (outra aba, aba nova ou venceu): recusa", async () => {
    nav.search = `code=codigo123&state=${STATE}`;
    mount(<OauthReturn />);
    expect(await screen.findByText("Não foi possível confirmar a conexão. Comece de novo pelo painel.")).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalled();
  });

  it("a API diz incomplete: não mostra conectado, mostra a mensagem e não volta para Integrações", async () => {
    savePendingOauth({ type: "cardapio_web", state: STATE });
    nav.search = `code=c&state=${STATE}`;
    serve({ "POST /integrations/cardapio_web/authorize/complete": () => ({ state: "incomplete", external_merchant_id: null }) });
    mount(<OauthReturn />);
    expect(await screen.findByText("A conexão ficou incompleta: o Cardápio Web não informou a loja. Conecte de novo.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Configuração incompleta" })).toBeInTheDocument();
    expect(screen.queryByText("Cardápio Web conectado.")).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("a API diz outro estado: a conexão não concluiu", async () => {
    savePendingOauth({ type: "cardapio_web", state: STATE });
    nav.search = `code=c&state=${STATE}`;
    serve({ "POST /integrations/cardapio_web/authorize/complete": () => ({ state: "disconnected" }) });
    mount(<OauthReturn />);
    expect(await screen.findByText("A conexão não foi concluída. Tente de novo pelo painel.")).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("state vencido (mais de 10 min na aba): recusa sem chamar a API", async () => {
    savePendingOauth({ type: "cardapio_web", state: STATE });
    nav.search = `code=c&state=${STATE}`;
    vi.useFakeTimers({ now: Date.now() + 11 * 60_000, shouldAdvanceTime: true });
    try {
      mount(<OauthReturn />);
      expect(await screen.findByText("Não foi possível confirmar a conexão. Comece de novo pelo painel.")).toBeInTheDocument();
      expect(http.fetch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uso único: a mesma volta repetida (F5, aba duplicada) não chama a API de novo", async () => {
    savePendingOauth({ type: "cardapio_web", state: STATE });
    nav.search = `code=c&state=${STATE}`;
    serve({ "POST /integrations/cardapio_web/authorize/complete": () => ({ state: "connected" }) });
    mount(<OauthReturn />);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/integracoes/"));
    expect(http.fetch).toHaveBeenCalledTimes(1); // só o complete
    cleanup();
    http.fetch.mockClear();
    mount(<OauthReturn />);
    expect(await screen.findByText("Não foi possível confirmar a conexão. Comece de novo pelo painel.")).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalled();
  });

  it("autorização recusada no portal", async () => {
    savePendingOauth({ type: "cardapio_web", state: STATE });
    nav.search = "error=access_denied";
    mount(<OauthReturn />);
    expect(await screen.findByText(/A autorização foi recusada no portal do parceiro/)).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalled();
  });

  it("erro da API vira texto do catálogo (state inválido e código expirado)", async () => {
    savePendingOauth({ type: "cardapio_web", state: STATE });
    nav.search = `code=c&state=${STATE}`;
    serve({ "POST /integrations/cardapio_web/authorize/complete": () => new ApiError({ status: 410, code: "INTEGRATION_AUTH_EXPIRED" }) });
    mount(<OauthReturn />);
    expect(await screen.findByText("O código expirou. Gere um novo código.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para Integrações" })).toBeInTheDocument();
  });
});

describe("Cardápio Web conectado: vínculo, sincronizar e desconectar", () => {
  const openCw = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole("button", { name: "Cardápio Web, Conectado" }));
  };
  const connectedRoutes = (extra: Record<string, Route> = {}) => ({
    "GET /integrations": () => cards({ status: "connected", state: "connected" }),
    "GET /integrations/cardapio_web": () => cwDetail(),
    "GET /integrations/cardapio_web/drivers": () => drivers(),
    ...extra,
  });

  it("lista a equipe com o vínculo de cada motoboy e o aviso de que o Motoka não cancela no parceiro", async () => {
    serve(connectedRoutes());
    const { user } = mount(<IntegrationsScreen />);
    await openCw(user);
    const panel = await screen.findByRole("complementary", { name: "Detalhe da integração" });
    expect(await within(panel).findByText("Loja 7731")).toBeInTheDocument();
    const list = await within(panel).findByRole("list", { name: "Vínculos" });
    expect(within(list).getByLabelText("Entregador de Diego Ramos")).toHaveValue("");
    expect(within(list).getByLabelText("Entregador de Rafa Lima")).toHaveValue("55");
    expect(within(panel).getByText(/não cancela o pedido no Cardápio Web/)).toBeInTheDocument();
    // Quem já está vinculado a outro motoboy não pode ser escolhido de novo.
    const options = within(within(list).getByLabelText("Entregador de Diego Ramos")).getAllByRole("option");
    expect(options.find((o) => o.textContent === "Rafael Lima")).toBeDisabled();
  });

  it("vínculos de quem saiu da equipe aparecem com Remover", async () => {
    serve(
      connectedRoutes({
        "GET /integrations/cardapio_web/drivers": () => drivers({ orphans: [{ driver_id: "d0000009-0000-4000-8000-000000000009", external_driver_id: "91", external_driver_name: "Paulo Nunes" }] }),
        "DELETE /integrations/cardapio_web/driver-links/d0000009-0000-4000-8000-000000000009": () => undefined,
      }),
    );
    const { user } = mount(<IntegrationsScreen />);
    await openCw(user);
    const orphans = await screen.findByRole("list", { name: "Vínculos de quem saiu" });
    expect(within(orphans).getByText("Paulo Nunes")).toBeInTheDocument();
    await user.click(within(orphans).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations/cardapio_web/driver-links/d0000009-0000-4000-8000-000000000009", expect.objectContaining({ method: "DELETE" })));
  });

  it("vincular manda o PUT e remover manda o DELETE", async () => {
    serve(connectedRoutes({ [`PUT /integrations/cardapio_web/driver-links/${DRIVER_A}`]: () => ({}), [`DELETE /integrations/cardapio_web/driver-links/${DRIVER_B}`]: () => undefined }));
    const { user } = mount(<IntegrationsScreen />);
    await openCw(user);
    const list = await screen.findByRole("list", { name: "Vínculos" });
    await user.selectOptions(within(list).getByLabelText("Entregador de Diego Ramos"), "77");
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith(`/integrations/cardapio_web/driver-links/${DRIVER_A}`, expect.objectContaining({ method: "PUT", body: { external_driver_id: "77" } })));
    await user.selectOptions(within(list).getByLabelText("Entregador de Rafa Lima"), "");
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith(`/integrations/cardapio_web/driver-links/${DRIVER_B}`, expect.objectContaining({ method: "DELETE" })));
  });

  it("409 de entregador já vinculado vira texto fixo", async () => {
    serve(connectedRoutes({ [`PUT /integrations/cardapio_web/driver-links/${DRIVER_A}`]: () => new ApiError({ status: 409, code: "INTEGRATION_EXTERNAL_DRIVER_TAKEN" }) }));
    const { user } = mount(<IntegrationsScreen />);
    await openCw(user);
    const list = await screen.findByRole("list", { name: "Vínculos" });
    await user.selectOptions(within(list).getByLabelText("Entregador de Diego Ramos"), "77");
    expect(await screen.findByText("Esse entregador já está vinculado a outro motoboy.")).toBeInTheDocument();
  });

  it("sincronizar agora e 429 com texto fixo", async () => {
    serve(connectedRoutes({ "POST /integrations/cardapio_web/sync": () => ({ queued: 2 }) }));
    const { user } = mount(<IntegrationsScreen />);
    await openCw(user);
    await user.click(await screen.findByRole("button", { name: "Sincronizar agora" }));
    expect(await screen.findByText("Sincronizado: 2 pedidos na fila.")).toBeInTheDocument();
  });

  it("sincronizar com a conexão caída pede reconexão", async () => {
    serve(connectedRoutes({ "POST /integrations/cardapio_web/sync": () => new ApiError({ status: 409, code: "INTEGRATION_REAUTH_REQUIRED" }) }));
    const { user } = mount(<IntegrationsScreen />);
    await openCw(user);
    await user.click(await screen.findByRole("button", { name: "Sincronizar agora" }));
    expect(await screen.findByText("A conexão com o parceiro caiu. Reconecte a integração.")).toBeInTheDocument();
  });

  it("desconectar pede confirmação", async () => {
    serve(connectedRoutes({ "DELETE /integrations/cardapio_web": () => undefined }));
    const { user } = mount(<IntegrationsScreen />);
    await openCw(user);
    await user.click(await screen.findByRole("button", { name: "Desconectar" }));
    expect(http.fetch).not.toHaveBeenCalledWith("/integrations/cardapio_web", expect.objectContaining({ method: "DELETE" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Desconectar o Cardápio Web?" })).getByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations/cardapio_web", expect.objectContaining({ method: "DELETE" })));
  });

  it("pedido sem entregador vinculado aparece em Atenção com o link do pedido", async () => {
    serve(
      connectedRoutes({
        "GET /integrations/activity": () => ({
          items: [{ id: "1", type: "cardapio_web", kind: "attention", delivery_id: DRIVER_A, delivery_number: 189, meta: { reason: "driver_not_linked" }, created_at: "2026-10-06T15:00:00Z" }],
          next_cursor: null,
        }),
      }),
    );
    mount(<IntegrationsScreen />);
    const attention = await screen.findByRole("region", { name: "Atenção" });
    expect(within(attention).getByText("Pedido #189: sem entregador vinculado. Vincule o motoboy a um entregador do Cardápio Web.")).toBeInTheDocument();
    expect(within(attention).getByRole("link", { name: "Abrir pedido" })).toHaveAttribute("href", expect.stringMatching(new RegExp(`^/pedidos/?\\?pedido=${DRIVER_A}$`)));
  });
});
