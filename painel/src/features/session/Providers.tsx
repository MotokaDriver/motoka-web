"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/ui/Toast";
import { ChunkRecovery } from "@/features/shell/ChunkRecovery";
import { getQueryClient, getSessionStore } from "./runtime";

let restoreStarted = false;

/**
 * Providers do app (layout de grupo, não do raiz: o 404 é estático e sem sessão, DN-23). O boot
 * sempre tenta o W2 uma vez por aba, inclusive no StrictMode do dev, que monta o efeito duas vezes.
 */
export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (restoreStarted) return;
    restoreStarted = true;
    void getSessionStore().restore();
  }, []);

  return (
    <QueryClientProvider client={getQueryClient()}>
      <ToastProvider>
        <ChunkRecovery />
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );
}
