import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Medalhão de 64 px, título e descrição (`EmptyState` do design). */
export function EmptyState({
  icon,
  title,
  description,
  children,
  headingLevel = 2,
}: {
  icon: IconName;
  /** 1 quando o estado vazio é a página inteira (404). */
  headingLevel?: 1 | 2;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-surface-variant text-text-tertiary">
        <Icon name={icon} size={28} />
      </span>
      {headingLevel === 1 ? (
        <h1 className="type-title-lg mt-5 text-text-primary">{title}</h1>
      ) : (
        <h2 className="type-title-lg mt-5 text-text-primary">{title}</h2>
      )}
      {description && <p className="type-body-md mt-2 max-w-md text-pretty text-text-secondary">{description}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}
