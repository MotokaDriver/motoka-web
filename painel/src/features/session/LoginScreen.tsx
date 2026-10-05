"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { type Infer, z } from "@/lib/zod";
import { RETURN_KEY, nextAfterLogin } from "@/lib/routing/safeNext";
import type { SessionState } from "@/lib/session/store";
import { Btn } from "@/ui/Btn";
import { Field } from "@/ui/Field";
import { InlineError } from "@/ui/InlineError";
import { Spinner } from "@/ui/Spinner";
import { getSessionStore } from "./runtime";
import { useSession } from "./useSession";

const loginSchema = z.object({
  username: z.string().check(z.trim(), z.minLength(1, "Por favor, insira um valor")),
  password: z.string().check(z.minLength(1, "Por favor, insira sua senha")),
});

type LoginForm = Infer<typeof loginSchema>;

/**
 * Login do estabelecimento (WS-04 §5.7; o design não desenha esta tela): cartão de 400 px, um campo
 * para CPF/CNPJ ou e-mail (a API decide pelo "@"), senha e "Entrar". O botão fica em carregando
 * durante o W1 e o `GET /users/{sub}`.
 */
export function LoginScreen() {
  const session = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get(RETURN_KEY);
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  // O motivo da sessão (expirou, outra aba saiu) some quando a pessoa tenta de novo e volta quando
  // o estado da sessão muda.
  const [dismissedSession, setDismissedSession] = useState<SessionState | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { username: "", password: "" } });

  useEffect(() => {
    if (session.status === "authenticated") router.replace(nextAfterLogin(returnTo));
  }, [session.status, returnTo, router]);

  const onSubmit = handleSubmit(async ({ username, password }) => {
    if (busy) return;
    setBusy(true);
    setLoginError(null);
    setDismissedSession(session);
    const result = await getSessionStore().login(username.trim(), password);
    if (!result.ok) setLoginError(result.message);
    setBusy(false);
  });

  if (session.status === "restoring" || session.status === "authenticated") {
    return (
      <main className="grid min-h-dvh place-items-center text-primary-text">
        <Spinner size={32} label="Carregando o painel" />
      </main>
    );
  }

  const sessionMessage =
    dismissedSession !== session && (session.status === "anonymous" || session.status === "denied")
      ? session.message
      : null;
  const message = loginError ?? sessionMessage;

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="w-full max-w-[400px] rounded-xl border border-border bg-surface p-8">
        <div className="flex justify-center">
          {/* Dois logos, um por tema, trocados por CSS: sem flash e sem JS. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- export estático, imagem local */}
          <img src="/logo_white.png" alt="Motoka" width={197} height={40} className="logo-dark h-10 w-auto" />
          {/* eslint-disable-next-line @next/next/no-img-element -- export estático, imagem local */}
          <img src="/logo_blue.png" alt="Motoka" width={197} height={40} className="logo-light h-10 w-auto" />
        </div>
        <h1 className="type-heading-md mt-5 text-center text-text-primary">Painel do estabelecimento</h1>
        <p className="type-body-md mt-2 text-center text-text-secondary">Entre com a conta da sua loja.</p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {session.status === "unavailable" && !loginError && (
            <InlineError message={session.message} onRetry={() => void getSessionStore().restore()} />
          )}
          {message && <InlineError message={message} />}
          <Field
            label="CPF/CNPJ ou e-mail"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            error={errors.username?.message}
            {...register("username")}
          />
          <Field
            label="Senha"
            type="password"
            autoComplete="current-password"
            revealable
            error={errors.password?.message}
            {...register("password")}
          />
          <Btn type="submit" full loading={busy} className="mt-2 min-h-[52px]">
            Entrar
          </Btn>
        </form>
        <p className="type-body-sm mt-5 text-center text-text-tertiary">
          Ainda não tem conta? Cadastre sua loja pelo app Motoka.
        </p>
      </div>
    </main>
  );
}
