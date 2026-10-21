import type { ReactNode } from "react";
import LandingFooter from "./LandingFooter";
import LandingNav from "./LandingNav";

// Casca comum das páginas públicas: pular para o conteúdo, nav fixa, <main> e rodapé.
// `home` liga as âncoras da nav às seções da própria página; fora dela apontam para /#...
export default function SiteShell({
  children,
  home = false,
  mainClassName = "",
}: {
  children: ReactNode;
  home?: boolean;
  mainClassName?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-lp-bg font-lp text-lp-ink antialiased selection:bg-lp-blue selection:text-white">
      <a
        href="#topo"
        className="sr-only z-[60] rounded-lg bg-lp-blue px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <LandingNav home={home} />
      <main id="topo" tabIndex={-1} className={`flex-1 outline-none ${mainClassName}`}>
        {children}
      </main>
      <LandingFooter />
    </div>
  );
}
