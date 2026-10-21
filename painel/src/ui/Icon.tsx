import { iconPaths, type IconName } from "@/icons/store";

export type { IconName };

interface IconProps {
  readonly name: IconName;
  readonly size?: number;
  readonly filled?: boolean;
  readonly className?: string;
  /** Sem rótulo o ícone é decorativo (`aria-hidden`). */
  readonly label?: string;
}

/** Ícone Material Symbols Rounded em SVG (DN-10), na cor do texto (`currentColor`). */
export function Icon({ name, size = 20, filled = false, className, label }: IconProps) {
  const paths = iconPaths(name, filled);
  return (
    <svg
      viewBox="0 -960 960 960"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
