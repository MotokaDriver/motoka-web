import { cn } from "./cn";

/**
 * Iniciais num círculo (`Avatar` do FutureShared.jsx). Sem `color`, na cor primária do tema; com
 * `color` (identidade de uma pessoa), fundo a 20% e borda na cor. As iniciais seguem no texto
 * primário para manter o contraste nos dois temas. Decorativo: o nome vem ao lado.
 */
export function Avatar({
  initials,
  className,
  color,
  size = 32,
  ring = false,
}: {
  initials: string;
  className?: string;
  color?: string;
  size?: 26 | 30 | 32 | 34 | 36;
  /** Anel na cor (motoboy em turno). */
  ring?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={
        color
          ? {
              width: size,
              height: size,
              background: `color-mix(in srgb, ${color} 20%, transparent)`,
              borderColor: color,
              boxShadow: ring ? `0 0 0 2px var(--background), 0 0 0 4px ${color}` : undefined,
            }
          : { width: size, height: size }
      }
      className={cn(
        "type-label-md grid shrink-0 place-items-center rounded-full border font-bold",
        color ? "text-text-primary" : "border-border bg-primary/20 text-primary-text",
        size < 32 && "text-[11px]",
        className,
      )}
    >
      {initials}
    </span>
  );
}
