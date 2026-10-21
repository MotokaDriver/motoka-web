"use client";

import { Btn } from "./Btn";
import { Dialog } from "./Dialog";

export interface ConfirmRequest {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
  readonly onConfirm: () => void;
}

/**
 * Confirmação (`showPanelConfirm` do Flutter): ação primária à direita, "Cancelar" à esquerda,
 * 440 px (R-1 do WS-05a: nunca esticada na largura da tela).
 */
export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={request?.title ?? ""}
      description={request?.description}
    >
      <div className="mt-6 flex justify-end gap-3">
        <Btn kind="secondary" onClick={onClose}>
          {request?.cancelLabel ?? "Cancelar"}
        </Btn>
        <Btn
          kind={request?.danger ? "danger" : "primary"}
          onClick={() => {
            const confirm = request?.onConfirm;
            onClose();
            confirm?.();
          }}
        >
          {request?.confirmLabel ?? ""}
        </Btn>
      </div>
    </Dialog>
  );
}
