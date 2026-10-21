"use client";

import Link from "next/link";
import { Paths } from "@/lib/routing/routes";
import { cn } from "@/ui/cn";

const Badge = ({ count }: { count: number }) => (
  <span aria-hidden className="type-label-sm grid min-w-5 place-items-center rounded-full bg-warning px-1.5 font-bold text-black">
    {count}
  </span>
);

/**
 * Abas de "Minha equipe": Escala e Acertos. O contador do Acertos é o `needs_action_count` do servidor
 * (acertos que esperam a loja: para confirmar ou contestados); o da Escala, os pedidos para entrar pelo
 * link que esperam aprovação.
 */
export function TeamTabs({
  active,
  needsAction,
  joinRequests = 0,
}: {
  active: "escala" | "acertos";
  needsAction: number;
  joinRequests?: number;
}) {
  const tab = (on: boolean) =>
    cn(
      "type-label-md inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3.5 font-semibold",
      on ? "border-border bg-primary-tint text-primary-text" : "border-border text-text-secondary hover:bg-surface-variant",
    );
  return (
    <nav aria-label="Minha equipe" className="flex gap-1.5">
      <Link
        href={Paths.team}
        aria-current={active === "escala" ? "page" : undefined}
        aria-label={joinRequests > 0 ? `Escala, ${joinRequests} ${joinRequests === 1 ? "pedido" : "pedidos"} para entrar` : "Escala"}
        className={tab(active === "escala")}
      >
        Escala
        {joinRequests > 0 && <Badge count={joinRequests} />}
      </Link>
      <Link
        href={Paths.settlements}
        aria-current={active === "acertos" ? "page" : undefined}
        aria-label={needsAction > 0 ? `Acertos, ${needsAction} ${needsAction === 1 ? "espera" : "esperam"} você` : "Acertos"}
        className={tab(active === "acertos")}
      >
        Acertos
        {needsAction > 0 && <Badge count={needsAction} />}
      </Link>
    </nav>
  );
}
