import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/** Superfície com borda de 1 px e raio lg; o design é plano, sem sombra. */
export function Card({ children, className, ...rest }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-3.5", className)} {...rest}>
      {children}
    </div>
  );
}
