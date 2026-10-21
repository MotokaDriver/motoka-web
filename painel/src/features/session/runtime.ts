import { QueryClient } from "@tanstack/react-query";
import { createApiClient, type ApiRequest } from "@/lib/api/client";
import { queryRetry } from "@/lib/polling/polling";
import { webAuthApi } from "@/lib/session/authApi";
import { createBroadcastChannel, createWebLock } from "@/lib/session/crossTab";
import { SessionStore } from "@/lib/session/store";
import { fetchPanelUser } from "@/lib/session/user";

/**
 * Instâncias únicas por aba: a sessão, o cliente HTTP e o cache de queries. Criadas sob demanda,
 * só no navegador (o export estático renderiza no build sem `window`).
 */
let store: SessionStore | null = null;
let queryClient: QueryClient | null = null;

export function getSessionStore(): SessionStore {
  if (!store) {
    store = new SessionStore({
      api: webAuthApi,
      lock: createWebLock(),
      channel: createBroadcastChannel(),
      loadUser: fetchPanelUser,
    });
    store.onClear(() => getQueryClient().clear());
  }
  return store;
}

export function createPanelQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: queryRetry,
        refetchIntervalInBackground: false,
        staleTime: 0,
      },
      mutations: { retry: 0 },
    },
  });
}

export function getQueryClient(): QueryClient {
  if (!queryClient) queryClient = createPanelQueryClient();
  return queryClient;
}

let client: ReturnType<typeof createApiClient> | null = null;

/** `apiFetch` com a sessão desta aba. */
export function apiFetch<T>(path: string, request?: ApiRequest): Promise<T> {
  if (!client) client = createApiClient(getSessionStore());
  return client<T>(path, request);
}
