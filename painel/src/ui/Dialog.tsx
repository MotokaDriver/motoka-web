"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useEffect, type ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./Icon";
import { overlayClosed, overlayOpened } from "./overlays";

/** Registra o overlay aberto no contador dos atalhos enquanto `open` for verdadeiro. */
export function useOverlayRegistration(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    overlayOpened();
    return overlayClosed;
  }, [open]);
}

interface DialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  /** `side`: painel lateral (drawer da navegação abaixo de 1024 px). */
  readonly variant?: "center" | "side";
  readonly className?: string;
}

/**
 * Dialog e drawer do painel sobre a Base UI: foco preso, ESC, `aria-modal`, título ligado. O
 * mock do design não tem nada disso (é tudo `div onClick`).
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  variant = "center",
  className,
}: DialogProps) {
  useOverlayRegistration(open);
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-40 bg-overlay" />
        <BaseDialog.Popup
          className={cn(
            "fixed z-50 flex flex-col border border-border bg-background text-text-primary outline-none",
            variant === "center"
              ? "left-1/2 top-1/2 max-h-[92vh] w-[min(460px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xxl p-7"
              : "inset-y-0 left-0 w-[min(280px,85vw)] border-y-0 border-l-0",
            className,
          )}
        >
          <div className={cn("flex items-start gap-3", variant === "side" && "sr-only")}>
            <div className="min-w-0 flex-1">
              <BaseDialog.Title className="type-title-lg font-bold">{title}</BaseDialog.Title>
              {description && (
                <BaseDialog.Description className="type-body-sm mt-1 text-text-tertiary">
                  {description}
                </BaseDialog.Description>
              )}
            </div>
            {variant === "center" && (
              <BaseDialog.Close
                aria-label="Fechar"
                className="-mr-2 -mt-2 grid size-10 cursor-pointer place-items-center rounded-md text-text-secondary hover:bg-surface-variant"
              >
                <Icon name="close" size={20} />
              </BaseDialog.Close>
            )}
          </div>
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export const DialogClose = BaseDialog.Close;
