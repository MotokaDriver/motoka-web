"use client";

import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  readonly label: string;
  readonly hint?: ReactNode;
  readonly children: ReactNode;
}

/** Lista suspensa nativa no visual do `Field` (teclado e leitor de tela de graça). */
export function SelectField({ label, hint, children, ...rest }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="type-label-sm font-semibold uppercase tracking-[0.8px] text-text-tertiary">
        {label}
      </label>
      <select
        id={id}
        {...rest}
        className="type-body-md min-h-12 rounded-md border border-border bg-surface-variant px-3 text-text-primary outline-none focus:border-[1.5px] focus:border-primary"
      >
        {children}
      </select>
      {hint && <p className="type-caption text-text-tertiary">{hint}</p>}
    </div>
  );
}
