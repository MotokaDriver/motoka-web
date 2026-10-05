"use client";

import { useSyncExternalStore } from "react";
import type { SessionState } from "@/lib/session/store";
import { getSessionStore } from "./runtime";

const SERVER_STATE: SessionState = { status: "restoring" };

/** Estado da sessão para a UI. No build (sem navegador) é sempre "restaurando". */
export function useSession(): SessionState {
  const store = typeof window === "undefined" ? null : getSessionStore();
  return useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    store ? store.getState : serverState,
    serverState,
  );
}

function noopSubscribe(): () => void {
  return () => undefined;
}

function serverState(): SessionState {
  return SERVER_STATE;
}
