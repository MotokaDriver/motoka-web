import type { ReactNode } from "react";
import { focusRing } from "./links";
import { Eyebrow, wrap } from "./SectionHead";
import SiteShell from "./SiteShell";

export type TocItem = { id: string; label: string };

const tocLink = `block rounded py-1 text-sm leading-snug text-lp-ink-2 transition-colors hover:text-lp-ink ${focusRing}`;

function TocList({ items }: { items: TocItem[] }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-1 p-0">
      {items.map((item) => (
        <li key={item.id}>
          <a href={`#${item.id}`} className={tocLink}>
            {item.label}
          </a>
        </li>
      ))}
    </ol>
  );
}

// Páginas de texto longo do site (termos, privacidade, excluir conta): cabeçalho no padrão da
// landing, sumário opcional (fixo ao lado no desktop, recolhível no celular) e o texto em .lp-prose.
export default function LegalPage({
  eyebrow,
  title,
  meta,
  toc,
  proseClassName = "",
  children,
}: {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  toc?: TocItem[];
  proseClassName?: string;
  children: ReactNode;
}) {
  return (
    <SiteShell mainClassName="pt-16">
      <div className={wrap}>
        <header className="border-b border-lp-line pt-14 pb-10 lp-md:pt-20 lp-md:pb-14">
          <Eyebrow className="mb-5">{eyebrow}</Eyebrow>
          <h1 className="m-0 max-w-[20ch] text-[clamp(34px,4.6vw,56px)] font-bold leading-[1.05] tracking-[-0.035em] text-balance">
            {title}
          </h1>
          {meta && <p className="m-0 mt-5 text-sm text-lp-ink-3">{meta}</p>}
        </header>
        <div
          className={`grid grid-cols-1 gap-10 pt-10 pb-20 lp-md:pt-14 lp-md:pb-28 ${
            toc ? "lp-lg:grid-cols-[220px_minmax(0,1fr)] lp-lg:gap-16" : ""
          }`}
        >
          {toc && (
            <>
              <details className="group rounded-xl border border-lp-line bg-lp-panel lp-lg:hidden">
                <summary
                  className={`flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold [&::-webkit-details-marker]:hidden ${focusRing}`}
                >
                  Sumário
                  <span
                    aria-hidden="true"
                    className="text-lg leading-none text-lp-ink-3 transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                  >
                    +
                  </span>
                </summary>
                <nav aria-label="Sumário" className="border-t border-lp-line px-4 pt-2 pb-3">
                  <TocList items={toc} />
                </nav>
              </details>
              <aside className="hidden lp-lg:block">
                <nav aria-label="Sumário" className="sticky top-24">
                  <p className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.9px] text-lp-ink-3">
                    Nesta página
                  </p>
                  <TocList items={toc} />
                </nav>
              </aside>
            </>
          )}
          <article className={`lp-prose ${proseClassName}`}>{children}</article>
        </div>
      </div>
    </SiteShell>
  );
}
