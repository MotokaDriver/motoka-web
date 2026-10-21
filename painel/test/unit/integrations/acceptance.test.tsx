import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup as cleanupRender, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const nav = vi.hoisted(() => ({ push: vi.fn(), path: "/pedidos/" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => nav.path,
  useSearchParams: () => new URLSearchParams(""),
}));

const http = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => ({ subscribe: () => () => undefined, getState: () => ({ status: "authenticated" }) }),
  apiFetch: (path: string, init?: unknown) => http.fetch(path, init),
}));

const { AcceptanceHost } = await import("@/features/acceptance/AcceptanceHost");
const { parseAwaiting, secondsLeft, clock, canAccept } = await import("@/features/acceptance/model");
const { ToastProvider } = await import("@/ui/Toast");
const { HIDDEN_INTERVAL_MS, awaitingKey } = await import("@/features/acceptance/hooks");
const { alertTitle } = await import("@/features/acceptance/alerts");
const { setAcceptSound } = await import("@/lib/prefs/prefs");
const { integrationKeys } = await import("@/features/integrations/hooks");
const { classify } = await import("@/features/live/attention");
const { availableActions, deliveryAlerts } = await import("@/features/deliveries/logic");
const { parseItem } = await import("@/features/deliveries/model");

const ID = "a0000001-0000-4000-8000-000000000001";
const DRIVER = "d0000001-0000-4000-8000-000000000001";

const raw = (over: Record<string, unknown> = {}) => ({
  id: ID,
  number: 189,
  origin: "open_delivery",
  channel: null,
  status: "awaiting_acceptance",
  customer: { name: "Marina Souza", address_line: "Rua Chile, 1880", neighborhood: "Rebouças" },
  driver: null,
  previewed_driver: { id: DRIVER, short_name: "Diego R.", initials: "DR" },
  needs_attention: true,
  accept_deadline_at: new Date(Date.now() + 100_000).toISOString(),
  situation: "busy",
  ...over,
});

function snapshot(items: Array<Record<string, unknown>>, serverOffsetMs = 0) {
  return { server_time: new Date(Date.now() + serverOffsetMs).toISOString(), items, team_now: [{ id: DRIVER, short_name: "Diego R.", free_in_minutes: 4 }] };
}

let lastClient: QueryClient | null = null;
function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  lastClient = queryClient;
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AcceptanceHost />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user };
}

function serve(items: Array<Record<string, unknown>>, extra: (path: string, init?: { method?: string; body?: Record<string, unknown> }) => unknown = () => undefined) {
  http.fetch.mockImplementation(async (path: string, init?: { method?: string; body?: Record<string, unknown> }) => {
    if (path === "/web/capabilities") return {};
    if (path === "/deliveries/awaiting-acceptance") return snapshot(items);
    if (path === "/integrations") return [{ type: "open_delivery", status: "connected" }];
    const result = extra(path, init);
    if (result instanceof Error) throw result;
    return result;
  });
}

beforeEach(() => {
  http.fetch.mockReset();
  nav.push.mockReset();
  nav.path = "/pedidos/";
});

describe("modelo do aceite", () => {
  it("contagem pelo relógio do servidor, não pelo da máquina", () => {
    const local = Date.parse("2026-10-06T12:00:00Z");
    // O servidor está 30 s à frente do relógio local.
    const awaiting = parseAwaiting(snapshot([raw({ accept_deadline_at: "2026-10-06T12:01:40Z" })], 0), local);
    const withSkew = { ...awaiting, offsetMs: 30_000 };
    expect(secondsLeft("2026-10-06T12:01:40Z", withSkew.offsetMs, local)).toBe(70);
    expect(secondsLeft("2026-10-06T12:01:40Z", 0, local)).toBe(100);
    expect(secondsLeft("2026-10-06T11:59:00Z", 0, local)).toBe(0);
    expect(secondsLeft(null, 0, local)).toBeNull();
    expect(clock(100)).toBe("1:40");
    expect(clock(5)).toBe("0:05");
  });

  it("sem previsto ou sem ninguém em turno, só dá para recusar", () => {
    const items = parseAwaiting(snapshot([raw(), raw({ id: "x", situation: "empty", previewed_driver: null }), raw({ id: "y", previewed_driver: null })]), Date.now()).items;
    expect(items.map(canAccept)).toEqual([true, false, false]);
  });
});

describe("banner e drawer de aceite (WN-4a)", () => {
  it("mostra o banner e responde: aceitar manda o action_id", async () => {
    serve([raw()], () => undefined);
    const { user } = mount();
    expect(await screen.findByText("1 pedido esperando o seu aceite")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Responder" }));
    const list = await screen.findByRole("list", { name: "Pedidos esperando o aceite" });
    expect(within(list).getByText("Pedido #189")).toBeInTheDocument();
    expect(within(list).getByText(/Diego R\. é o motoboy previsto, livre em 4 min/)).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Aceitar · Diego R. leva" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith(`/deliveries/${ID}/accept`, expect.objectContaining({ method: "POST", body: { action_id: expect.any(String) } })));
  });

  it("aceitar e chamar reforço leva a Solicitar serviço", async () => {
    serve([raw()]);
    const { user } = mount();
    await user.click(await screen.findByRole("button", { name: "Responder" }));
    await user.click(await screen.findByRole("button", { name: "Aceitar e chamar reforço" }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/servicos/novo/"));
  });

  it("recusar pede confirmação e avisa a origem", async () => {
    serve([raw()]);
    const { user } = mount();
    await user.click(await screen.findByRole("button", { name: "Responder" }));
    const list = await screen.findByRole("list", { name: "Pedidos esperando o aceite" });
    await user.click(within(list).getByRole("button", { name: "Recusar" }));
    const dialog = await screen.findByRole("dialog", { name: "Recusar o pedido #189?" });
    expect(http.fetch).not.toHaveBeenCalledWith(`/deliveries/${ID}/reject`, expect.anything());
    await user.click(within(dialog).getByRole("button", { name: "Recusar" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith(`/deliveries/${ID}/reject`, expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText("Pedido #189 recusado. O Open Delivery foi avisado.")).toBeInTheDocument();
  });

  it("sem ninguém em turno só existe a recusa", async () => {
    serve([raw({ situation: "empty", previewed_driver: null })]);
    const { user } = mount();
    await user.click(await screen.findByRole("button", { name: "Responder" }));
    const list = await screen.findByRole("list", { name: "Pedidos esperando o aceite" });
    expect(within(list).getByText("Ninguém em turno agora: só dá para recusar.")).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: /Aceitar/ })).toBeNull();
    expect(within(list).getByRole("button", { name: "Recusar" })).toBeInTheDocument();
  });

  it("prazo zerado trava os botões e mostra Recusando…", async () => {
    serve([raw({ accept_deadline_at: new Date(Date.now() - 1000).toISOString() })]);
    const { user } = mount();
    await user.click(await screen.findByRole("button", { name: "Responder" }));
    expect(await screen.findByText("Recusando…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aceitar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recusar" })).toBeNull();
  });

  it("409 de prazo mostra o texto do catálogo, nunca o detail", async () => {
    serve([raw()], (path) => (path.endsWith("/accept") ? new ApiError({ status: 409, code: "DELIVERY_ACCEPT_DEADLINE_PASSED" }) : undefined));
    const { user } = mount();
    await user.click(await screen.findByRole("button", { name: "Responder" }));
    await user.click(await screen.findByRole("button", { name: "Aceitar · Diego R. leva" }));
    expect(await screen.findByText("O prazo acabou e o pedido foi recusado.")).toBeInTheDocument();
  });

  it("sem pedido esperando não há banner", async () => {
    serve([]);
    mount();
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/deliveries/awaiting-acceptance", expect.anything()));
    expect(screen.queryByRole("region", { name: "Pedidos esperando o seu aceite" })).toBeNull();
  });

  it("fora de /pedidos só consulta se há integração conectada", async () => {
    nav.path = "/equipe/";
    http.fetch.mockImplementation(async (path: string) => {
      if (path === "/web/capabilities") return {};
      if (path === "/integrations") return [{ type: "open_delivery", status: "available" }];
      return snapshot([raw()]);
    });
    mount();
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations", expect.anything()));
    expect(http.fetch).not.toHaveBeenCalledWith("/deliveries/awaiting-acceptance", expect.anything());
  });
});

describe("origem que não confirmou o aceite", () => {
  const item = parseItem({ ...raw({ status: "preparing", needs_attention: true, origin_unconfirmed: true, driver: { id: DRIVER, short_name: "Diego", initials: "D" } }) });
  it("entra em precisa de atenção com o texto fixo e a loja ganha o Cancelar", () => {
    const attention = classify(item);
    expect(attention.kind).toBe("origin_unconfirmed");
    expect(attention.title).toBe("#189 · Open Delivery não confirmou o aceite");
    const bar = availableActions({ status: "preparing", origin: "open_delivery", cancellation: null, flags: { latePickup: false, deliveredAfterCancel: false }, originUnconfirmed: true });
    expect(bar.actions.map((a) => a.id)).toContain("cancel");
    const without = availableActions({ status: "preparing", origin: "open_delivery", cancellation: null, flags: { latePickup: false, deliveredAfterCancel: false } });
    expect(without.actions.map((a) => a.id)).not.toContain("cancel");
  });
  it("alerta do pedido", () => {
    const alerts = deliveryAlerts({ ...item, originUnconfirmed: true, cancellation: null, problem: null, flags: { latePickup: false, deliveredAfterCancel: false }, code: { locked: false }, address: {}, geocodeStatus: "ok" } as never, () => "12:00");
    expect(alerts.map((a) => a.text)).toContain("O Open Delivery não confirmou o aceite. Confira o pedido no seu sistema.");
  });
});

describe("aba oculta e conexão nova (R1 e R2)", () => {
  const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    document.dispatchEvent(new Event("visibilitychange"));
  };

  it("com a aba oculta o polling não pausa: segue em segundo plano, a cada 30 s", async () => {
    serve([]);
    mount();
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/deliveries/awaiting-acceptance", expect.anything()));
    const options = lastClient?.getQueryCache().find({ queryKey: awaitingKey })?.options as { refetchIntervalInBackground?: boolean; refetchInterval?: unknown } | undefined;
    expect(options?.refetchIntervalInBackground).toBe(true);
    const interval = options?.refetchInterval as (q: unknown) => number | false;
    const query = lastClient?.getQueryCache().find({ queryKey: awaitingKey });
    setHidden(true);
    try {
      expect(interval(query)).toBe(HIDDEN_INTERVAL_MS);
    } finally {
      setHidden(false);
    }
    expect(interval(query)).toBe(5_000);
  });

  it("o título pisca com (1) Pedido aguardando enquanto a aba está oculta, e volta ao original", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    document.title = "Pedidos";
    serve([raw()]);
    mount();
    await screen.findByText("1 pedido esperando o seu aceite");
    expect(document.title).toBe("Pedidos"); // visível: o título fica quieto
    setHidden(true);
    try {
      expect(document.title).toBe(alertTitle(1));
      expect(alertTitle(1)).toBe("(1) Pedido aguardando");
      await vi.advanceTimersByTimeAsync(1100);
      expect(document.title).toBe("Pedidos");
      await vi.advanceTimersByTimeAsync(1000);
      expect(document.title).toBe(alertTitle(1));
    } finally {
      setHidden(false);
      vi.useRealTimers();
    }
    await waitFor(() => expect(document.title).toBe("Pedidos"));
  });

  it("o som fica desligado até a pessoa ligar", async () => {
    const created: number[] = [];
    class FakeAudio {
      currentTime = 0;
      destination = {};
      constructor() {
        created.push(1);
      }
      resume = vi.fn(async () => undefined);
      createOscillator = () => ({ frequency: { value: 0 }, connect: (n: unknown) => n, start: vi.fn(), stop: vi.fn() });
      createGain = () => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: (n: unknown) => n });
    }
    vi.stubGlobal("AudioContext", FakeAudio);
    try {
      setAcceptSound(false);
      serve([raw()]);
      mount();
      await screen.findByText("1 pedido esperando o seu aceite");
      expect(created).toHaveLength(0);
      cleanupRender();
      setAcceptSound(true);
      serve([raw({ id: "b0000001-0000-4000-8000-000000000001" })]);
      mount();
      await screen.findByText("1 pedido esperando o seu aceite");
      await waitFor(() => expect(created.length).toBeGreaterThan(0));
    } finally {
      setAcceptSound(false);
      vi.unstubAllGlobals();
    }
  });

  it("conectar a integração invalida o aviso e liga o banner fora de /pedidos sem esperar", async () => {
    nav.path = "/equipe/";
    let status = "available";
    http.fetch.mockImplementation(async (path: string) => {
      if (path === "/web/capabilities") return {};
      if (path === "/integrations") return [{ type: "open_delivery", status }];
      return snapshot([raw()]);
    });
    mount();
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/integrations", expect.anything()));
    expect(http.fetch).not.toHaveBeenCalledWith("/deliveries/awaiting-acceptance", expect.anything());
    status = "connected";
    // A tela de Integrações invalida a raiz depois de salvar ou conectar.
    await lastClient?.invalidateQueries({ queryKey: integrationKeys.all });
    expect(await screen.findByText("1 pedido esperando o seu aceite")).toBeInTheDocument();
  });
});
