"use client";

import Link from "next/link";
import { Paths } from "@/lib/routing/routes";
import { cn } from "@/ui/cn";

/**
 * Abas de "Minha equipe": Escala e Acertos. O contador do Acertos é o `needs_action_count` do servidor
 * (acertos que esperam a loja: para confirmar ou contestados).
 */
export function TeamTabs({ active, needsAction }: { active: "escala" | "acertos"; needsAction: number }) {
  const tab = (on: boolean) =>
    cn(
      "type-label-md inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3.5 font-semibold",
      on ? "border-border bg-primary-tint text-primary-text" : "border-border text-text-secondary hover:bg-surface-variant",
    );
  return (
    <nav aria-label="Minha equipe" className="flex gap-1.5">
      <Link href={Paths.team} aria-current={active === "escala" ? "page" : undefined} className={tab(active === "escala")}>
        Escala
      </Link>
      <Link
        href={Paths.settlements}
        aria-current={active === "acertos" ? "page" : undefined}
        aria-label={needsAction > 0 ? `Acertos, ${needsAction} ${needsAction === 1 ? "espera" : "esperam"} você` : "Acertos"}
        className={tab(active === "acertos")}
      >
        Acertos
        {needsAction > 0 && <span aria-hidden className="type-label-sm grid min-w-5 place-items-center rounded-full bg-warning px-1.5 font-bold text-black">{needsAction}</span>}
      </Link>
    </nav>
  );
}
