import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { resetPrefsMemory } from "@/lib/prefs/prefs";
import { SessionStore } from "@/lib/session/store";
import { resetOverlays } from "@/ui/overlays";
import { FakeAuthApi, establishmentToken, establishmentUser, flush, memoryBus, memoryLock } from "../helpers";

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/ao-vivo/",
  search: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

const runtime = vi.hoisted(() => ({
  store: null as unknown as SessionStore,
  capabilities: {} as Record<string, boolean>,
}));

vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => runtime.store,
  apiFetch: async (path: string) => {
    if (path === "/web/capabilities") return runtime.capabilities;
    throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  },
}));

const { LoginScreen } = await import("@/features/session/LoginScreen");
const { ShellGate } = await import("@/features/shell/Shell");
const { PlaceholderScreen } = await import("@/features/shell/PlaceholderScreen");
const { ToastProvider } = await import("@/ui/Toast");
const { AppLinks } = await import("@/features/shell/AppLinks");
const { AccountScreen } = await import("@/features/account/AccountScreen");

let api: FakeAuthApi;

function withQuery(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  api = new FakeAuthApi();
  runtime.store = new SessionStore({
    api,
    lock: memoryLock(),
    channel: memoryBus().channel(),
    loadUser: async (_a, sub) => establishmentUser(sub),
  });
  runtime.capabilities = {};
  nav.replace.mockReset();
  nav.pathname = "/ao-vivo/";
  nav.search = "";
  localStorage.clear();
  resetPrefsMemory();
  resetOverlays();
});

async function signIn() {
  api.loginResults.push(async () => ({ accessToken: establishmentToken() }));
  await runtime.store.login("x", "y");
}

async function signOutSilently() {
  api.refreshResults.push(async () => {
    throw new ApiError({ status: 401, code: "AUTH_REFRESH_MISSING" });
  });
  await runtime.store.restore();
}

describe("LoginScreen", () => {
  it("restaurando mostra o carregando, não o formulário", () => {
    render(<LoginScreen />);
    expect(screen.getByRole("status", { name: "Carregando o painel" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha")).toBeNull();
  });

  it("valida os campos e envia com Enter", async () => {
    await signOutSilently();
    const user = userEvent.setup();
    render(<LoginScreen />);
    expect(screen.getByRole("heading", { name: "Painel do estabelecimento" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("Por favor, insira um valor")).toBeInTheDocument();
    expect(screen.getByText("Por favor, insira sua senha")).toBeInTheDocument();
    expect(api.loginCalls).toHaveLength(0);

    api.loginResults.push(async () => ({ accessToken: establishmentToken() }));
    await user.type(screen.getByLabelText("CPF/CNPJ ou e-mail"), " 11222333000181 ");
    await user.type(screen.getByLabelText("Senha"), "NovaSenha@1{Enter}");
    await flush();
    expect(api.loginCalls).toEqual([["11222333000181", "NovaSenha@1"]]);
    expect(nav.replace).toHaveBeenCalledWith("/ao-vivo/");
  });

  it("os campos têm o autocomplete certo", async () => {
    await signOutSilently();
    render(<LoginScreen />);
    expect(screen.getByLabelText("CPF/CNPJ ou e-mail")).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("autocomplete", "current-password");
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
  });

  it("erro do W1 aparece pelo catálogo", async () => {
    await signOutSilently();
    const user = userEvent.setup();
    render(<LoginScreen />);
    api.loginResults.push(async () => {
      throw new ApiError({ status: 400, code: "WEB_AUTH_ACCOUNT_NOT_ALLOWED" });
    });
    await user.type(screen.getByLabelText("CPF/CNPJ ou e-mail"), "52998224725");
    await user.type(screen.getByLabelText("Senha"), "Teste@123");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O painel é só para estabelecimentos.");
  });

  it("depois do login volta para o ?de= saneado, e nunca para fora", async () => {
    nav.search = "de=%2Fequipe%2F%3Fsemana%3D2026-10-05";
    await signIn();
    render(<LoginScreen />);
    expect(nav.replace).toHaveBeenCalledWith("/equipe/?semana=2026-10-05");
    nav.replace.mockReset();
    nav.search = "de=%2F%2Fevil.com";
    render(<LoginScreen />);
    expect(nav.replace).toHaveBeenCalledWith("/ao-vivo/");
  });

  it("mostra o motivo da expiração", async () => {
    await signIn();
    runtime.store.expire("AUTH_REFRESH_REUSED");
    render(<LoginScreen />);
    expect(screen.getByRole("alert")).toHaveTextContent("Sua sessão foi encerrada por segurança. Entre novamente.");
  });

  it("sem rede mostra a mensagem com Tentar de novo", async () => {
    api.refreshResults.push(async () => {
      throw new ApiError({ status: null });
    });
    await runtime.store.restore();
    render(<LoginScreen />);
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});

describe("ShellGate", () => {
  it("sem rede no boot mostra a mensagem de conexão, e não leva ao login", async () => {
    api.refreshResults.push(async () => {
      throw new ApiError({ status: 503 });
    });
    await runtime.store.restore();
    render(withQuery(<ShellGate>conteúdo</ShellGate>));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível conectar ao Motoka.");
    expect(nav.replace).not.toHaveBeenCalled();
    api.refreshResults.push(async () => ({ accessToken: establishmentToken() }));
    await act(async () => {
      await screen.getByRole("button", { name: "Tentar de novo" }).click();
      await flush();
    });
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("sem sessão vai ao login guardando a rota", async () => {
    nav.pathname = "/equipe/";
    nav.search = "";
    window.history.replaceState(null, "", "/equipe/?semana=2026-10-05");
    await signOutSilently();
    render(withQuery(<ShellGate>conteúdo</ShellGate>));
    expect(nav.replace).toHaveBeenCalledWith("/entrar/?de=%2Fequipe%2F%3Fsemana%3D2026-10-05");
  });

  it("Sair vai ao login sem ?de=", async () => {
    await signIn();
    await runtime.store.logout();
    render(withQuery(<ShellGate>conteúdo</ShellGate>));
    expect(nav.replace).toHaveBeenCalledWith("/entrar/");
  });

  it("logado mostra a sidebar com o item ativo e a loja no rodapé", async () => {
    await signIn();
    render(withQuery(<ShellGate>conteúdo</ShellGate>));
    const navs = screen.getAllByRole("navigation", { name: "Painel" });
    const sidebar = navs[0]!;
    const links = within(sidebar).getAllByRole("link").map((link) => link.textContent);
    expect(links).toEqual([
      "Mapa ao vivo",
      "Minha equipe",
      "Pedidos",
      "Acertos",
      "Contratar motoboys",
      "Integrações",
      "Avisos",
      "Conta",
    ]);
    expect(within(sidebar).getByRole("link", { name: "Mapa ao vivo" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByText("Padaria Teste LTDA")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Praça da Sé, 200")[0]).toBeInTheDocument();
  });

  it("o botão de menu abre o drawer com a navegação (abaixo de 1024 px)", async () => {
    await signIn();
    const user = userEvent.setup();
    render(withQuery(<ShellGate>conteúdo</ShellGate>));
    await user.click(screen.getByRole("button", { name: "Abrir o menu" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("link", { name: "Minha equipe" })).toBeInTheDocument();
  });

  it("? abre a ajuda; não abre com foco em campo; desligar na ajuda desliga", async () => {
    await signIn();
    const user = userEvent.setup();
    render(
      withQuery(
        <ShellGate>
          <input aria-label="Busca" />
        </ShellGate>,
      ),
    );
    await user.click(screen.getByLabelText("Busca"));
    await user.keyboard("?");
    expect(screen.queryByRole("dialog")).toBeNull();
    (document.activeElement as HTMLElement).blur();
    await user.keyboard("?");
    const help = await screen.findByRole("dialog", { name: "Atalhos de teclado" });
    // Com a ajuda aberta, outro ? não faz nada (dialog aberto).
    await user.keyboard("?");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await user.click(within(help).getByRole("button", { name: "Desligar atalhos" }));
    expect(localStorage.getItem("motoka.panel.shortcuts")).toBe("off");
    await user.keyboard("?");
    await flush();
    expect(screen.queryByRole("dialog", { name: "Atalhos de teclado" })).toBeNull();
  });
});

describe("placeholders e Conta", () => {
  it("feature desligada na API mostra Em breve", async () => {
    runtime.capabilities = { teams: true, deliveries: true, tracking: false };
    render(withQuery(<PlaceholderScreen path="/ao-vivo/" />));
    expect(await screen.findByText("Em breve")).toBeInTheDocument();
  });

  it("feature ligada mostra Em construção", async () => {
    runtime.capabilities = { teams: true };
    render(withQuery(<PlaceholderScreen path="/equipe/" />));
    expect(await screen.findByText("Em construção")).toBeInTheDocument();
    expect(screen.getByText("Esta área do painel ainda está sendo preparada.")).toBeInTheDocument();
  });

  it("links das lojas abrem com noopener", () => {
    render(<AppLinks />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("Conta mostra os dados da loja e troca as preferências", async () => {
    await signIn();
    const user = userEvent.setup();
    render(withQuery(<ToastProvider><AccountScreen /></ToastProvider>));
    expect(screen.getByText("11.222.333/0001-81")).toBeInTheDocument();
    expect(screen.getByLabelText("Telefone")).toHaveValue("(11) 97777-6666");
    await user.click(screen.getByRole("radio", { name: "Claro" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("switch", { name: "Atalhos de teclado" }));
    expect(localStorage.getItem("motoka.panel.shortcuts")).toBe("off");
    await user.click(screen.getByRole("button", { name: "Sair" }));
    await flush();
    expect(api.logoutCalls).toBe(1);
    expect(runtime.store.getState()).toMatchObject({ status: "anonymous", keepReturn: false });
  });
});
