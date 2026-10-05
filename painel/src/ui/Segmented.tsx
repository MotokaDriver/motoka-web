"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useId } from "react";
import { cn } from "./cn";

/**
 * Controle segmentado (o seletor de tema da Conta no design) como grupo de rádio da Base UI:
 * setas mudam a opção, Tab sai do grupo.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onValueChange: (value: T) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex items-center gap-3">
      <span id={labelId} className="type-body-md flex-1 text-text-primary">
        {label}
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        value={value}
        onValueChange={(next) => onValueChange(next as T)}
        className="flex overflow-hidden rounded-md border border-border"
      >
        {options.map((option) => (
          <Radio.Root
            key={option.value}
            value={option.value}
            className={cn(
              "type-label-md min-h-9 cursor-pointer px-3 py-1.5 font-semibold text-text-secondary",
              "data-[checked]:bg-primary data-[checked]:text-on-primary",
            )}
          >
            {option.label}
          </Radio.Root>
        ))}
      </RadioGroup>
    </div>
  );
}
