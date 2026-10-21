/**
 * Coordenação entre abas (DN-19, porte de `cross_tab_web.dart`).
 *
 * O cookie de refresh é do navegador, não da aba: duas abas renovando juntas disputariam um token
 * que gira. O lock faz cada aba renovar na sua vez, e a seguinte já manda o cookie que a primeira
 * recebeu. O canal leva uma única mensagem, `signed-out`; o token nunca trafega entre abas.
 */

export const REFRESH_LOCK_NAME = "motoka-panel-refresh";
export const CHANNEL_NAME = "motoka-panel";
export const SIGNED_OUT = "signed-out";

export interface CrossTabLock {
  run<T>(action: () => Promise<T>): Promise<T>;
}

export interface CrossTabChannel {
  /** Recebe só mensagens das **outras** abas (o BroadcastChannel não ecoa para quem publica). */
  subscribe(listener: (message: string) => void): () => void;
  publish(message: string): void;
  close(): void;
}

/** `navigator.locks` quando existe; sem ele, a ação roda direto (fica a graça de 60 s da API). */
export function createWebLock(nav: Navigator | undefined = globalThis.navigator): CrossTabLock {
  return {
    run<T>(action: () => Promise<T>): Promise<T> {
      const locks = nav?.locks;
      if (!locks || typeof locks.request !== "function") return action();
      return locks.request(REFRESH_LOCK_NAME, () => action()) as Promise<T>;
    },
  };
}

export function createBroadcastChannel(): CrossTabChannel {
  if (typeof BroadcastChannel === "undefined") return createLocalChannel();
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const listeners = new Set<(message: string) => void>();
  channel.onmessage = (event: MessageEvent<unknown>) => {
    if (typeof event.data !== "string") return;
    for (const listener of listeners) listener(event.data);
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(message) {
      channel.postMessage(message);
    },
    close() {
      listeners.clear();
      channel.close();
    },
  };
}

/** Canal que não fala com ninguém (navegador sem BroadcastChannel). */
export function createLocalChannel(): CrossTabChannel {
  return {
    subscribe: () => () => undefined,
    publish: () => undefined,
    close: () => undefined,
  };
}
