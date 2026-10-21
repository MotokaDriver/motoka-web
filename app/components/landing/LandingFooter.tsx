/* eslint-disable @next/next/no-img-element -- logo PNG pequeno; export estático sem otimização. */
// prefetch desligado: no export estático o prefetch de segmento do Next pede arquivos que o out/ não tem (404 no console).
import Link from "next/link";
import { APP_STORE_URL, CONTACT_EMAIL, PAINEL_URL, PLAY_STORE_URL, WHATSAPP_URL, focusRing } from "./links";
import { wrap } from "./SectionHead";

const linkClass = `rounded text-sm text-lp-ink-2 [overflow-wrap:anywhere] hover:text-lp-ink ${focusRing}`;
const headClass = "m-0 mb-3.5 text-xs font-semibold uppercase tracking-[0.9px] text-lp-ink-3";

// Selos de startup que a landing antiga mostrava no rodapé.
const SEALS = [
  { src: "/landing/selo-prime.png", alt: "Founders Club: membro Prime" },
  { src: "/landing/selo-verificada.png", alt: "Founders Club: startup verificada" },
];

export default function LandingFooter() {
  return (
    <footer className="border-t border-[#1A1A1A] pt-14 pb-12">
      <div className={wrap}>
        <div className="grid grid-cols-2 gap-10 lp-md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 flex flex-col gap-4 lp-md:col-span-1">
            <img
              src="/landing/logo-motoka-branco.png"
              alt="Motoka"
              width={1149}
              height={233}
              loading="lazy"
              className="block h-6 w-auto self-start"
            />
            <p className="m-0 max-w-[300px] text-sm leading-normal text-lp-ink-3">
              Logística de motoboys para estabelecimentos. Painel web para a loja, app para o motoboy.
            </p>
          </div>
          <nav aria-labelledby="rodape-produto">
            <h2 id="rodape-produto" className={headClass}>Produto</h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              <li><a href={PAINEL_URL} className={linkClass}>Painel do estabelecimento</a></li>
              <li><a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>App Store</a></li>
              <li><a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>Google Play</a></li>
            </ul>
          </nav>
          <nav aria-labelledby="rodape-contato">
            <h2 id="rodape-contato" className={headClass}>Contato</h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              <li><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>WhatsApp</a></li>
              <li><a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>{CONTACT_EMAIL}</a></li>
            </ul>
          </nav>
          <nav aria-labelledby="rodape-legal">
            <h2 id="rodape-legal" className={headClass}>Legal</h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              <li><Link href="/termos-de-uso" prefetch={false} className={linkClass}>Termos de uso</Link></li>
              <li><Link href="/politica-de-privacidade" prefetch={false} className={linkClass}>Política de privacidade</Link></li>
              <li><Link href="/excluir-conta" prefetch={false} className={linkClass}>Excluir conta</Link></li>
            </ul>
          </nav>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-8">
          {SEALS.map((seal) => (
            <img
              key={seal.src}
              src={seal.src}
              alt={seal.alt}
              width={966}
              height={546}
              loading="lazy"
              className="block h-20 w-auto lp-md:h-24"
            />
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-between gap-x-6 gap-y-3 border-t border-[#161616] pt-6 text-[13px] text-lp-ink-3">
          <span>© {new Date().getFullYear()} Motoka · CNPJ 57.562.666/0001-50</span>
          <span>motokadriver.com</span>
        </div>
      </div>
    </footer>
  );
}
