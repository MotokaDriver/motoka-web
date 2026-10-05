import type { ReactNode } from "react";
import { cn } from "./cn";

/** Rótulo de seção em caixa alta (`Label` do FutureShared.jsx). */
export function Label({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "h2" | "h3";
}) {
  return (
    <Tag className={cn("type-label-sm font-semibold uppercase tracking-[0.8px] text-text-tertiary", className)}>
      {children}
    </Tag>
  );
}
