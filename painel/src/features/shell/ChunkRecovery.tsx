"use client";

import { useEffect, useState } from "react";
import { clearReloadMark } from "@/lib/prefs/prefs";
import { Btn } from "@/ui/Btn";
import { UPDATED_MESSAGE, isChunkLoadError, recoverFromChunkError } from "./chunkErrors";

/** Depois deste tempo sem erro, uma falha de chunk volta a ter direito à recarga automática. */
const HEALTHY_AFTER_MS = 60_000;

export function reloadPage(): void {
  window.location.reload();
}

/**
 * Escuta `ChunkLoadError` em promessas e em erros globais (DN-24). O error boundary do shell
 * (`app/(app)/(shell)/error.tsx`) cobre o que estoura na renderização.
 */
export function ChunkRecovery() {
  const [ask, setAsk] = useState(false);

  useEffect(() => {
    const handle = (error: unknown) => {
      if (!isChunkLoadError(error)) return;
      if (recoverFromChunkError(reloadPage) === "ask") setAsk(true);
    };
    const onRejection = (event: PromiseRejectionEvent) => handle(event.reason);
    const onError = (event: ErrorEvent) => handle(event.error);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);
    const healthy = window.setTimeout(clearReloadMark, HEALTHY_AFTER_MS);
    return () => {
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
      window.clearTimeout(healthy);
    };
  }, []);

  if (!ask) return null;
  return <UpdatedBanner />;
}

export function UpdatedBanner() {
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-w-lg items-center gap-3 rounded-lg border border-border bg-surface-elevated p-3.5"
    >
      <p className="type-body-md flex-1 text-text-primary">{UPDATED_MESSAGE}</p>
      <Btn icon="refresh" onClick={reloadPage}>
        Recarregar
      </Btn>
    </div>
  );
}
