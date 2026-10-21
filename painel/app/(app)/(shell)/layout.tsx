import type { ReactNode } from "react";
import { ShellGate } from "@/features/shell/Shell";

/** Moldura das telas logadas: guarda de sessão, sidebar e drawer (§5.4). */
export default function ShellLayout({ children }: { children: ReactNode }) {
  return <ShellGate>{children}</ShellGate>;
}
