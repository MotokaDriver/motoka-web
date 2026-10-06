"use client";

import { Menu } from "@base-ui/react/menu";
import { useState } from "react";
import { cn } from "./cn";
import { useOverlayRegistration } from "./Dialog";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";

export interface ActionMenuItem {
  readonly label: string;
  readonly onSelect: () => void;
  readonly danger?: boolean;
}

/**
 * Botão de três pontos com menu (Base UI: setas, Enter, ESC e foco devolvido ao botão). Aberto, conta
 * como overlay: os atalhos de uma letra não disparam (B-1 do WS-05a). Em `busy` vira um spinner.
 */
export function ActionMenu({
  label,
  items,
  busy = false,
  disabled = false,
}: {
  label: string;
  items: readonly ActionMenuItem[];
  busy?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  useOverlayRegistration(open);

  if (busy) {
    return (
      <span role="status" aria-label={`${label}: em andamento`} className="grid size-10 place-items-center text-primary-text">
        <Spinner size={18} />
      </span>
    );
  }

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        aria-label={label}
        disabled={disabled}
        className="grid size-10 cursor-pointer place-items-center rounded-md text-text-secondary hover:bg-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Icon name="more_vert" size={20} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={4} className="z-50">
          <Menu.Popup className="min-w-48 rounded-md border border-border bg-surface-elevated p-1 outline-none">
            {items.map((item) => (
              <Menu.Item
                key={item.label}
                onClick={item.onSelect}
                className={cn(
                  "type-body-md flex min-h-10 cursor-pointer items-center rounded-sm px-3 outline-none data-[highlighted]:bg-surface-variant",
                  item.danger ? "text-error" : "text-text-primary",
                )}
              >
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
