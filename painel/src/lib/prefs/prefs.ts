/**
 * Preferências de quem usa o painel neste navegador. É o único lugar do código que toca
 * `localStorage`/`sessionStorage` (regra de lint, DN-13), sempre com try/catch: a leitura pode
 * falhar em janela privada ou com dados do site bloqueados, e o painel funciona sem ela.
 * Nada de sessão mora aqui.
 */

export const SHORTCUTS_KEY = "motoka.panel.shortcuts";
export const THEME_KEY = "motoka.panel.theme";
const RELOAD_MARK_KEY = "motoka.panel.chunk-reload";

export type ThemePreference = "dark" | "light" | "system";

const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Fica só em memória nesta visita.
  }
}

const memory: { shortcuts?: boolean; theme?: ThemePreference } = {};

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Ligados por padrão; só um "off" explícito desliga (WCAG 2.1.4). */
export function getShortcutsEnabled(): boolean {
  if (memory.shortcuts !== undefined) return memory.shortcuts;
  return read(SHORTCUTS_KEY) !== "off";
}

export function setShortcutsEnabled(enabled: boolean): void {
  memory.shortcuts = enabled;
  write(SHORTCUTS_KEY, enabled ? "on" : "off");
  notify();
}

export function getThemePreference(): ThemePreference {
  if (memory.theme) return memory.theme;
  const stored = read(THEME_KEY);
  return stored === "light" || stored === "system" ? stored : "dark";
}

export function setThemePreference(theme: ThemePreference): void {
  memory.theme = theme;
  write(THEME_KEY, theme);
  applyTheme(theme);
  notify();
}

/** Mesma regra do `/theme-init.js`, que aplica o tema antes da primeira pintura. */
export function resolveTheme(theme: ThemePreference): "dark" | "light" {
  if (theme !== "system") return theme;
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(theme);
}

/** Marca da recarga automática depois de um deploy novo (DN-24): uma por aba, nunca em loop. */
export function takeReloadMark(): boolean {
  try {
    if (window.sessionStorage.getItem(RELOAD_MARK_KEY)) return false;
    window.sessionStorage.setItem(RELOAD_MARK_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

export function clearReloadMark(): void {
  try {
    window.sessionStorage.removeItem(RELOAD_MARK_KEY);
  } catch {
    // Sem storage não há marca.
  }
}

/** Só para testes. */
export function resetPrefsMemory(): void {
  delete memory.shortcuts;
  delete memory.theme;
}
