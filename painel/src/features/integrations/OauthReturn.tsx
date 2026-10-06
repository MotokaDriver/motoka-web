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
import { InstallNotice } from "./InstallNotice";
import type { IntegrationType } from "./model";

const LOST = "Não foi possível confirmar a conexão. Comece de novo pelo painel.";

/** Textos por parceiro: o que "incompleto" quer dizer muda (Cardápio Web sem a loja; Nuvemshop sem o cadastro da entrega). */
const COPY: Partial<Record<IntegrationType, { name: string; incomplete: string }>> = {
  cardapio_web: { name: "Cardápio Web", incomplete: "A conexão ficou incompleta: o Cardápio Web não informou a loja. Conecte de novo." },
  nuvemshop: { name: "Nuvemshop", incomplete: "A conexão ficou incompleta: o cadastro da entrega na Nuvemshop não terminou. Em Integrações, use \"Refazer cadastro\"." },
};
const NOT_DONE = "A conexão não foi concluída. Tente de novo pelo painel.";

type Outcome = { kind: "working" } | { kind: "install" } | { kind: "failed"; title: string; message: string };

/**
 * Volta do portal do parceiro (`/integracoes/<parceiro>/retorno/?code=&state=`). Confere o `state` com o que o painel guardou
 * na aba antes de sair (uso único, 10 min); só então manda o `code` à API, que confere o `state` de novo, o prazo e o
 * `code_verifier` (que nunca passou pelo navegador). `code` e `state` saem da URL na hora. O resultado vem da resposta da
 * API: só `connected` diz "conectado".
 */
export function OauthReturn({ type = "cardapio_web" }: { type?: IntegrationType }) {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const copy = COPY[type] ?? COPY.cardapio_web;
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
    const showInstall = () => setOutcome({ kind: "install" });
    if (denied) return fail("A autorização foi recusada no portal do parceiro. Comece de novo pelo painel.");
    // Sem `state` guardado nesta aba (instalou pela loja de apps do parceiro, ou o prazo de 10 min venceu): a conexão só começa
    // pelo painel. Explica o caminho, sem chamar a API.
    if (!pending) return showInstall();
    if (!code || !state || pending.state !== state || pending.type !== type) return fail(LOST);

    completeAuthorization(type, code, state).then(
      async (result) => {
        await queryClient.invalidateQueries({ queryKey: integrationKeys.all });
        // Só diz "conectado" se a API disse.
        if (result === "connected") {
          toast({ title: `${copy?.name ?? "Integração"} conectado.` });
          router.replace(Paths.integrations);
        } else if (result === "incomplete") fail(copy?.incomplete ?? NOT_DONE, "Configuração incompleta");
        else fail(NOT_DONE);
      },
      (failure: unknown) => fail(isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE),
    );
  }, [params, queryClient, router, toast, type, copy]);

  return (
    <div className="grid flex-1 place-items-center p-6">
      {outcome.kind === "install" ? (
        <InstallNotice signedIn />
      ) : outcome.kind === "working" ? (
        <div className="flex flex-col items-center gap-3 text-center text-primary-text">
          <Spinner size={32} label={`Conectando ${copy?.name ?? "a integração"}`} />
          <p className="type-body-md text-text-secondary">{`Conectando ${copy?.name ?? "a integração"}…`}</p>
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
