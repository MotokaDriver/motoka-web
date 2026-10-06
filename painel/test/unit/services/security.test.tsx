import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const http = vi.hoisted(() => ({ fetch: vi.fn(), logout: vi.fn(async () => undefined) }));
vi.mock("@/features/session/runtime", () => ({
  getSessionStore: () => ({ subscribe: () => () => undefined, getState: () => ({ status: "authenticated" }), logout: http.logout }),
  apiFetch: (path: string, init?: unknown) => http.fetch(path, init),
}));

const { EmailEditor, PasswordEditor, DeleteAccount, afterDeleteUrl, EMAIL_PATTERN } = await import("@/features/account/AccountSecurity");
const { firstPasswordError } = await import("@/features/account/passwordRules");
const { ReminderButton } = await import("@/features/live/LiveSide");
const { ToastProvider } = await import("@/ui/Toast");

const USER = "d0000001-0000-4000-8000-000000000001";

function mount(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
  return { user };
}

beforeEach(() => {
  http.fetch.mockReset();
  http.logout.mockClear();
});

describe("regras de senha e e-mail (as do app)", () => {
  it("senha: primeira regra que falha", () => {
    expect(firstPasswordError("curta1A!")).toBeNull();
    expect(firstPasswordError("abc")).toBe("Deve ter de 8 a 20 caracteres");
    expect(firstPasswordError("senhasemmaiuscula1!")).toBe("Deve conter pelo menos uma letra maiúscula");
    expect(firstPasswordError("SENHASEMMINUSCULA1!")).toBe("Deve conter pelo menos uma letra minúscula");
    expect(firstPasswordError("SenhaSemNumero!")).toBe("Deve conter pelo menos um número");
    expect(firstPasswordError("SenhaSemEspecial1")).toBe("Deve conter pelo menos um caractere especial");
    // Como o `\w` do Python: "ç" é letra, não caractere especial.
    expect(firstPasswordError("Senha12ç")).toBe("Deve conter pelo menos um caractere especial");
  });
  it("e-mail", () => {
    expect(EMAIL_PATTERN.test("loja@motoka.com")).toBe(true);
    expect(EMAIL_PATTERN.test("loja@motoka")).toBe(false);
  });
  it("destino depois de excluir a conta", () => {
    expect(afterDeleteUrl("painel.motokadriver.com", "https:")).toBe("https://motokadriver.com/");
    expect(afterDeleteUrl("localhost:8787", "http:")).toBe("/entrar/");
  });
});

describe("troca de e-mail (código, confirmação e PUT)", () => {
  it("manda o código, confirma e só então troca; código errado não troca", async () => {
    http.fetch.mockImplementation(async (path: string, init?: { body?: { code?: string } }) => {
      if (path === "/users/confirm-email-code" && init?.body?.code === "000000") throw new ApiError({ status: 400, code: "CONFIRMATION_CODE_INVALID" });
      return undefined;
    });
    const { user } = mount(<EmailEditor userId={USER} current="loja@motoka.com" />);
    await user.type(screen.getByLabelText("Novo e-mail"), "nova@loja.com");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith("/users/email-code", expect.objectContaining({ body: { email: "nova@loja.com", type: "update_email" } })));
    await user.type(await screen.findByLabelText("Código de confirmação"), "000000");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Código inválido. Confira e tente novamente.")).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalledWith(`/users/${USER}/email`, expect.anything());
    expect(screen.getByRole("button", { name: /Reenviar código em/ })).toBeDisabled();
    await user.clear(screen.getByLabelText("Código de confirmação"));
    await user.type(screen.getByLabelText("Código de confirmação"), "123456");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith(`/users/${USER}/email`, expect.objectContaining({ method: "PUT", body: { email: "nova@loja.com" } })));
    expect(await screen.findByText("E-mail atual: nova@loja.com")).toBeInTheDocument();
  });

  it("e-mail inválido não pede código", async () => {
    const { user } = mount(<EmailEditor userId={USER} current="" />);
    await user.type(screen.getByLabelText("Novo e-mail"), "isso-nao-e-email");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(await screen.findByText("Insira um e-mail válido")).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalled();
  });
});

describe("troca de senha", () => {
  it("valida as regras e a confirmação antes de chamar a API", async () => {
    const { user } = mount(<PasswordEditor userId={USER} />);
    await user.type(screen.getByLabelText("Senha atual"), "antiga");
    await user.type(screen.getByLabelText("Nova senha"), "fraca");
    await user.type(screen.getByLabelText("Confirme a nova senha"), "outra");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(await screen.findByText("Deve ter de 8 a 20 caracteres", { selector: "p, span, div" })).toBeInTheDocument();
    expect(screen.getByText("As senhas não correspondem")).toBeInTheDocument();
    expect(http.fetch).not.toHaveBeenCalled();
  });

  it("envia o contrato do app e sai da sessão; senha atual errada mostra o catálogo", async () => {
    http.fetch.mockRejectedValueOnce(new ApiError({ status: 400, code: "USER_PASSWORD_INCORRECT" })).mockResolvedValueOnce(undefined);
    const { user } = mount(<PasswordEditor userId={USER} />);
    await user.type(screen.getByLabelText("Senha atual"), "errada");
    await user.type(screen.getByLabelText("Nova senha"), "OutraSenha@2");
    await user.type(screen.getByLabelText("Confirme a nova senha"), "OutraSenha@2");
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    expect(await screen.findByText("A senha atual está incorreta.")).toBeInTheDocument();
    expect(http.logout).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Alterar senha" }));
    await waitFor(() => expect(http.fetch).toHaveBeenLastCalledWith(`/users/${USER}/password`, expect.objectContaining({ method: "PUT", body: { old_password: "errada", password: "OutraSenha@2", confirm_password: "OutraSenha@2" } })));
    await waitFor(() => expect(http.logout).toHaveBeenCalledTimes(1));
  });
});

describe("excluir conta", () => {
  it("só habilita com EXCLUIR; apaga, encerra a sessão e sai", async () => {
    http.fetch.mockResolvedValue(undefined);
    const assign = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { host: "localhost:8787", protocol: "http:", assign } });
    const { user } = mount(<DeleteAccount userId={USER} />);
    await user.click(screen.getByRole("button", { name: "Excluir conta" }));
    const confirm = await screen.findByRole("button", { name: "Excluir permanentemente" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("Para confirmar, digite EXCLUIR"), "excluir");
    expect(confirm).toBeDisabled();
    await user.clear(screen.getByLabelText("Para confirmar, digite EXCLUIR"));
    await user.type(screen.getByLabelText("Para confirmar, digite EXCLUIR"), "EXCLUIR");
    await user.click(confirm);
    await waitFor(() => expect(http.fetch).toHaveBeenCalledWith(`/users/${USER}`, expect.objectContaining({ method: "DELETE" })));
    await waitFor(() => expect(http.logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/entrar/"));
  });

  it("falha da API não encerra a sessão e mostra o texto do catálogo", async () => {
    http.fetch.mockRejectedValue(new ApiError({ status: 404, code: "USER_NOT_FOUND" }));
    const { user } = mount(<DeleteAccount userId={USER} />);
    await user.click(screen.getByRole("button", { name: "Excluir conta" }));
    await user.type(await screen.findByLabelText("Para confirmar, digite EXCLUIR"), "EXCLUIR");
    await user.click(screen.getByRole("button", { name: "Excluir permanentemente" }));
    expect(await screen.findByText("Usuário não encontrado.")).toBeInTheDocument();
    expect(http.logout).not.toHaveBeenCalled();
  });
});

describe("E17: lembrete de localização", () => {
  const MEMBERSHIP = "11111111-1111-4111-8111-111111111111";
  it("envia o lembrete e mostra o texto fixo do 429", async () => {
    http.fetch.mockResolvedValueOnce({ sent_at: "2026-10-05T12:00:00Z" }).mockRejectedValueOnce(new ApiError({ status: 429, code: "TEAM_REMINDER_TOO_SOON" }));
    const { user } = mount(<ReminderButton membershipId={MEMBERSHIP} name="Diego" />);
    await user.click(screen.getByRole("button", { name: "Lembrar Diego de ativar a localização" }));
    expect(await screen.findByText("Lembrete enviado.")).toBeInTheDocument();
    expect(http.fetch).toHaveBeenCalledWith(`/teams/me/members/${MEMBERSHIP}/remind-location`, expect.objectContaining({ method: "POST" }));
    await user.click(screen.getByRole("button", { name: "Lembrar Diego de ativar a localização" }));
    expect(await screen.findByText("O lembrete acabou de ser enviado. Aguarde alguns minutos para reenviar.")).toBeInTheDocument();
  });
});
