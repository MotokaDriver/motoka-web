import { cn } from "./cn";

/** Iniciais num círculo (`Avatar` do FutureShared.jsx), na cor primária do tema. */
export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "type-label-md grid size-8 shrink-0 place-items-center rounded-full border border-border bg-primary/20 font-bold text-primary-text",
        className,
      )}
    >
      {initials}
    </span>
  );
}
