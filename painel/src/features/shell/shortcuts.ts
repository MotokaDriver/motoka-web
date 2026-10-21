import { isOverlayOpen } from "@/ui/overlays";

export interface Shortcut {
  /** Caractere digitado (sem diferença de maiúscula), não a tecla física: funciona no ABNT2. */
  readonly key: string;
  readonly description: string;
  readonly action: () => void;
}

/** Registro central dos atalhos de uma letra (D-W5-22, WCAG 2.1.4). */
export class ShortcutRegistry {
  private readonly shortcuts = new Map<string, Shortcut>();
  private readonly listeners = new Set<() => void>();
  private snapshot: readonly Shortcut[] = [];

  register(shortcut: Shortcut): () => void {
    const key = shortcut.key.toLowerCase();
    this.shortcuts.set(key, shortcut);
    this.notify();
    return () => {
      if (this.shortcuts.get(key) === shortcut) {
        this.shortcuts.delete(key);
        this.notify();
      }
    };
  }

  /** Lista estável entre mudanças (serve de snapshot para o `useSyncExternalStore`). */
  list(): readonly Shortcut[] {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Dispara o atalho do evento, se ele vale. Devolve se disparou. Não vale com os atalhos
   * desligados, com Ctrl/Alt/Meta, com foco num campo editável, com dialog ou drawer aberto, ou
   * numa repetição de tecla segurada.
   */
  handle(event: KeyboardEvent, enabled: boolean): boolean {
    if (!enabled || event.defaultPrevented || event.repeat) return false;
    if (event.ctrlKey || event.altKey || event.metaKey) return false;
    if (isEditable(event.target)) return false;
    if (isOverlayOpen() || hasOpenDialog()) return false;
    const shortcut = this.shortcuts.get(event.key.toLowerCase());
    if (!shortcut) return false;
    event.preventDefault();
    shortcut.action();
    return true;
  }

  private notify(): void {
    this.snapshot = [...this.shortcuts.values()];
    for (const listener of this.listeners) listener();
  }
}

export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(type);
}

/** Rede de segurança além do contador: um dialog aberto por qualquer caminho no DOM. */
function hasOpenDialog(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}
