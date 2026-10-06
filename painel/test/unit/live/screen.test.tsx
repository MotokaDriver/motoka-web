import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { establishmentUser } from "../helpers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/ao-vivo/",
  useSearchParams: () => new URLSearchParams(""),
}));

const sessionState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => ({ subscribe: () => () => undefined, getState: () => sessionState.current, getAccessToken: () => null }),
  apiFetch: async () => {
    throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  },
}));

const live = vi.hoisted(() => ({ fetchLive: vi.fn(), attached: 0, detached: 0 }));
vi.mock("@/features/live/api", () => ({ fetchLive: live.fetchLive, LIVE_STREAM_URL: "http://api.test/v1/tracking/live/stream" }));
vi.mock("@/features/live/stream", () => ({
  LiveStream: class {
    attach() {
      live.attached += 1;
    }
    detach() {
      live.detached += 1;
    }
    setHidden() {}
  },
}));
const deliveries = vi.hoisted(() => ({ fetchList: vi.fn() }));
vi.mock("@/features/deliveries/api", () => ({ fetchList: deliveries.fetchList, PAGE_SIZE: 100 }));

const { LiveScreen } = await import("@/features/live/LiveScreen");
const { ToastProvider } = await import("@/ui/Toast");
const { ShortcutsProvider } = await import("@/features/shell/ShortcutsProvider");
const { parseSnapshot } = await import("@/features/live/model");
const { parseItem } = await import("@/features/deliveries/model");

const SERVER = Date.now();
const driver = (id: string, name: string, over: Record<string, unknown> = {}) => ({
  driver: { id, full_name: name, short_name: name.split(" ")[0], initials: name.slice(0, 2).toUpperCase(), phone: "5541999990077" },
  membership_id: `m-${id}`,
  shift: { shift_id: "s", occurrence_date: "2026-10-05", starts_at: new Date(SERVER - 3_600_000).toISOString(), ends_at: new Date(SERVER + 3_600_000).toISOString() },
  session: { id: "x", started_at: new Date(SERVER - 3_600_000).toISOString() },
  state: "delivering",
  position: { lat: -25.4, lng: -49.2, accuracy_m: 5, heading: 0, speed_mps: 3, recorded_at: new Date(SERVER - 5_000).toISOString() },
  done_today: { deliveries: 2, returns: 0 },
  last_delivered_at: null,
  current: null,
  stops: [],
  ...over,
});

function snapshot(drivers: unknown[]) {
  return {
    snapshot: parseSnapshot({
      server_time: new Date(SERVER).toISOString(),
      no_signal_after_seconds: 180,
      at_store_radius_m: 60,
      establishment: { id: "e", name: "Padaria", location: { lat: -25.43, lng: -49.27 } },
      counts: { done_today: { deliveries: 7, returns: 1 } },
      drivers,
    }),
    receivedAt: Date.now(),
  };
}

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ShortcutsProvider>
          <LiveScreen />
        </ShortcutsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user };
}

beforeEach(() => {
  sessionState.current = { status: "authenticated", user: establishmentUser() };
  live.fetchLive.mockReset();
  live.attached = 0;
  live.detached = 0;
  deliveries.fetchList.mockReset().mockResolvedValue({ total: 0, items: [], counts: { open: 0, all: 0 } });
});

describe("mapa ao vivo", () => {
  it("sem NEXT_PUBLIC_MAP_STYLE_URL: Mapa não configurado, e a lateral funciona", async () => {
    live.fetchLive.mockResolvedValue(
      snapshot([driver("d1", "Diego Ramos"), driver("d2", "Rafa Lima", { state: "returning" }), driver("d3", "Paulo Nunes", { state: "not_started", position: null })]),
    );
    const { user } = mount();
    expect(await screen.findByText("Mapa não configurado")).toBeInTheDocument();
    expect(screen.getByText("A lista ao lado continua atualizando.")).toBeInTheDocument();
    const side = screen.getByRole("complementary", { name: "Equipe agora" });
    expect(await within(side).findByRole("button", { name: /Diego Ramos, Entregando, posição/ })).toBeInTheDocument();
    expect(within(side).getByText(/3 em turno/)).toBeInTheDocument();
    expect(within(side).getByRole("button", { name: /Paulo Nunes, Sem sinal, posição sem posição/ })).toBeInTheDocument();
    // Ordem: sem sinal, entregando, voltando.
    const names = within(side).getAllByRole("button", { name: /, (Entregando|Voltando|Sem sinal),/ }).map((b) => b.getAttribute("aria-label")?.split(",")[0]);
    expect(names).toEqual(["Paulo Nunes", "Diego Ramos", "Rafa Lima"]);
    // Contagens do topo derivadas do estado local.
    expect(screen.getByText("3 em turno · 1 entrega na rua · 7 feitas hoje")).toBeInTheDocument();
    // Filtros e contagens batem com os cartões.
    await user.click(within(side).getByRole("button", { name: "Voltando 1" }));
    expect(within(side).getAllByRole("button", { name: /, (Entregando|Voltando|Sem sinal),/ })).toHaveLength(1);
    await user.click(within(side).getByRole("button", { name: "Sem sinal 1" }));
    expect(within(side).getByRole("button", { name: /Paulo Nunes/ })).toBeInTheDocument();
    // O transporte abriu ao entrar na tela.
    expect(live.attached).toBe(1);
  });

  it("selecionar um cartão abre o painel do motoboy com Ligar e WhatsApp; sem sinal não abre", async () => {
    live.fetchLive.mockResolvedValue(snapshot([driver("d1", "Diego Ramos", { stops: [{ delivery_id: "e1", number: 184, origin: "manual", status: "on_the_way", destination: null, customer: { name: "Marina", address_line: "Rua A, 1" } }] }), driver("d2", "Paulo Nunes", { state: "no_signal", position: null })]));
    const { user } = mount();
    await user.click(await screen.findByRole("button", { name: /Diego Ramos/ }));
    const panel = screen.getByRole("region", { name: "Detalhe de Diego Ramos" });
    expect(within(panel).getByText("#184 · Marina")).toBeInTheDocument();
    expect(within(panel).getByText("Endereço sem localização no mapa")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Ligar" })).toHaveAttribute("href", "tel:+5541999990077");
    expect(within(panel).getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", expect.stringContaining("wa.me/5541999990077"));
    await user.click(screen.getByRole("button", { name: /Paulo Nunes/ }));
    expect(screen.queryByRole("region", { name: /Detalhe de/ })).toBeNull();
  });

  it("ninguém em turno; 403 sem retry; ROUTE_NOT_FOUND é modo sem rastreio, não erro", async () => {
    live.fetchLive.mockResolvedValue(snapshot([]));
    mount();
    expect(await screen.findByText("Nenhum motoboy em turno agora")).toBeInTheDocument();
    expect(screen.getByText("Ninguém em turno")).toBeInTheDocument();
  });

  it("403: texto fixo, sem tentar de novo", async () => {
    live.fetchLive.mockRejectedValue(new ApiError({ status: 403, code: "FORBIDDEN" }));
    mount();
    expect(await screen.findByText("Você não tem permissão para ver o mapa ao vivo.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
  });

  it("404 ROUTE_NOT_FOUND: mensagem do rastreio ainda não ativado, sem erro", async () => {
    live.fetchLive.mockRejectedValue(new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" }));
    mount();
    expect(await screen.findByText("O rastreio dos motoboys ainda não foi ativado para a sua conta.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("bloco de atenção aparece e leva ao pedido", async () => {
    live.fetchLive.mockResolvedValue(snapshot([driver("d1", "Diego Ramos")]));
    deliveries.fetchList.mockResolvedValue({
      total: 1,
      counts: { open: 1, all: 1 },
      items: [
        parseItem({ id: "e0000001-0000-4000-8000-000000000001", number: 187, origin: "cardapio_web", status: "preparing", customer: { name: "Ana", address_line: "R", neighborhood: "C" }, tracking: {}, needs_attention: true, created_at: "2026-10-05T21:00:00Z" }),
      ],
    });
    mount();
    const link = await screen.findByRole("link", { name: /#187 · Sem motoboy/ });
    expect(link).toHaveAttribute("href", expect.stringMatching(/pedidos.?.pedido=e0000001-0000-4000-8000-000000000001$/));
  });
});
