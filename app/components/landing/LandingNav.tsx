/* eslint-disable @next/next/no-img-element -- logo PNG pequeno; export estático sem otimização. */
import { PAINEL_URL, btnPrimary, btnSecondary, btnSmall, focusRing } from "./links";
import { wrap } from "./SectionHead";

const NAV = [
  { href: "#lojas", label: "Para estabelecimentos" },
  { href: "#motoboys", label: "Para motoboys" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#duvidas", label: "Dúvidas" },
];

// Na home as âncoras são locais; nas outras páginas apontam para as seções da home.
export default function LandingNav({ home = false }: { home?: boolean }) {
  const base = home ? "" : "/";
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1C1C1C] bg-[rgba(10,10,10,.94)]">
      <div className={`${wrap} flex h-16 items-center gap-3 lp-md:gap-8`}>
        <a href={home ? "#topo" : "/"} className={`rounded ${focusRing}`}>
          <img
            src="/landing/logo-motoka-branco.png"
            alt="Motoka, voltar ao início"
            width={1149}
            height={233}
            className="block h-[22px] w-auto"
          />
        </a>
        <nav aria-label="Seções" className="mr-auto hidden gap-7 lp-lg:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={`${base}${n.href}`}
              className={`rounded text-sm font-medium text-lp-ink-2 transition-colors hover:text-lp-ink ${focusRing}`}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex gap-2.5">
          <a href={PAINEL_URL} className={`${btnSecondary} ${btnSmall} max-[860px]:!hidden`}>
            Entrar no painel
          </a>
          <a href={`${base}#baixar`} className={`${btnPrimary} ${btnSmall}`}>
            Baixar app
          </a>
        </div>
      </div>
    </header>
  );
}
