"use client";

import { useState } from "react";
import { UpdatedBanner, reloadPage } from "@/features/shell/ChunkRecovery";
import { isChunkLoadError, recoverFromChunkError } from "@/features/shell/chunkErrors";
import { Btn } from "@/ui/Btn";
import { EmptyState } from "@/ui/EmptyState";

/**
 * Error boundary do shell. `ChunkLoadError` (deploy novo com a aba aberta) ganha uma recarga
 * automática e, depois, o aviso (DN-24). Outro erro não é escondido: mostra a falha com a opção de
 * tentar de novo.
 */
export default function ShellError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chunk = isChunkLoadError(error);
  // Decidido uma vez por montagem do boundary: a primeira falha recarrega, a seguinte pergunta.
  const [action] = useState(() => (chunk ? recoverFromChunkError(reloadPage) : null));

  if (chunk) return action === "ask" ? <UpdatedBanner /> : null;

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <EmptyState icon="error" title="Algo deu errado nesta tela." description="Tente de novo. Se continuar, recarregue a página.">
        <Btn icon="refresh" onClick={reset}>
          Tentar de novo
        </Btn>
      </EmptyState>
    </div>
  );
}
