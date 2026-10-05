import type { EXTRA_ICONS } from "./extra";
import { FILLED_ICONS, ICONS, type IconName as CoreIconName } from "./registry";

/** Todos os nomes de ícone, os do núcleo (sempre carregados) e os de telas (registrados sob demanda). */
export type IconName = CoreIconName | keyof typeof EXTRA_ICONS;

const extra = new Map<string, readonly string[]>();
const extraFilled = new Map<string, readonly string[]>();

/** Uma tela com ícones próprios os registra ao carregar (fora do primeiro carregamento do login). */
export function registerExtraIcons(
  icons: Readonly<Record<string, readonly string[]>>,
  filled: Readonly<Record<string, readonly string[]>>,
): void {
  for (const [name, paths] of Object.entries(icons)) extra.set(name, paths);
  for (const [name, paths] of Object.entries(filled)) extraFilled.set(name, paths);
}

export function iconPaths(name: IconName, filled: boolean): readonly string[] {
  const core = ICONS as Readonly<Record<string, readonly string[]>>;
  const coreFilled = FILLED_ICONS as Readonly<Record<string, readonly string[] | undefined>>;
  const outline = core[name] ?? extra.get(name) ?? [];
  return (filled ? (coreFilled[name] ?? extraFilled.get(name)) : undefined) ?? outline;
}
