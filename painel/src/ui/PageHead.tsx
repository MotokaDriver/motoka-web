import type { ReactNode } from "react";

/** Cabeçalho de tela (`PageHead` do ScheduleShared.jsx): título de 24 px, subtítulo e ações. */
export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-4 px-5 pb-[18px] pt-6 lg:px-7">
      <div className="min-w-0 flex-1">
        <h1 className="type-heading-lg font-bold text-text-primary">{title}</h1>
        {sub && <p className="type-body-md mt-1 text-text-tertiary">{sub}</p>}
      </div>
      {right && <div className="flex gap-2">{right}</div>}
    </div>
  );
}
