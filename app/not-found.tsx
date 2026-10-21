import type { Metadata } from "next";
import Link from "next/link";
import { PAINEL_URL, btnPrimary, btnSecondary } from "./components/landing/links";
import { Eyebrow, wrap } from "./components/landing/SectionHead";
import SiteShell from "./components/landing/SiteShell";

export const metadata: Metadata = {
  title: "Página não encontrada | Motoka Driver",
  robots: { index: false },
};

// 404 do export estático (out/404.html, servido pelo Worker com not_found_handling "404-page").
export default function NotFound() {
  return (
    <SiteShell mainClassName="flex items-center pt-16">
      <div className={`${wrap} py-24 lp-md:py-32`}>
        <Eyebrow className="mb-5">Erro 404</Eyebrow>
        <h1 className="m-0 max-w-[16ch] text-[clamp(34px,4.6vw,56px)] font-bold leading-[1.05] tracking-[-0.035em] text-balance">
          Esta página não existe ou mudou de endereço.
        </h1>
        <p className="m-0 mt-5 max-w-[52ch] text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-lp-ink-2 text-pretty">
          Confira o link ou volte para o início. Se você é um estabelecimento, o painel continua no mesmo lugar.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/" prefetch={false} className={btnPrimary}>
            Voltar ao início
          </Link>
          <a href={PAINEL_URL} className={btnSecondary}>
            Entrar no painel
          </a>
        </div>
      </div>
    </SiteShell>
  );
}
