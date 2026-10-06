"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { takePendingOauth } from "@/lib/prefs/prefs";
import { Paths } from "@/lib/routing/routes";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { completeAuthorization } from "./api";
import { integrationKeys } from "./hooks";

const LOST = "Não foi possível confirmar a conexão. Comece de novo pelo painel.";

const INCOMPLETE = "A conexão ficou incompleta: o Cardápio Web não informou a loja. Conecte de novo.";
const NOT_DONE = "A conexão não foi concluída. Tente de novo pelo painel.";

type Outcome = { kind: "working" } | { kind: "failed"; title: string; message: string };

/**
 * Volta do portal do Cardápio Web (`/integracoes/cardapio-web/retorno/?code=&state=`). Confere o `state` com o que o painel
 * guardou na aba antes de sair (uso único, 10 min); só então manda o `code` à API, que confere o `state` de novo, o prazo e
 * o `code_verifier` (que nunca passou pelo navegador). `code` e `state` saem da URL na hora.
 */
export function OauthReturn() {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [outcome, setOutcome] = useState<Outcome>({ kind: "working" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const code = params.get("code");
    const state = params.get("state");
    const denied = params.get("error");
    // Tira o `code` e o `state` do endereço e do histórico antes de qualquer outra coisa.
    window.history.replaceState(null, "", window.location.pathname);
    const pending = takePendingOauth();

    const fail = (message: string, title = "Não conectou") => setOutcome({ kind: "failed", title, message });
    if (denied) return fail("A autorização foi recusada no portal do parceiro. Comece de novo pelo painel.");
    if (!code || !state || !pending || pending.state !== state || pending.type !== "cardapio_web") return fail(LOST);

    completeAuthorization("cardapio_web", code, state).then(
      async (result) => {
        await queryClient.invalidateQueries({ queryKey: integrationKeys.all });
        // Só diz "conectado" se a API disse: sem a loja (incomplete) nenhum pedido entra.
        if (result === "connected") {
          toast({ title: "Cardápio Web conectado." });
          router.replace(Paths.integrations);
        } else if (result === "incomplete") fail(INCOMPLETE, "Configuração incompleta");
        else fail(NOT_DONE);
      },
      (failure: unknown) => fail(isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE),
    );
  }, [params, queryClient, router, toast]);

  return (
    <div className="grid flex-1 place-items-center p-6">
      {outcome.kind === "working" ? (
        <div className="flex flex-col items-center gap-3 text-center text-primary-text">
          <Spinner size={32} label="Conectando o Cardápio Web" />
          <p className="type-body-md text-text-secondary">Conectando o Cardápio Web…</p>
        </div>
      ) : (
        <div className="flex max-w-[420px] flex-col items-center gap-4 text-center">
          <h1 className="type-title-lg font-bold text-text-primary">{outcome.title}</h1>
          <p role="alert" className="type-body-md text-text-secondary">
            {outcome.message}
          </p>
          <Link href={Paths.integrations} className="type-label-lg inline-flex min-h-11 items-center rounded-md border border-primary bg-primary px-4 py-2.5 text-on-primary hover:bg-primary-dark">
            Voltar para Integrações
          </Link>
        </div>
      )}
    </div>
  );
}
