"use client";

import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { useId } from "react";

/**
 * Interruptor do design (`Toggle` do ScheduleShared.jsx, 46×28) sobre a Base UI, com rótulo e
 * descrição ligados.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  const descriptionId = `${id}-description`;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="type-body-md cursor-pointer text-text-primary">
          {label}
        </label>
        {description && (
          <p id={descriptionId} className="type-caption mt-0.5 text-text-tertiary">
            {description}
          </p>
        )}
      </div>
      <BaseSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next)}
        aria-describedby={description ? descriptionId : undefined}
        className="relative h-7 w-[46px] shrink-0 cursor-pointer rounded-full border border-border bg-surface-variant transition-colors data-[checked]:bg-success"
      >
        <BaseSwitch.Thumb className="absolute left-[3px] top-[3px] size-5 rounded-full bg-white transition-transform data-[checked]:translate-x-[18px]" />
      </BaseSwitch.Root>
    </div>
  );
}
