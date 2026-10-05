"use client";

import Link from "next/link";
import { DESTINATIONS, destinationFor } from "@/lib/routing/routes";
import { initials, storeAddress, storeName, type PanelUser } from "@/lib/session/user";
import { Avatar } from "@/ui/Avatar";
import { cn } from "@/ui/cn";
import { Icon } from "@/ui/Icon";

/**
 * Navegação fixa do painel (`WebShell` do design, §5.4): marca e "WEB", os destinos e a loja no
 * rodapé. O item ativo fica em `primary` com fundo a 10 % e `aria-current="page"`.
 */
export function Sidebar({
  user,
  pathname,
  onNavigate,
}: {
  user: PanelUser;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = destinationFor(pathname);
  const name = storeName(user);
  const address = storeAddress(user);

  return (
    <div className="flex h-full w-[232px] flex-col gap-1 bg-background px-3 py-5">
      <div className="flex items-center gap-2.5 px-2 pb-5">
        {/* eslint-disable-next-line @next/next/no-img-element -- export estático, imagem local */}
        <img src="/logo_icon_blue.png" alt="Motoka" width={106} height={20} className="h-5 w-auto" />
        <span className="type-label-sm ml-auto font-semibold text-text-tertiary">WEB</span>
      </div>
      <nav aria-label="Painel" className="flex flex-col gap-1">
        {DESTINATIONS.map((destination) => {
          const on = destination === active;
          return (
            <Link
              key={destination.path}
              href={destination.path}
              onClick={onNavigate}
              aria-current={on ? "page" : undefined}
              className={cn(
                "type-body-md flex min-h-10 items-center gap-2.5 rounded-md px-2.5 py-[9px] transition-colors",
                on
                  ? "bg-primary-tint font-semibold text-primary-text"
                  : "text-text-secondary hover:bg-surface-variant hover:text-text-primary",
              )}
            >
              <span className={on ? "text-primary-text" : "text-text-tertiary"}>
                <Icon name={destination.icon} size={20} filled={on} />
              </span>
              {destination.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 border-t border-divider p-2.5">
        <Avatar initials={initials(name)} />
        <div className="min-w-0">
          <p className="type-label-md truncate font-semibold text-text-primary">{name}</p>
          {address && <p className="type-caption truncate text-text-tertiary">{address}</p>}
        </div>
      </div>
    </div>
  );
}
