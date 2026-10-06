import type { ReactNode } from "react";
import { Providers } from "@/features/session/Providers";

/** Layout de grupo (não raiz): sessão, Query e toasts (DN-23). */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
