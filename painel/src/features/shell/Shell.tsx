"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { getSessionStore } from "@/features/session/runtime";
import { useSession } from "@/features/session/useSession";
import { Paths, destinationFor } from "@/lib/routing/routes";
import { loginUrlFor } from "@/lib/routing/safeNext";
import type { PanelUser } from "@/lib/session/user";
import { Btn } from "@/ui/Btn";
import { Dialog } from "@/ui/Dialog";
import { Icon } from "@/ui/Icon";
import { InlineError } from "@/ui/InlineError";
import { Spinner } from "@/ui/Spinner";
import { AcceptanceHost } from "@/features/acceptance/AcceptanceHost";
import { ShortcutsProvider } from "./ShortcutsProvider";
import { Sidebar } from "./Sidebar";

/**
 * Guarda e moldura de toda tela logada (§5.2–§5.4).
 * - restaurando ou saindo: carregando, sem mexer na rota (um F5 nunca pisca o login);
 * - indisponível: a mensagem com "Tentar de novo" (sem rede no boot não leva ao login);
 * - sem sessão: `/entrar/?de=<rota>` na expiração, `/entrar/` puro no "Sair";
 * - autenticado: sidebar + tela.
 */
export function ShellGate({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const signedOut = session.status === "anonymous" || session.status === "denied";
  const keepReturn = session.status === "anonymous" ? session.keepReturn : true;

  useEffect(() => {
    if (!signedOut) return;
    router.replace(keepReturn ? loginUrlFor(pathname, window.location.search) : Paths.login);
  }, [signedOut, keepReturn, pathname, router]);

  if (session.status === "unavailable") {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <div className="w-full max-w-[420px]">
          <InlineError message={session.message} onRetry={() => void getSessionStore().restore()} />
        </div>
      </main>
    );
  }

  if (session.status !== "authenticated") {
    return (
      <main className="grid min-h-dvh place-items-center text-primary-text">
        <Spinner size={32} label="Carregando o painel" />
      </main>
    );
  }

  return <Shell user={session.user}>{children}</Shell>;
}

function Shell({ user, children }: { user: PanelUser; children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = destinationFor(pathname)?.label ?? "Motoka";

  return (
    <ShortcutsProvider>
      <a
        href="#conteudo"
        className="type-label-md sr-only z-50 rounded-md bg-primary px-3 py-2 text-on-primary focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Pular para o conteúdo
      </a>
      <div className="flex min-h-dvh bg-background text-text-primary">
        <aside className="sticky top-0 hidden h-dvh shrink-0 border-r border-border lg:block">
          <Sidebar user={user} pathname={pathname} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-2 border-b border-border px-3 py-2 lg:hidden">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir o menu"
              aria-expanded={drawerOpen}
              className="grid size-11 cursor-pointer place-items-center rounded-md text-text-primary hover:bg-surface-variant"
            >
              <Icon name="menu" size={24} />
            </button>
            <span className="type-title-lg">{title}</span>
          </header>
          <main id="conteudo" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
            <AcceptanceHost />
            {children}
          </main>
        </div>
      </div>
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen} title="Menu do painel" variant="side">
        <Sidebar user={user} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
      </Dialog>
    </ShortcutsProvider>
  );
}

/** Saída usada pela Conta: o botão fica em carregando até o W3 (no máximo 5 s). */
export function LogoutButton() {
  const [leaving, setLeaving] = useState(false);
  return (
    <Btn
      kind="secondary"
      icon="logout"
      loading={leaving}
      onClick={() => {
        setLeaving(true);
        void getSessionStore().logout();
      }}
    >
      Sair
    </Btn>
  );
}
