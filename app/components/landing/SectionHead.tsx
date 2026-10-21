import type { ReactNode } from "react";

export const wrap = "mx-auto w-full max-w-[1216px] px-4 lp-md:px-8";
export const section = "py-[88px] lp-md:py-32 scroll-mt-16";
export const h2Class =
  "m-0 text-[clamp(32px,4.4vw,56px)] font-bold leading-[1.05] tracking-[-0.035em] text-balance";
export const leadClass =
  "m-0 max-w-[560px] text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-lp-ink-2 text-pretty";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`m-0 flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.9px] text-lp-ink-3 ${className}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-[2px] bg-lp-blue" />
      {children}
    </p>
  );
}

export default function SectionHead({
  eyebrow,
  title,
  lead,
  id,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  id: string;
}) {
  return (
    <div
      data-reveal=""
      className="mb-12 grid grid-cols-1 items-end gap-7 lp-md:mb-[72px] lp-md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lp-md:gap-14"
    >
      <div>
        <Eyebrow className="mb-5">{eyebrow}</Eyebrow>
        <h2 id={id} className={h2Class}>
          {title}
        </h2>
      </div>
      <p className={leadClass}>{lead}</p>
    </div>
  );
}
