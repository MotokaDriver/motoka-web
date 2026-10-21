"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./Icon";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  readonly label: string;
  readonly error?: string;
  readonly hint?: ReactNode;
  /** Campo de senha com o botão de mostrar/ocultar. */
  readonly revealable?: boolean;
}

/**
 * Campo do painel (`WebField`/`TextField` do design): rótulo em cima, caixa em `surface-variant`
 * com borda de 1 px que engrossa no foco e no erro. Erro ligado por `aria-describedby`.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, revealable = false, type = "text", className, ...rest },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [revealed, setRevealed] = useState(false);
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={id} className="type-body-sm text-text-secondary">
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border bg-surface-variant px-4",
          "focus-within:border-[1.5px] focus-within:border-primary",
          error ? "border-[1.5px] border-error" : "border-border",
        )}
      >
        <input
          ref={ref}
          id={id}
          type={revealable && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="type-body-md min-h-12 min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary"
          {...rest}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={revealed}
            className="-mr-2 grid size-10 cursor-pointer place-items-center rounded-md text-text-secondary hover:text-text-primary"
          >
            <Icon name={revealed ? "visibility_off" : "visibility"} size={20} />
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="type-caption text-text-tertiary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="type-caption ml-1 text-error">
          {error}
        </p>
      )}
    </div>
  );
});
