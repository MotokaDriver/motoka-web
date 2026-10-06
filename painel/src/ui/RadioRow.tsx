"use client";

import { useId } from "react";

/** Opção de rádio com rótulo e dica: o `input` e o `label` ficam irmãos, ligados por `htmlFor`. */
export function RadioRow({
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="radio" name={name} checked={checked} onChange={onChange} className="mt-1 size-4 cursor-pointer accent-primary" />
      <label htmlFor={id} className="type-body-md min-w-0 cursor-pointer">
        <span className="font-semibold text-text-primary">{label}</span>
        {hint && <span className="type-caption block text-text-tertiary">{hint}</span>}
      </label>
    </div>
  );
}
