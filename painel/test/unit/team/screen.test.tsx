import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { weekStart as mondayOf, addDays, spDay } from "@/lib/time/saoPaulo";
import { resetOverlays } from "@/ui/overlays";
import { establishmentUser } from "../helpers";

const nav = vi.hoisted(() => ({ push: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/equipe/",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const sessionState = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => ({
    subscribe: () => () => undefined,
    getState: () => sessionState.current,
  }),
  apiFetch: async () => {
    throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  },
}));

const api = vi.hoisted(() => ({
  fetchSchedule: vi.fn(),
  fetchOnShift: vi.fn(),
  updateDeal: vi.fn(),
  memberAction: vi.fn(),
  fetchInviteLink: vi.fn(),
  rotateInviteLink: vi.fn(),
  createNominalInvite: vi.fn(),
  fetchInvites: vi.fn(),
  resendInvite: vi.fn(),
  revokeInvite: vi.fn(),
  createShifts: vi.fn(),
  deleteShift: vi.fn(),
}));
vi.mock("@/features/team/api", () => api);

const { TeamScreen } = await import("@/features/team/TeamScreen");
const { ShortcutsProvider } = await import("@/features/shell/ShortcutsProvider");
const { ToastProvider } = await import("@/ui/Toast");
const model = await import("@/features/team/model");

const MONDAY = mondayOf(spDay(new Date()));
const DIEGO = "11111111-1111-4111-8111-111111111111";
const RAFA = "22222222-2222-4222-8222-222222222222";
const BRUNO = "33333333-3333-4333-8333-333333333333";
const SHIFT_D = "44444444-4444-4444-8444-444444444444";
const DEAL = { pay_type: "fixed_plus_per_delivery", daily_rate: "90.00", per_delivery_rate: "6.00", rain_bonus_percent: null };
const driver = (id: string, name: string, initials: string) => ({ id, full_name: name, short_name: name, initials, phone: null });

function rawSchedule(over: Record<string, unknown> = {}) {
  return {
    week_start: MONDAY,
    week_end: addDays(MONDAY, 6),
    today: spDay(new Date()),
    members: [
      { id: DIEGO, driver: driver("d1", "Diego Ramos", "DR"), status: "active", source: "link", access: "team", joined_at: "x", deal: DEAL, also_in_other_team: true },
      { id: RAFA, driver: driver("d2", "Rafa Lima", "RL"), status: "paused", source: "link", access: "full", joined_at: "x", deal: DEAL, also_in_other_team: false },
    ],
    pending_invites: [
      { id: BRUNO, invitee_name: "Bruno Carvalho", invitee_phone: "5541997332208", initials: "BC", created_at: new Date().toISOString(), status: "not_opened" },
    ],
    occurrences: [
      { shift_id: SHIFT_D, series_id: SHIFT_D, membership_id: DIEGO, driver_id: "d1", date: addDays(MONDAY, 3), start_time: "18:00", end_time: "23:00", repeats_weekly: true, remind_location: true, suspended: false, session: null },
      { shift_id: "55555555-5555-4555-8555-555555555555", series_id: "55555555-5555-4555-8555-555555555555", membership_id: RAFA, driver_id: "d2", date: addDays(MONDAY, 4), start_time: "11:00", end_time: "15:00", repeats_weekly: true, remind_location: true, suspended: true, session: null },
    ],
    busy: [{ driver_id: "d1", date: addDays(MONDAY, 0), start_time: "18:00", end_time: "22:00" }],
    coverage: [{ date: addDays(MONDAY, 0), lunch: 2, night: 0 }],
    ...over,
  };
}

function setup(raw: unknown = rawSchedule(), onGridRender?: () => void) {
  api.fetchSchedule.mockImplementation(async () => model.parseSchedule(raw));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ShortcutsProvider>
          <TeamScreen onGridRender={onGridRender} />
        </ShortcutsProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { user, queryClient, view };
}

beforeEach(() => {
  sessionState.current = { status: "authenticated", user: establishmentUser() };
  resetOverlays();
  nav.push.mockReset();
  nav.search = "";
  for (const fn of Object.values(api)) fn.mockReset();
  api.fetchOnShift.mockResolvedValue([]);
  api.memberAction.mockResolvedValue({});
  api.deleteShift.mockResolvedValue(undefined);
  api.fetchInviteLink.mockResolvedValue({ id: "l1", url: `${location.origin}/convite/tok`, joinsLast24h: 2 });
  api.fetchInvites.mockResolvedValue([]);
});

describe("grade", () => {
  it("mostra membro, chips, +1 equipe, turno suspenso, ocupado, convite pendente e cobertura sem cortar", async () => {
    setup();
    expect(await screen.findByText("Diego Ramos")).toBeInTheDocument();
    expect(screen.getByText("Só equipe · sem KYC")).toBeInTheDocument();
    expect(screen.getByText("Pausado")).toBeInTheDocument();
    expect(screen.getByText(/\+1 equipe/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /turno suspenso enquanto Rafa Lima está pausado, turno das 11h às 15h/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /ocupado em outra equipe das 18h às 22h/ })).toBeInTheDocument();
    expect(screen.getByText("Convite pendente")).toBeInTheDocument();
    expect(screen.getByText("Os turnos ficam liberados assim que ele aceitar o convite.")).toBeInTheDocument();
    // B-2: "sem ninguém" inteiro, em linha própria, sem reticências.
    expect(screen.getAllByText("sem ninguém").length).toBeGreaterThan(0);
    expect(screen.getByText("Almoço 2")).toBeInTheDocument();
    for (const cell of screen.getAllByRole("button", { name: /Rafa Lima, .*sem turno./ })) expect(cell).toBeDisabled();
  });

  it("dois ticks iguais não renderizam a grade de novo", async () => {
    const renders = vi.fn();
    const { queryClient } = setup(rawSchedule(), renders);
    await screen.findByText("Diego Ramos");
    await waitFor(() => expect(api.fetchOnShift).toHaveBeenCalled());
    await act(async () => {});
    const before = renders.mock.calls.length;
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ["team"] });
      });
    }
    expect(api.fetchSchedule.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(renders.mock.calls.length).toBe(before);
  });

  it("equipe vazia tem CTA", async () => {
    setup(rawSchedule({ members: [], pending_invites: [], occurrences: [] }));
    expect(await screen.findByText("Sua equipe ainda está vazia")).toBeInTheDocument();
  });

  it("403 não oferece tentar de novo", async () => {
    api.fetchSchedule.mockRejectedValue(new ApiError({ status: 403, code: "FORBIDDEN" }));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <ShortcutsProvider>
            <TeamScreen />
          </ShortcutsProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Você não tem permissão para realizar esta ação.");
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
  });

  it("[ e ] trocam a semana pela URL", async () => {
    const { user } = setup();
    await screen.findByText("Diego Ramos");
    await user.keyboard("]");
    expect(nav.push).toHaveBeenCalledWith(`/equipe/?semana=${addDays(MONDAY, 7)}`);
    await user.keyboard("[[");
    expect(nav.push).toHaveBeenLastCalledWith(`/equipe/?semana=${addDays(MONDAY, -7)}`);
  });
});

describe("semana passada e sem turnos", () => {
  it("semana passada é só consulta: adicionar desabilitado e turno sem remover", async () => {
    const last = addDays(MONDAY, -7);
    nav.search = `semana=${last}`;
    const raw = rawSchedule({
      week_start: last,
      week_end: addDays(last, 6),
      occurrences: [
        { shift_id: SHIFT_D, series_id: SHIFT_D, membership_id: DIEGO, driver_id: "d1", date: addDays(last, 3), start_time: "18:00", end_time: "23:00", repeats_weekly: true, remind_location: true, suspended: false, session: null },
      ],
    });
    const { user } = setup(raw);
    await screen.findByText("Diego Ramos");
    expect(screen.getByText("Semana passada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar turno" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Diego Ramos, .*turno das 18h às 23h/ }));
    const menu = await screen.findByRole("dialog", { name: /18:00–23:00/ });
    expect(within(menu).getByRole("button", { name: "Remover turno" })).toBeDisabled();
    expect(menu).toHaveTextContent("Semanas passadas são só para consulta.");
  });

  it("sem turnos: o aviso só convida a clicar quando dá para adicionar", async () => {
    const { view } = setup(rawSchedule({ occurrences: [] }));
    expect(await screen.findByText("Nenhum turno nesta semana. Clique num dia vazio ou em Adicionar turno.")).toBeInTheDocument();
    view.unmount();
    const paused = rawSchedule({ occurrences: [] });
    (paused.members[0] as Record<string, unknown>).status = "paused";
    setup(paused);
    expect(await screen.findByText("Nenhum turno nesta semana.")).toBeInTheDocument();
  });
});

describe("atalhos e overlays (B-1)", () => {
  it("com o drawer aberto, c e t não abrem nada por cima; fechado, c abre o convite", async () => {
    const { user } = setup();
    await screen.findByText("Diego Ramos");
    await user.click(screen.getByRole("button", { name: "Adicionar turno" }));
    const drawer = await screen.findByRole("dialog", { name: "Adicionar turno" });
    await user.keyboard("c");
    await user.keyboard("t");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await user.click(within(drawer).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.keyboard("c");
    expect(await screen.findByRole("dialog", { name: "Convidar motoboy" })).toBeInTheDocument();
  });

  it("atalhos desligados nas preferências não disparam", async () => {
    const { setShortcutsEnabled } = await import("@/lib/prefs/prefs");
    setShortcutsEnabled(false);
    const { user } = setup();
    await screen.findByText("Diego Ramos");
    await user.keyboard("c");
    expect(screen.queryByRole("dialog")).toBeNull();
    setShortcutsEnabled(true);
  });
});

describe("ações de membro e turno", () => {
  it("pausar pede confirmação e chama a API", async () => {
    const { user } = setup();
    await screen.findByText("Diego Ramos");
    await user.click(screen.getByRole("button", { name: "Opções de Diego Ramos" }));
    await user.click(await screen.findByRole("menuitem", { name: "Pausar" }));
    const confirm = await screen.findByRole("dialog", { name: "Pausar Diego Ramos?" });
    expect(confirm).toHaveTextContent("Os turnos dele ficam suspensos");
    await user.click(within(confirm).getByRole("button", { name: "Pausar" }));
    await waitFor(() => expect(api.memberAction).toHaveBeenCalledWith(DIEGO, "pause"));
    expect(await screen.findByText("Diego Ramos foi pausado.")).toBeInTheDocument();
  });

  it("retomar vai direto, sem confirmação", async () => {
    const { user } = setup();
    await screen.findByText("Rafa Lima");
    await user.click(screen.getByRole("button", { name: "Opções de Rafa Lima" }));
    await user.click(await screen.findByRole("menuitem", { name: "Retomar" }));
    await waitFor(() => expect(api.memberAction).toHaveBeenCalledWith(RAFA, "resume"));
  });

  it("erro da API vira texto fixo do catálogo", async () => {
    api.memberAction.mockRejectedValue(new ApiError({ status: 409, code: "TEAM_MEMBER_NOT_ACTIVE" }));
    const { user } = setup();
    await screen.findByText("Diego Ramos");
    await user.click(screen.getByRole("button", { name: "Opções de Diego Ramos" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remover da equipe" }));
    await user.click(within(await screen.findByRole("dialog", { name: /Remover Diego Ramos/ })).getByRole("button", { name: "Remover" }));
    expect(await screen.findByText("Este motoboy não está ativo na equipe.")).toBeInTheDocument();
  });

  it("remover turno: menu, confirmação e DELETE pela série", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: /Diego Ramos, .*turno das 18h às 23h/ }));
    const menu = await screen.findByRole("dialog", { name: /18:00–23:00/ });
    expect(menu).toHaveTextContent("Repete toda semana");
    await user.click(within(menu).getByRole("button", { name: "Remover turno" }));
    const confirm = await screen.findByRole("dialog", { name: "Remover este turno?" });
    await user.click(within(confirm).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(api.deleteShift).toHaveBeenCalledWith(SHIFT_D));
  });

  it("turno só desta semana que já passou não oferece remover", async () => {
    const raw = rawSchedule();
    const o = raw.occurrences[0] as Record<string, unknown>;
    o.repeats_weekly = false;
    o.date = addDays(MONDAY, 3);
    raw.today = addDays(MONDAY, 5);
    const { user } = setup(raw);
    await user.click(await screen.findByRole("button", { name: /Diego Ramos, .*turno das 18h às 23h/ }));
    const menu = await screen.findByRole("dialog", { name: /18:00–23:00/ });
    expect(within(menu).getByRole("button", { name: "Remover turno" })).toBeDisabled();
    expect(menu).toHaveTextContent("Este turno já aconteceu.");
  });

  it("turno em andamento não pode ser removido", async () => {
    const raw = rawSchedule();
    (raw.occurrences[0] as Record<string, unknown>).session = { started_at: new Date().toISOString(), ended_at: null };
    const { user } = setup(raw);
    await user.click(await screen.findByRole("button", { name: /Diego Ramos, .*turno das 18h às 23h/ }));
    expect(await screen.findByRole("button", { name: "Remover turno" })).toBeDisabled();
  });
});

describe("convite", () => {
  const openInvite = async () => {
    const ctx = setup();
    await screen.findByText("Diego Ramos");
    await ctx.user.click(screen.getByRole("button", { name: "Convidar motoboy" }));
    const dialog = await screen.findByRole("dialog", { name: "Convidar motoboy" });
    await within(dialog).findByTestId("invite-link");
    return { ...ctx, dialog };
  };

  it("copia o link, mostra Copiado e monta o WhatsApp", async () => {
    const { user, dialog } = await openInvite();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await user.click(within(dialog).getByRole("button", { name: "Copiar" }));
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/convite/tok`);
    expect(await within(dialog).findByRole("button", { name: "Copiado" })).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Enviar pelo WhatsApp/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/wa\.me\/\?text=.*localhost%3A3000%2Fconvite%2Ftok/),
    );
    expect(within(dialog).getByText("2 entradas nas últimas 24 h")).toBeInTheDocument();
  });

  it("gerar novo link pede confirmação", async () => {
    api.rotateInviteLink.mockResolvedValue({ id: "l2", url: `${location.origin}/convite/novo`, joinsLast24h: 0 });
    const { user, dialog } = await openInvite();
    await user.click(within(dialog).getByRole("button", { name: "Gerar novo link" }));
    const confirm = await screen.findByRole("dialog", { name: "Gerar um novo link?" });
    await user.click(within(confirm).getByRole("button", { name: "Gerar novo link" }));
    await waitFor(() => expect(api.rotateInviteLink).toHaveBeenCalled());
    expect(await within(dialog).findByText("localhost:3000/convite/novo")).toBeInTheDocument();
  });

  it("convite nominal exige nome e celular, e mostra o link com WhatsApp", async () => {
    api.createNominalInvite.mockResolvedValue({ id: "i1", url: `${location.origin}/convite/abc`, inviteeName: "Joca Silva", inviteePhone: "5541999990077" });
    const { user, dialog } = await openInvite();
    const button = within(dialog).getByRole("button", { name: "Convidar" });
    expect(button).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Nome"), "Joca Silva");
    await user.type(within(dialog).getByLabelText("Celular"), "41999990077");
    await user.click(button);
    await waitFor(() => expect(api.createNominalInvite).toHaveBeenCalledWith("Joca Silva", "(41) 99999-0077"));
    expect(await within(dialog).findByText("Convite criado para Joca Silva")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", expect.stringContaining("https://wa.me/5541999990077?text="));
  });

  it("reenviar com 429 mostra o texto fixo; cancelar pede confirmação", async () => {
    api.fetchInvites.mockResolvedValue([
      model.parseInvite({ id: BRUNO, invitee_name: "Bruno Carvalho", invitee_phone: "5541997332208", initials: "BC", created_at: new Date().toISOString(), status: "not_opened" }),
    ]);
    api.resendInvite.mockRejectedValue(new ApiError({ status: 429, code: "TEAM_INVITE_RESEND_TOO_SOON" }));
    api.revokeInvite.mockResolvedValue(undefined);
    const { user, dialog } = await openInvite();
    expect(await within(dialog).findByText("(41) 99733-2208 · hoje")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Reenviar convite para Bruno Carvalho" }));
    expect(await within(dialog).findByText("Aguarde um minuto para reenviar o convite.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar convite de Bruno Carvalho" }));
    const confirm = await screen.findByRole("dialog", { name: "Cancelar o convite?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancelar convite" }));
    await waitFor(() => expect(api.revokeInvite).toHaveBeenCalledWith(BRUNO));
  });

  it("Reenviar convite da grade abre o modal e reenvia", async () => {
    api.resendInvite.mockResolvedValue({ id: "i9", url: `${location.origin}/convite/re`, inviteeName: "Bruno Carvalho", inviteePhone: "5541997332208" });
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: "Reenviar convite para Bruno Carvalho" }));
    await waitFor(() => expect(api.resendInvite).toHaveBeenCalledWith(BRUNO));
    expect(await screen.findByText("Convite criado para Bruno Carvalho")).toBeInTheDocument();
  });
});

describe("link de convite confiável (§6.2)", () => {
  it("host de outra origem não aparece, não copia e não gera QR", async () => {
    api.fetchInviteLink.mockResolvedValue({ id: "l1", url: "https://evil.example/convite/tok", joinsLast24h: 0 });
    const { user } = setup();
    await screen.findByText("Diego Ramos");
    await user.click(screen.getByRole("button", { name: "Convidar motoboy" }));
    const dialog = await screen.findByRole("dialog", { name: "Convidar motoboy" });
    expect(await within(dialog).findByText("Não foi possível gerar o link agora.")).toBeInTheDocument();
    expect(within(dialog).queryByTestId("invite-link")).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Copiar" })).toBeNull();
    expect(within(dialog).getByText(/Enviar pelo WhatsApp/).closest("a")).not.toHaveAttribute("href");
    expect(within(dialog).getByRole("img", { name: "QR code do link de convite" }).querySelector("path")).toBeNull();
  });

  it("convite nominal com link inválido avisa em vez de mostrar o link", async () => {
    api.createNominalInvite.mockResolvedValue({ id: "i1", url: "javascript:alert(1)", inviteeName: "Joca", inviteePhone: "5541999990077" });
    const { user } = setup();
    await screen.findByText("Diego Ramos");
    await user.click(screen.getByRole("button", { name: "Convidar motoboy" }));
    const dialog = await screen.findByRole("dialog", { name: "Convidar motoboy" });
    await user.type(await within(dialog).findByLabelText("Nome"), "Joca");
    await user.type(within(dialog).getByLabelText("Celular"), "41999990077");
    await user.click(within(dialog).getByRole("button", { name: "Convidar" }));
    expect(await within(dialog).findByText("Convite criado para Joca")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Não foi possível gerar o link agora.").length).toBeGreaterThan(0);
    expect(within(dialog).queryByRole("link", { name: "WhatsApp" })).toBeNull();
  });
});

describe("adicionar turno", () => {
  const openDrawer = async () => {
    const ctx = setup();
    await screen.findByText("Diego Ramos");
    await ctx.user.click(screen.getByRole("button", { name: "Adicionar turno" }));
    const drawer = await screen.findByRole("dialog", { name: "Adicionar turno" });
    await ctx.user.selectOptions(within(drawer).getByLabelText("Motoboy"), DIEGO);
    return { ...ctx, drawer };
  };

  it("salva com o corpo certo e avisa", async () => {
    api.createShifts.mockResolvedValue({ count: 1, items: [{ weekday: 3, validFrom: addDays(MONDAY, 3) }] });
    const { user, drawer } = await openDrawer();
    await user.click(within(drawer).getByRole("button", { name: "Qui" }));
    await user.click(within(drawer).getByRole("button", { name: "Salvar 1 turno" }));
    await waitFor(() => expect(api.createShifts).toHaveBeenCalled());
    expect(api.createShifts.mock.calls[0]?.[0]).toMatchObject({
      membershipId: DIEGO,
      weekdays: [3],
      startTime: "18:00",
      endTime: "23:00",
      weekStart: MONDAY,
      repeatWeekly: true,
      remindLocation: true,
      pay: null,
    });
    expect(await screen.findByText("1 turno salvo para Diego.")).toBeInTheDocument();
  });

  it("DRIVER_BUSY marca o dia e mantém o formulário", async () => {
    api.createShifts.mockRejectedValue(
      new ApiError({ status: 409, code: "TEAM_SHIFT_DRIVER_BUSY", fieldErrors: [{ field: "weekdays", detail: "3" }] }),
    );
    const { user, drawer } = await openDrawer();
    await user.click(within(drawer).getByRole("button", { name: "Qui" }));
    await user.click(within(drawer).getByRole("button", { name: "Salvar 1 turno" }));
    expect(await within(drawer).findByRole("alert")).toHaveTextContent("Esse motoboy já tem turno nesse horário. Dias: Qui.");
    expect(within(drawer).getByRole("button", { name: "Qui" })).toHaveAttribute("aria-pressed", "true");
  });

  it("Cancelar com alterações pergunta antes de descartar", async () => {
    const { user, drawer } = await openDrawer();
    await user.click(within(drawer).getByRole("button", { name: "Qui" }));
    await user.click(within(drawer).getByRole("button", { name: "Cancelar" }));
    const confirm = await screen.findByRole("dialog", { name: "Descartar as alterações?" });
    await user.click(within(confirm).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
