"use client";

import { Toast } from "@base-ui/react/toast";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Provedor de toasts (Base UI): anunciados com `aria-live`, fecham sozinhos em 5 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className="flex items-start gap-3 rounded-lg border border-border bg-surface-elevated p-3.5 text-text-primary"
    >
      <Toast.Content className="min-w-0 flex-1">
        <Toast.Title className="type-title-sm font-semibold" />
        <Toast.Description className="type-body-sm text-text-secondary" />
      </Toast.Content>
      <Toast.Close
        aria-label="Fechar aviso"
        className="grid size-8 cursor-pointer place-items-center rounded-md text-text-secondary hover:bg-surface-variant"
      >
        <Icon name="close" size={18} />
      </Toast.Close>
    </Toast.Root>
  ));
}

/** `toast({ title })` de qualquer componente dentro do provedor. */
export function useToast(): (input: { title: ReactNode; description?: ReactNode }) => void {
  const manager = Toast.useToastManager();
  return (input) => {
    manager.add(input);
  };
}
