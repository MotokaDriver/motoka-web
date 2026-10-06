import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/integracoes/",
  useSearchParams: () => new URLSearchParams(""),
}));

const http = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => ({ subscribe: () => () => undefined, getState: () => ({ status: "authenticated" }) }),
  apiFetch: (path: string, init?: unknown) => http.fetch(path, init),
}));

const { IntegrationsScreen } = await import("@/features/integrations/IntegrationsScreen");
const { validateMerchant, validateWebhook, testSummary, visibleCards } = await import("@/features/integrations/logic");
const { parseCards, parseDetail, parseIssued, parseActivity } = await import("@/features/integrations/model");
const { ToastProvider } = await import("@/ui/Toast");

const MERCHANT = "12345678000199-11111111-2222-4333-8444-555555555555";
const SECRET = "sk_od_SEGREDO_QUE_NAO_PODE_VAZAR_9f3a";

const cards = [
  { type: "open_delivery", status: "available", state: null, last_outbound_ok_at: null, needs_attention: false },
  { type: "saipos", status: "soon", state: null, last_outbound_ok_at: null, needs_attention: false },
  { type: "cardapio_web", status: "soon", state: null, last_outbound_ok_at: null, needs_attention: false },
  { type: "ifood", status: "soon", state: null, last_outbound_ok_at: null, needs_attention: false },
  { type: "nuvemshop", status: "soon", state: null, last_outbound_ok_at: null, needs_attention: false },
];

const detail = (over: Record<string, unknown> = {}) => ({
  type: "open_delivery",
  status: "available",
  state: "disconnected",
  external_merchant_id: MERCHANT,
  webhook_url: "https://pdv.exemplo.com/eventos",
  delivery_price: "0.00",
  operator_base_url: "https://api.motokadriver.com/od/v1",
  token_url: "https://api.motokadriver.com/od/oauth/token",
  client_id: null,
  secret_hint: null,
  credential_version: 0,
  credential_rotated_at: null,
  health: { last_token_at: null, last_inbound_at: null, last_outbound_ok_at: null, pending_events: 0, dead_events_24h: 0 },
  ...over,
});

const connected = (over: Record<string, unknown> = {}) => detail({ status: "connected", state: "connected", client_id: "pz-od-2b90e1d4", secret_hint: "9f3a", credential_version: 1, ...over });

/** Os cards dizem se há algo salvo (`state`): sem ele, o painel nem busca o detalhe. */
const cardsWith = (state: string | null) => cards.map((c) => (c.type === "open_delivery" ? { ...c, state } : c));

type Route = (init?: { method?: string; body?: Record<string, unknown> }) => unknown;
function serve(routes: Record<string, Route>) {
  http.fetch.mockImplementation(async (path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
    const key = `${init?.method ?? "GET"} ${path}`;
    const route = routes[key];
    if (!route) {
      if (path === "/integrations") return cards;
      if (path === "/integrations/activity") return { items: [], next_cursor: null };
      throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
    }
    const result = route(init);
    if (result instanceof Error) throw result;
    return result;
  });
}

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <IntegrationsScreen />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, queryClient };
}

beforeEach(() => {
  http.fetch.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("regras e textos", () => {
  it("merchant: Open Delivery exige 36 caracteres, a Saipos tem formato próprio", () => {
    expect(validateMerchant("open_delivery", "")).toBe("Cole o Merchant ID que o seu sistema mostrou.");
    expect(validateMerchant("open_delivery", "curto")).toMatch(/pelo menos 36/);
    expect(validateMerchant("open_delivery", MERCHANT)).toBeNull();
    expect(validateMerchant("saipos", "48213")).toBeNull();
  });
  it("webhook: https, porta 443/8443, sem usuário e senha; vazio vale", () => {
    expect(validateWebhook("")).toBeNull();
    expect(validateWebhook("https://pdv.exemplo.com/eventos")).toBeNull();
    expect(validateWebhook("https://pdv.exemplo.com:8443/x")).toBeNull();
    expect(validateWebhook("http://pdv.exemplo.com/x")).toBe("Use um endereço https.");
    expect(validateWebhook("https://pdv.exemplo.com:8080/x")).toBe("Use a porta 443 ou 8443.");
    expect(validateWebhook("https://usuario:senha@pdv.exemplo.com/x")).toBe("A URL não pode ter usuário e senha.");
    expect(validateWebhook("pdv.exemplo.com")).toMatch(/começando com https/);
  });
  it("teste de conexão: texto fixo por erro, nunca o detail", () => {
    expect(testSummary({ ok: true, error: null, httpStatus: 405, lastTokenAt: null, lastOutboundOkAt: null }).text).toContain("HTTP 405");
    expect(testSummary({ ok: false, error: "blocked_address", httpStatus: null, lastTokenAt: null, lastOutboundOkAt: null }).text).toMatch(/não é permitido/);
    expect(testSummary({ ok: false, error: "algo_novo", httpStatus: null, lastTokenAt: null, lastOutboundOkAt: null }).text).toBe("Não foi possível conectar nesse endereço.");
  });
  it("cards: Saipos só aparece se liberada; Nuvemshop em breve; Cardápio Web e iFood ficam de fora", () => {
    expect(visibleCards(parseCards(cards)).map((c) => c.type)).toEqual(["open_delivery", "cardapio_web", "ifood", "nuvemshop"]);
    const withSaipos = cards.map((c) => (c.type === "saipos" ? { ...c, status: "available" } : c));
    expect(visibleCards(parseCards(withSaipos)).map((c) => c.type)).toEqual(["open_delivery", "saipos", "cardapio_web", "ifood", "nuvemshop"]);
  });
  it("parsers: secret só na resposta de credenciais; atividade desconhecida não quebra", () => {
    expect(parseDetail(connected())).not.toHaveProperty("clientSecret");
    expect(parseIssued({ client_id: "c", client_secret: SECRET, secret_hint: "9f3a", token_url: "u", credential_version: 1 }).clientSecret).toBe(SECRET);
    expect(() => parseIssued({ client_id: "c" })).toThrow();
    expect(parseActivity({ items: [{ id: "1", type: "saipos", kind: "novo_tipo", created_at: "2026-10-06T12:00:00Z" }], next_cursor: null }).items[0]?.kind).toBe("unknown");
  });
});

describe("tela de Integrações (WN-4b)", () => {
  it("lista os conectores: Nuvemshop em breve e sem botão; Saipos escondida", async () => {
    serve({ "GET /integrations/open_delivery": () => new ApiError({ status: 404, code: "INTEGRATION_NOT_FOUND" }) });
    mount();
    const grid = await screen.findByRole("list", { name: "Conectores" });
    expect(within(grid).getByRole("button", { name: "Open Delivery, Conectar" })).toBeInTheDocument();
    expect(within(grid).getByText("Nuvemshop")).toBeInTheDocument();
    expect(within(grid).getAllByText("Em breve")).toHaveLength(2);
    expect(within(grid).queryByRole("button", { name: /Nuvemshop/ })).toBeNull();
    expect(within(grid).queryByText("Saipos")).toBeNull();
  });

  it("salva o Merchant ID, a URL e o preço; erro de merchant em uso vira texto fixo no campo", async () => {
    serve({
      "GET /integrations/open_delivery": () => new ApiError({ status: 404, code: "INTEGRATION_NOT_FOUND" }),
      "PUT /integrations/open_delivery": () => new ApiError({ status: 409, code: "INTEGRATION_MERCHANT_ID_TAKEN" }),
    });
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe da integração" });
    await user.type(await within(panel).findByLabelText("Merchant ID que o seu sistema mostrou"), "curto");
    await user.click(within(panel).getByRole("button", { name: "Salvar" }));
    expect(await within(panel).findByText(/pelo menos 36 caracteres/)).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalledWith("/integrations/open_delivery", expect.objectContaining({ method: "PUT" }));
    await user.clear(within(panel).getByLabelText("Merchant ID que o seu sistema mostrou"));
    await user.type(within(panel).getByLabelText("Merchant ID que o seu sistema mostrou"), MERCHANT);
    await user.type(within(panel).getByLabelText("URL de eventos (webhook)"), "http://inseguro.com");
    await user.click(within(panel).getByRole("button", { name: "Salvar" }));
    expect(await within(panel).findByText("Use um endereço https.")).toBeInTheDocument();
    await user.clear(within(panel).getByLabelText("URL de eventos (webhook)"));
    await user.type(within(panel).getByLabelText("URL de eventos (webhook)"), "https://pdv.exemplo.com/eventos");
    await user.type(within(panel).getByLabelText("Preço da entrega informado ao sistema"), "250");
    await user.click(within(panel).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations/open_delivery", expect.objectContaining({ method: "PUT", body: { external_merchant_id: MERCHANT, webhook_url: "https://pdv.exemplo.com/eventos", delivery_price: "2.50" } })));
    expect(await within(panel).findByText("Este ID de loja já está ligado a outra conta do Motoka.")).toBeInTheDocument();
  });

  it("gerar credenciais mostra o secret uma vez e ele não vai para cache nem storage", async () => {
    let issuedOnce = false;
    serve({
      "GET /integrations": () => cardsWith("disconnected"),
      "GET /integrations/open_delivery": () => (issuedOnce ? connected() : detail()),
      "POST /integrations/open_delivery/credentials": () => {
        issuedOnce = true;
        return { client_id: "pz-od-2b90e1d4", client_secret: SECRET, secret_hint: "9f3a", credential_version: 1, token_url: "https://api.motokadriver.com/od/oauth/token" };
      },
    });
    const { user, queryClient } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe da integração" });
    await user.click(await within(panel).findByRole("button", { name: "Gerar credenciais" }));
    const alert = await within(panel).findByRole("alert");
    expect(alert).toHaveTextContent("não aparece de novo");
    // Escondido até "Mostrar".
    expect(within(alert).getByTestId("secret-value")).toHaveTextContent("••••");
    await user.click(within(alert).getByRole("button", { name: "Mostrar Client secret" }));
    expect(within(alert).getByTestId("secret-value")).toHaveTextContent(SECRET);

    // Nada do secret no cache de queries/mutações nem no storage.
    const dump = JSON.stringify([queryClient.getQueryCache().getAll().map((q) => q.state.data), queryClient.getMutationCache().getAll().map((m) => m.state)]);
    expect(dump).not.toContain(SECRET);
    expect(JSON.stringify({ ...window.localStorage, ...window.sessionStorage })).not.toContain(SECRET);

    // "Já copiei": o secret some; só fica a dica.
    await user.click(within(panel).getByRole("button", { name: "Já copiei, esconder" }));
    expect(screen.queryByText(SECRET)).toBeNull();
    expect(await within(panel).findByText("••••••••••••9f3a")).toBeInTheDocument();
  });

  it("trocar de conector apaga o secret da tela (e voltar não o traz de volta)", async () => {
    let issued = false;
    const withSaipos = (state: string | null) => cards.map((c) => (c.type === "open_delivery" ? { ...c, state } : c.type === "saipos" ? { ...c, status: "available" } : c));
    serve({
      "GET /integrations": () => withSaipos(issued ? "connected" : "disconnected"),
      "GET /integrations/open_delivery": () => (issued ? connected() : detail()),
      "GET /integrations/saipos": () => new ApiError({ status: 404, code: "INTEGRATION_NOT_FOUND" }),
      "POST /integrations/open_delivery/credentials": () => {
        issued = true;
        return { client_id: "pz-od-2b90e1d4", client_secret: SECRET, secret_hint: "9f3a", credential_version: 1, token_url: "https://api.motokadriver.com/od/oauth/token" };
      },
    });
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe da integração" });
    await user.click(await within(panel).findByRole("button", { name: "Gerar credenciais" }));
    const alert = await within(panel).findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "Mostrar Client secret" }));
    expect(screen.getByText(SECRET)).toBeInTheDocument();

    const grid = screen.getByRole("list", { name: "Conectores" });
    await user.click(within(grid).getByRole("button", { name: /^Saipos/ }));
    expect(await within(panel).findByLabelText("Merchant ID que a Saipos mostrou")).toBeInTheDocument();
    expect(screen.queryByText(SECRET)).toBeNull();
    expect(document.body.textContent).not.toContain(SECRET);

    await user.click(within(grid).getByRole("button", { name: /^Open Delivery/ }));
    expect(await within(panel).findByText("••••••••••••9f3a")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(SECRET);
  });

  it("rotação pede confirmação; desconectar também", async () => {
    serve({
      "GET /integrations": () => cardsWith("connected"),
      "GET /integrations/open_delivery": () => connected(),
      "POST /integrations/open_delivery/credentials": () => ({ client_id: "pz-od-2b90e1d4", client_secret: SECRET, secret_hint: "0000", credential_version: 2, token_url: "u" }),
      "DELETE /integrations/open_delivery": () => undefined,
    });
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe da integração" });
    await user.click(await within(panel).findByRole("button", { name: "Gerar novo secret" }));
    expect(http.fetch).not.toHaveBeenCalledWith("/integrations/open_delivery/credentials", expect.anything());
    const dialog = await screen.findByRole("dialog", { name: "Gerar novo secret?" });
    await user.click(within(dialog).getByRole("button", { name: "Gerar novo secret" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations/open_delivery/credentials", expect.objectContaining({ method: "POST" })));

    await user.click(await within(panel).findByRole("button", { name: "Desconectar" }));
    await user.click(within(await screen.findByRole("dialog", { name: "Desconectar a integração?" })).getByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations/open_delivery", expect.objectContaining({ method: "DELETE" })));
  });

  it("testar conexão mostra o resultado e erro do servidor vira texto fixo", async () => {
    serve({
      "GET /integrations": () => cardsWith("connected"),
      "GET /integrations/open_delivery": () => connected({ health: { last_token_at: "2026-10-06T12:00:00Z", last_inbound_at: null, last_outbound_ok_at: null, pending_events: 2, dead_events_24h: 1 } }),
      "POST /integrations/open_delivery/test": () => ({ ok: false, error: "tls", detail: "TEXTO CRU DO SERVIDOR", http_status: null, last_token_at: null, last_outbound_ok_at: null }),
    });
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe da integração" });
    await user.click(await within(panel).findByRole("button", { name: "Testar conexão" }));
    expect(await within(panel).findByText("O certificado de segurança (TLS) do endereço não é válido.")).toBeInTheDocument();
    expect(screen.queryByText(/TEXTO CRU/)).toBeNull();
    expect(within(panel).getByText("Falhas nas últimas 24 h")).toBeInTheDocument();
    expect(within(panel).getByRole("alert")).toHaveTextContent("Alguns eventos não chegaram");
  });

  it("atividade em português, sem o meta cru; 503 de integrações desligadas mostra o texto do catálogo", async () => {
    serve({
      "GET /integrations/open_delivery": () => detail(),
      "GET /integrations/activity": () => ({
        items: [
          { id: "1", type: "open_delivery", kind: "origin_unconfirmed", delivery_number: 189, meta: { x: "SEGREDO" }, created_at: "2026-10-06T15:00:00Z" },
          { id: "2", type: "open_delivery", kind: "accepted", delivery_number: 188, meta: {}, created_at: "2026-10-06T14:00:00Z" },
        ],
        next_cursor: null,
      }),
    });
    mount();
    const list = await screen.findByRole("list", { name: "Atividade recente" });
    expect(within(list).getByText("O Open Delivery não confirmou o aceite do pedido #189")).toBeInTheDocument();
    expect(within(list).getByText("Pedido #188 aceito")).toBeInTheDocument();
    expect(screen.queryByText(/SEGREDO/)).toBeNull();
  });

  it("integrações desligadas (503): texto do catálogo", async () => {
    http.fetch.mockRejectedValue(new ApiError({ status: 503, code: "INTEGRATIONS_NOT_CONFIGURED" }));
    mount();
    expect(await screen.findByText("As integrações ainda não estão disponíveis. Tente de novo mais tarde.")).toBeInTheDocument();
  });
});
