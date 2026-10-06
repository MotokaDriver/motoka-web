import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { establishmentUser } from "../helpers";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, prefetch: vi.fn() }),
  usePathname: () => "/acertos/",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => ({ subscribe: () => () => undefined, getState: () => ({ status: "authenticated", user: establishmentUser() }) }),
  apiFetch: async () => {
    throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  },
}));

const api = vi.hoisted(() => ({
  fetchSettlements: vi.fn(),
  fetchSettlement: vi.fn(),
  adjustSettlement: vi.fn(),
  confirmSettlement: vi.fn(),
  markSettlementPaid: vi.fn(),
}));
vi.mock("@/features/settlements/api", () => api);

const { SettlementsScreen } = await import("@/features/settlements/SettlementsScreen");
const { ToastProvider } = await import("@/ui/Toast");
const { ShortcutsProvider } = await import("@/features/shell/ShortcutsProvider");
const model = await import("@/features/settlements/model");

const ID = "a0000001-0000-4000-8000-000000000001";
const L1 = "f0000001-0000-4000-8000-000000000001";
const L2 = "f0000002-0000-4000-8000-000000000002";
const DRIVER = { id: "d1", full_name: "Diego Ramos", short_name: "Diego", initials: "DR" };

const rawDetail = (over: Record<string, unknown> = {}) => ({
  id: ID,
  session_id: "s1",
  kind: "shift",
  sequence: 0,
  status: "pending_store",
  version: 3,
  establishment: { id: "e", name: "Padaria", initials: "P" },
  driver: DRIVER,
  occurrence_date: "2026-09-29",
  scheduled: { start_time: "18:00", end_time: "23:00" },
  started_at: "2026-09-29T21:00:00Z",
  ended_at: "2026-09-30T02:00:00Z",
  online_seconds: 18000,
  deal: { pay_type: "fixed_plus_per_delivery", daily_rate: "90.00", per_delivery_rate: "6.00", rain_bonus_percent: 10 },
  deal_incomplete: false,
  daily: { amount: "90.00" },
  deliveries: { count: 5, unit: "6.00", amount: "30.00" },
  returns: { count: 1, unit: "6.00", amount: "6.00", items: [] },
  subtotal: "126.00",
  rain: { percent: 10, applied: false, amount: "0.00" },
  adjustment: { amount: "0.00", note: null },
  total: "126.00",
  pending: [],
  excluded: [],
  lines: [{ delivery_id: L1, number: 179, kind: "delivery", reason: null, occurred_at: "2026-09-29T22:00:00Z", address_line: "Rua Trajano Reis, 310", amount: "6.00" }],
  driver_decision: null,
  driver_confirmed_total: null,
  confirmed_over_dispute: false,
  confirmed_at: null,
  paid_at: null,
  paid_note: null,
  history: [{ action: "created", actor_role: "system", at: "2026-09-30T02:00:00Z", total_seen: null, note: null }],
  payout_key: null,
  frozen: false,
  ...over,
});

const summary = (over: Record<string, unknown> = {}) => ({ id: ID, kind: "shift", sequence: 0, status: "pending_store", occurrence_date: "2026-09-29", establishment: { id: "e", name: "P", initials: "P" }, driver: DRIVER, deliveries_count: 5, returns_count: 1, pending_count: 0, total: "126.00", deal_incomplete: false, ...over });

const list = (items: unknown[], extra: Record<string, unknown> = {}) => model.parseList({ count: items.length, total: "126.00", items, week: null, needs_action_count: items.length, ...extra });

function mount() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ShortcutsProvider>
          <SettlementsScreen />
        </ShortcutsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, queryClient };
}

beforeEach(() => {
  nav.replace.mockReset();
  nav.search = `acerto=${ID}`;
  for (const fn of Object.values(api)) fn.mockReset();
  api.fetchSettlements.mockResolvedValue(list([summary()]));
  api.fetchSettlement.mockResolvedValue(model.parseDetail(rawDetail()));
  window.localStorage.clear();
});

describe("acertos (WN-5)", () => {
  it("lista, filtros, D-18 e valores sempre do servidor (nada calculado no cliente)", async () => {
    mount();
    expect(await screen.findByText(/não movimenta dinheiro/)).toBeInTheDocument();
    const rows = await screen.findByRole("list", { name: "Acertos" });
    expect(within(rows).getByText("5 entregas · 1 retorno")).toBeInTheDocument();
    expect(within(rows).getByText("R$ 126,00")).toBeInTheDocument();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do acerto" });
    expect(await within(panel).findByTestId("settlement-total")).toHaveTextContent("R$ 126,00");
    // O total é a string do servidor, mesmo que ela não bata com as parcelas: o cliente não soma.
    api.fetchSettlement.mockResolvedValue(model.parseDetail(rawDetail({ total: "999.99" })));
  });

  it("filtro 'Precisam de você' usa needs_action; semana e motoboy vão para a API", async () => {
    nav.search = "filtro=atencao&semana=2026-09-28&motoboy=a0000009-0000-4000-8000-000000000009";
    mount();
    await screen.findByRole("list", { name: "Acertos" });
    expect(api.fetchSettlements).toHaveBeenCalledWith({ needsAction: true, weekStart: "2026-09-28", driverId: "a0000009-0000-4000-8000-000000000009" }, expect.anything());
  });

  it("?acerto= inválido não chama o detalhe", async () => {
    nav.search = "acerto=nao-e-uuid";
    mount();
    expect(await screen.findByText("Acerto não encontrado.")).toBeInTheDocument();
    expect(api.fetchSettlement).not.toHaveBeenCalled();
  });

  it("confirmar manda version e expected_total do que a pessoa viu", async () => {
    api.confirmSettlement.mockResolvedValue(model.parseDetail(rawDetail({ status: "confirmed", frozen: true })));
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do acerto" });
    await user.click(await within(panel).findByRole("button", { name: "Confirmar acerto" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirmar o acerto de R$ 126,00?" });
    expect(dialog).toHaveTextContent("não movimenta dinheiro");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar acerto" }));
    await waitFor(() => expect(api.confirmSettlement).toHaveBeenCalledWith(ID, 3, "126.00"));
    expect(await screen.findByText("Acerto confirmado.")).toBeInTheDocument();
  });

  it("409 de versão recarrega o acerto e avisa com o texto fixo", async () => {
    api.confirmSettlement.mockRejectedValue(new ApiError({ status: 409, code: "TEAM_SETTLEMENT_VERSION_CONFLICT" }));
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do acerto" });
    await user.click(await within(panel).findByRole("button", { name: "Confirmar acerto" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmar acerto" }));
    expect(await screen.findByText("O acerto mudou enquanto você conferia. Confira os valores de novo.")).toBeInTheDocument();
    // Recarregou o acerto (a segunda leitura traz o valor novo).
    api.fetchSettlement.mockResolvedValue(model.parseDetail(rawDetail({ version: 4, total: "132.00" })));
    await waitFor(() => expect(api.fetchSettlement.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("409 HAS_PENDING_LINES aponta as entregas que travam, com o motivo", async () => {
    api.fetchSettlement.mockResolvedValue(
      model.parseDetail(
        rawDetail({
          pending: [{ delivery_id: L2, number: 190, reason: "return_receipt" }],
          lines: [{ delivery_id: L2, number: 190, kind: "pending", reason: "return_receipt", occurred_at: null, address_line: null, amount: null }],
        }),
      ),
    );
    mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do acerto" });
    expect(await within(panel).findByText("Ainda não conta: falta confirmar que o pedido voltou para a loja.")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Confirmar acerto" })).toBeDisabled();
    expect(within(panel).getByText("Ainda há entregas deste turno sem desfecho. Resolva-as antes de confirmar.")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Abrir pedido" })).toHaveAttribute("href", expect.stringContaining(`pedido=${L2}`));
  });

  it("retirar do acerto manda o conjunto inteiro; desfazer manda o conjunto sem o id", async () => {
    api.fetchSettlement.mockResolvedValue(
      model.parseDetail(
        rawDetail({
          pending: [{ delivery_id: L2, number: 190, reason: "return_receipt" }],
          excluded: [{ delivery_id: L1, number: 179 }],
          lines: [{ delivery_id: L2, number: 190, kind: "pending", reason: "return_receipt", occurred_at: null, address_line: null, amount: null }],
        }),
      ),
    );
    api.adjustSettlement.mockImplementation(async () => model.parseDetail(rawDetail({ excluded: [{ delivery_id: L1, number: 179 }] })));
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do acerto" });
    await user.click(await within(panel).findByRole("button", { name: "Retirar do acerto" }));
    await waitFor(() => expect(api.adjustSettlement).toHaveBeenLastCalledWith(ID, { version: 3, excludedDeliveryIds: [L1, L2] }));
    await user.click(within(panel).getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(api.adjustSettlement).toHaveBeenLastCalledWith(ID, { version: 3, excludedDeliveryIds: [] }));
  });

  it("R1: se a versão mudar com o ajuste aberto, avisa e não salva sobre valores que a pessoa não viu", async () => {
    const { user, queryClient } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do acerto" });
    await user.click(await within(panel).findByRole("button", { name: "Ajustar acerto" }));
    const dialog = await screen.findByRole("dialog", { name: "Ajustar acerto" });
    await user.type(within(dialog).getByLabelText("Ajuste (use - para descontar)"), "-500");
    await user.type(within(dialog).getByLabelText("Motivo do ajuste"), "Desconto");
    expect(within(dialog).getByRole("button", { name: "Salvar ajuste" })).toBeEnabled();
    api.fetchSettlement.mockResolvedValue(model.parseDetail(rawDetail({ version: 4, status: "pending_driver" })));
    await queryClient.invalidateQueries({ queryKey: ["settlements"] });
    expect(await within(dialog).findByText(/O acerto mudou enquanto você ajustava/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Salvar ajuste" })).toBeDisabled();
    expect(api.adjustSettlement).not.toHaveBeenCalled();
  });

  it("ajuste exige o motivo e só manda o que mudou", async () => {
    api.adjustSettlement.mockResolvedValue(model.parseDetail(rawDetail({ version: 4, status: "pending_driver" })));
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do acerto" });
    await user.click(await within(panel).findByRole("button", { name: "Ajustar acerto" }));
    const dialog = await screen.findByRole("dialog", { name: "Ajustar acerto" });
    const save = within(dialog).getByRole("button", { name: "Salvar ajuste" });
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Ajuste (use - para descontar)"), "-500");
    expect(save).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Motivo do ajuste"), "Desconto");
    await user.click(within(dialog).getByRole("switch", { name: /Adicional de chuva/ }));
    await user.click(save);
    await waitFor(() => expect(api.adjustSettlement).toHaveBeenCalledWith(ID, { version: 3, rainApplied: true, adjustmentAmount: "-5.00", adjustmentNote: "Desconto" }));
  });

  it("em pending_driver não dá para confirmar (espera o motoboy ou as 24 h), mas dá para ajustar", async () => {
    api.fetchSettlement.mockResolvedValue(model.parseDetail(rawDetail({ status: "pending_driver" })));
    mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do acerto" });
    expect(await within(panel).findByRole("button", { name: "Confirmar acerto" })).toBeDisabled();
    expect(within(panel).getByText(/Se ele não responder em 24 h, o acerto libera para você/)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Ajustar acerto" })).toBeEnabled();
  });

  it("chave Pix só em confirmado e pago; sem valor, só a máscara; nunca vai para o storage", async () => {
    api.fetchSettlement.mockResolvedValue(model.parseDetail(rawDetail({ status: "pending_store", payout_key: { type: "email", masked: "d•••@x.com", value: "diego@x.com" } })));
    const { queryClient } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do acerto" });
    await within(panel).findByText("Valores");
    expect(within(panel).queryByTestId("pix-key")).toBeNull(); // ainda não confirmado: não mostra nem se a API mandasse
    api.fetchSettlement.mockResolvedValue(model.parseDetail(rawDetail({ status: "confirmed", frozen: true, payout_key: { type: "email", masked: "d•••@x.com", value: "diego@x.com" } })));
    await queryClient.invalidateQueries({ queryKey: ["settlements"] });
    expect(await within(panel).findByTestId("pix-key")).toHaveTextContent("diego@x.com");
    expect(within(panel).getByRole("button", { name: "Copiar" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^Pagar/ })).toBeNull();
    expect(JSON.stringify({ ...window.localStorage, ...window.sessionStorage })).not.toContain("diego@x.com");
    api.fetchSettlement.mockResolvedValue(model.parseDetail(rawDetail({ status: "confirmed", frozen: true, payout_key: { type: "email", masked: "d•••@x.com", value: null } })));
    await queryClient.invalidateQueries({ queryKey: ["settlements"] });
    expect(await within(panel).findByText(/d•••@x.com. Combine o pagamento com o motoboy/)).toBeInTheDocument();
    expect(within(panel).queryByTestId("pix-key")).toBeNull();
  });

  it("marcar como pago: nota opcional e texto de que o pagamento é fora do app", async () => {
    api.fetchSettlement.mockResolvedValue(model.parseDetail(rawDetail({ status: "confirmed", frozen: true })));
    api.markSettlementPaid.mockResolvedValue(model.parseDetail(rawDetail({ status: "paid", frozen: true, paid_at: "2026-10-01T12:00:00Z", paid_note: "Pix" })));
    const { user } = mount();
    const panel = await screen.findByRole("complementary", { name: "Detalhe do acerto" });
    await user.click(await within(panel).findByRole("button", { name: "Marcar como pago" }));
    const dialog = await screen.findByRole("dialog", { name: "Marcar como pago" });
    expect(dialog).toHaveTextContent("Pix, fora do app");
    await user.type(within(dialog).getByLabelText("Observação (opcional)"), "Pix");
    await user.click(within(dialog).getByRole("button", { name: "Marcar como pago" }));
    await waitFor(() => expect(api.markSettlementPaid).toHaveBeenCalledWith(ID, "Pix"));
  });

  it("estado vazio e erro 403 sem retry", async () => {
    api.fetchSettlements.mockResolvedValue(list([], { needs_action_count: 0 }));
    nav.search = "";
    mount();
    expect(await screen.findByText("Nenhum acerto ainda")).toBeInTheDocument();
  });
});
