"use client";

import { useEffect } from "react";
import { useSession } from "@/features/session/useSession";
import { Spinner } from "@/ui/Spinner";
import { InstallNotice } from "./InstallNotice";
import { OauthReturn } from "./OauthReturn";
import type { IntegrationType } from "./model";

/**
 * Página de retorno do parceiro, fora da moldura do painel (sem o `ShellGate`): quem chega sem sessão vê a explicação com o
 * botão de entrar, em vez de ser mandado ao login com o `code` solto. Logado, confere o `state` e conclui (`OauthReturn`).
 */
export function PartnerReturn({ type }: { type: IntegrationType }) {
  const session = useSession();
  const signedOut = session.status === "anonymous" || session.status === "denied";

  // Sem sessão a conexão não pode concluir: o `code` sai do endereço e do histórico.
  useEffect(() => {
    if (signedOut) window.history.replaceState(null, "", window.location.pathname);
  }, [signedOut]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-text-primary">
      {session.status === "authenticated" ? (
        <OauthReturn type={type} />
      ) : signedOut ? (
        <InstallNotice signedIn={false} />
      ) : session.status === "unavailable" ? (
        <p role="alert" className="type-body-md max-w-[420px] text-center text-text-secondary">
          {session.message}
        </p>
      ) : (
        <div className="text-primary-text">
          <Spinner size={32} label="Carregando" />
        </div>
      )}
    </main>
  );
}
