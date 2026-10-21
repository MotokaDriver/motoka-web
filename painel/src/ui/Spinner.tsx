import { cn } from "./cn";

interface SpinnerProps {
  readonly size?: number;
  readonly className?: string;
  /** Com rótulo, o spinner é anunciado (`role="status"`); sem, é decorativo. */
  readonly label?: string;
}

const SIZE: Record<number, string> = { 16: "size-4", 18: "size-[18px]", 24: "size-6", 32: "size-8" };

export function Spinner({ size = 24, className, label }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "inline-block animate-spin rounded-full border-2 border-current border-t-transparent",
        SIZE[size] ?? "size-6",
        className,
      )}
    />
  );
}
