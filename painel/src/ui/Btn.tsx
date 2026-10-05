import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

type Kind = "primary" | "secondary" | "ghost" | "danger";

interface BtnProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  readonly kind?: Kind;
  readonly icon?: IconName;
  readonly full?: boolean;
  /** Mostra o carregando e bloqueia o clique, mantendo o rótulo para o leitor de tela. */
  readonly loading?: boolean;
  readonly children: ReactNode;
}

const KIND: Record<Kind, string> = {
  primary: "bg-primary text-on-primary border-primary hover:bg-primary-dark",
  secondary: "bg-transparent text-text-primary border-border hover:bg-surface-variant",
  ghost: "bg-transparent text-primary-text border-transparent hover:bg-primary-tint",
  danger: "bg-transparent text-error border-error/50 hover:bg-error-tint-soft",
};

/** Botão do design (`Btn` do ScheduleShared.jsx): 10×16, raio md, `label-lg`. */
export function Btn({
  kind = "primary",
  icon,
  full,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...rest
}: BtnProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "type-label-lg inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 py-2.5",
        "cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60",
        KIND[kind],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={18} /> : icon ? <Icon name={icon} size={18} /> : null}
      {children}
    </button>
  );
}
