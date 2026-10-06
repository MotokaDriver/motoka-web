"use client";

import { useEffect, useState } from "react";
import { getSessionStore } from "@/features/session/runtime";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Btn } from "@/ui/Btn";
import { Dialog } from "@/ui/Dialog";
import { Field } from "@/ui/Field";
import { InlineError } from "@/ui/InlineError";
import { useToast } from "@/ui/Toast";
import { confirmEmailCode, deleteAccount, requestEmailCode, updateEmail, updatePassword } from "./api";
import { PASSWORD_RULES, firstPasswordError } from "./passwordRules";

const errorText = (failure: unknown): string => (isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE);

/** Mesmo critério do app (`profile_change_email_page`). */
export const EMAIL_PATTERN = /^[\w+.+-]+@([\w-]+\.)+[\w-]{2,4}$/;
export const RESEND_SECONDS = 60;

/**
 * Troca de e-mail com o contrato do app: código de 6 dígitos (`update_email`) enviado ao novo endereço, confirmação do
 * código e só então `PUT /users/{id}/email`. Reenviar só depois de 60 s (a API não limita).
 */
export function EmailEditor({ userId, current }: { userId: string; current: string }) {
  const toast = useToast();
  const [shown, setShown] = useState(current);
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const invalid = email.trim() === "" ? "Por favor, insira um e-mail" : email.length > 50 || !EMAIL_PATTERN.test(email.trim()) ? "Insira um e-mail válido" : null;

  const send = async (resend = false) => {
    setTouched(true);
    if (invalid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await requestEmailCode(email);
      setStep("code");
      setWait(RESEND_SECONDS);
      if (resend) toast({ title: "Enviamos um novo código para o seu e-mail." });
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await confirmEmailCode(code);
      await updateEmail(userId, email);
      setShown(email.trim());
      setStep("email");
      setEmail("");
      setCode("");
      setTouched(false);
      toast({ title: "Email alterado com sucesso!" });
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="type-body-md text-text-secondary">{`E-mail atual: ${shown || "não informado"}`}</p>
      {step === "email" ? (
        <>
          <Field label="Novo e-mail" type="email" autoComplete="email" maxLength={50} value={email} error={touched ? (invalid ?? undefined) : undefined} hint="Você receberá um código de confirmação no novo e-mail." onChange={(event) => setEmail(event.target.value)} />
          {error && <InlineError message={error} />}
          <div>
            <Btn kind="secondary" loading={busy} onClick={() => void send()}>
              Enviar código
            </Btn>
          </div>
        </>
      ) : (
        <>
          <Field label="Código de confirmação" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} hint={`Enviamos um código de 6 dígitos para ${email.trim()}.`} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} />
          {error && <InlineError message={error} />}
          <div className="flex flex-wrap gap-2">
            <Btn loading={busy} disabled={code.length !== 6} onClick={() => void confirm()}>
              Confirmar
            </Btn>
            <Btn kind="ghost" disabled={busy || wait > 0} onClick={() => void send(true)}>
              {wait > 0 ? `Reenviar código em ${wait}s` : "Reenviar código"}
            </Btn>
            <Btn
              kind="ghost"
              disabled={busy}
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              Trocar o e-mail
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

/** Troca de senha (`PUT /users/{id}/password`): atual, nova e confirmação; depois de trocar, entra de novo (como no app). */
export function PasswordEditor({ userId }: { userId: string }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errors = {
    current: current === "" ? "Por favor, insira sua senha atual" : undefined,
    next: next === "" ? "Por favor, insira uma nova senha" : (firstPasswordError(next) ?? undefined),
    confirm: confirm === "" ? "Por favor, insira a confirmação de senha" : confirm !== next ? "As senhas não correspondem" : undefined,
  };

  const save = async () => {
    setTouched(true);
    if (errors.current || errors.next || errors.confirm || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updatePassword(userId, { current, next, confirm });
      toast({ title: "Senha alterada. Entre de novo." });
      void getSessionStore().logout();
    } catch (failure) {
      setError(errorText(failure));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label="Senha atual" revealable autoComplete="current-password" value={current} error={touched ? errors.current : undefined} onChange={(event) => setCurrent(event.target.value)} />
      <Field label="Nova senha" revealable autoComplete="new-password" value={next} error={touched ? errors.next : undefined} onChange={(event) => setNext(event.target.value)} />
      <ul aria-label="Requisitos da senha" className="type-caption flex flex-col gap-0.5 text-text-tertiary">
        {PASSWORD_RULES.map((rule) => (
          <li key={rule.label} className={rule.isSatisfied(next) ? "text-success" : undefined}>
            {`${rule.isSatisfied(next) ? "✓" : "•"} ${rule.label}`}
          </li>
        ))}
      </ul>
      <Field label="Confirme a nova senha" revealable autoComplete="new-password" value={confirm} error={touched ? errors.confirm : undefined} onChange={(event) => setConfirm(event.target.value)} />
      {error && <InlineError message={error} />}
      <div>
        <Btn kind="secondary" loading={busy} onClick={() => void save()}>
          Alterar senha
        </Btn>
      </div>
      <p className="type-caption text-text-tertiary">Depois de trocar a senha, você entra de novo neste navegador.</p>
    </div>
  );
}

export const CONFIRM_WORD = "EXCLUIR";

/** Para onde vai quem apagou a conta: a landing (`painel.` vira o domínio raiz); fora disso, a tela de entrada. */
export function afterDeleteUrl(host: string, protocol: string): string {
  return /^painel\./.test(host) ? `${protocol}//${host.replace(/^painel\./, "")}/` : "/entrar/";
}

/**
 * Excluir conta (paridade com o app): confirmação forte, digitando "EXCLUIR"; `DELETE /users/{id}`; encerra a sessão e
 * leva à landing. O que a API apaga é irreversível.
 */
export function DeleteAccount({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(null);
  };

  const run = async () => {
    if (typed.trim() !== CONFIRM_WORD || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(userId);
    } catch (failure) {
      setError(errorText(failure));
      setBusy(false);
      return;
    }
    await getSessionStore().logout();
    window.location.assign(afterDeleteUrl(window.location.host, window.location.protocol));
  };

  return (
    <>
      <Btn kind="danger" onClick={() => setOpen(true)}>
        Excluir conta
      </Btn>
      <Dialog open={open} onOpenChange={(next) => !next && close()} title="Excluir conta" description="Essa ação é irreversível. Todos os seus dados serão permanentemente removidos.">
        <div className="mt-5 flex flex-col gap-4">
          <Field label={`Para confirmar, digite ${CONFIRM_WORD}`} autoComplete="off" autoCapitalize="characters" value={typed} onChange={(event) => setTyped(event.target.value)} />
          {error && <InlineError message={error} />}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Btn kind="secondary" disabled={busy} onClick={close}>
            Cancelar
          </Btn>
          <Btn kind="danger" loading={busy} disabled={typed.trim() !== CONFIRM_WORD} onClick={() => void run()}>
            Excluir permanentemente
          </Btn>
        </div>
      </Dialog>
    </>
  );
}
