"use client";

import Link from "next/link";
import { Paths } from "@/lib/routing/routes";
import { loginUrlFor } from "@/lib/routing/safeNext";

/**
 * Quem instalou o app pela loja de apps do parceiro cai na página de retorno sem o `state` do Motoka (a conexão só começa
 * pelo painel) e, muitas vezes, sem sessão. Em vez de um erro, a tela explica o caminho. O `code` do parceiro não é usado
 * nem guardado: a conexão pelo painel gera um novo.
 */
export const INSTALL_TEXT = "Para concluir, entre no painel Motoka e conecte em Integrações.";

export function InstallNotice({ signedIn }: { signedIn: boolean }) {
  const button = "type-label-lg inline-flex min-h-11 items-center rounded-md border border-primary bg-primary px-4 py-2.5 text-on-primary hover:bg-primary-dark";
  return (
    <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
      <h1 className="type-title-lg font-bold text-text-primary">Conecte pelo painel Motoka</h1>
      <p role="status" className="type-body-md text-text-secondary">
        {INSTALL_TEXT}
      </p>
      {signedIn ? (
        <Link href={Paths.integrations} className={button}>
          Ir para Integrações
        </Link>
      ) : (
        <Link href={loginUrlFor(Paths.integrations, "")} className={button}>
          Entrar no painel
        </Link>
      )}
    </div>
  );
}
