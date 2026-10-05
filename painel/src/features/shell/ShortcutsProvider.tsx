"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getShortcutsEnabled, setShortcutsEnabled, subscribePrefs } from "@/lib/prefs/prefs";
import { Btn } from "@/ui/Btn";
import { Dialog } from "@/ui/Dialog";
import { ShortcutRegistry, type Shortcut } from "./shortcuts";

const EMPTY: readonly Shortcut[] = [];

const RegistryContext = createContext<ShortcutRegistry | null>(null);

export function useShortcutsEnabled(): boolean {
  return useSyncExternalStore(subscribePrefs, getShortcutsEnabled, () => true);
}

/** Registra um atalho enquanto o componente estiver montado. */
export function useShortcut(key: string, description: string, action: () => void): void {
  const registry = useContext(RegistryContext);
  useEffect(() => {
    if (!registry) return;
    return registry.register({ key, description, action });
  }, [registry, key, description, action]);
}

/** Atalhos do shell: um listener só, `?` abre a ajuda, e a ajuda desliga os atalhos. */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const registry = useMemo(() => new ShortcutRegistry(), []);
  const enabled = useShortcutsEnabled();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(
    () => registry.register({ key: "?", description: "Abrir esta ajuda", action: () => setHelpOpen(true) }),
    [registry],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      registry.handle(event, enabled);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [registry, enabled]);

  return (
    <RegistryContext.Provider value={registry}>
      {children}
      <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} registry={registry} />
    </RegistryContext.Provider>
  );
}

function ShortcutsHelp({
  open,
  onOpenChange,
  registry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registry: ShortcutRegistry;
}) {
  const items = useSyncExternalStore(
    (listener) => registry.subscribe(listener),
    () => registry.list(),
    () => EMPTY,
  );
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Atalhos de teclado"
      description="Valem quando o foco não está num campo de texto."
    >
      <dl className="mt-5 flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3">
            <dt>
              <kbd className="type-label-md inline-block min-w-14 rounded-sm border border-border bg-surface-variant px-2 py-1 text-center font-bold">
                {item.key.toUpperCase()}
              </kbd>
            </dt>
            <dd className="type-body-md text-text-primary">{item.description}</dd>
          </div>
        ))}
      </dl>
      <p className="type-caption mt-5 text-text-tertiary">
        Se você usa leitor de tela ou extensão de teclado, desligue os atalhos. Dá para ligar de novo em
        Conta → Preferências.
      </p>
      <div className="mt-4">
        <Btn
          kind="secondary"
          onClick={() => {
            setShortcutsEnabled(false);
            onOpenChange(false);
          }}
        >
          Desligar atalhos
        </Btn>
      </div>
    </Dialog>
  );
}
