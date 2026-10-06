import { ApiError } from "@/lib/api/errors";
import { errorText } from "@/lib/errors/messages";
import { type AuthApi, SessionContractError } from "./authApi";
import { type CrossTabChannel, type CrossTabLock, SIGNED_OUT } from "./crossTab";
import { decodeAccessToken, type AccessClaims } from "./jwt";
import {
  REFRESH_MISSING_CODE,
  SessionMessages,
  USER_CHANGED_CODE,
  rejectionMessage,
} from "./messages";
import { refreshSession, type RefreshOutcome } from "./refresher";
import { ESTABLISHMENT, type PanelUser } from "./user";

export type SessionState =
  /** Boot ou "Tentar de novo": a guarda não mexe na rota e o shell mostra o carregando. */
  | { readonly status: "restoring" }
  /** "Sair" em andamento. */
  | { readonly status: "leaving" }
  | { readonly status: "authenticated"; readonly user: PanelUser; readonly sub: string }
  /**
   * Sem sessão. `message` é texto do painel, ou `null` no caso silencioso (primeira visita,
   * "Sair"). `keepReturn` diz se o login guarda a rota atual em `?de=` (expiração sim, "Sair" não).
   */
  | {
      readonly status: "anonymous";
      readonly message: string | null;
      readonly expired: boolean;
      readonly keepReturn: boolean;
    }
  /** A conta autenticou, mas não é de estabelecimento. */
  | { readonly status: "denied"; readonly message: string }
  /** Nada foi decidido (sem rede, origem mal configurada). Nada foi apagado. */
  | { readonly status: "unavailable"; readonly message: string };

export type LoginResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

export interface SessionDeps {
  readonly api: AuthApi;
  readonly lock: CrossTabLock;
  readonly channel: CrossTabChannel;
  readonly loadUser: (accessToken: string, sub: string) => Promise<PanelUser>;
}

/**
 * Dono único da sessão do painel (porte de `PanelSessionViewmodel`, DN-19).
 *
 * Toda operação (`restore`, `login`, `logout`, `expire`) abre uma geração nova, e um resultado
 * assíncrono de uma geração antiga é descartado: um restore lento nunca sobrescreve um logout ou uma
 * expiração que veio depois. O access token fica só em memória, neste objeto: nunca em
 * `localStorage`, `sessionStorage`, cookie legível ou estado do React.
 */
export class SessionStore {
  private state: SessionState = { status: "restoring" };
  private readonly listeners = new Set<() => void>();
  private readonly clearHooks = new Set<() => void>();
  private generation = 0;
  private accessToken: string | null = null;
  private claims: AccessClaims | null = null;
  private inflightRefresh: Promise<RefreshOutcome> | null = null;
  private readonly unsubscribeChannel: () => void;

  constructor(private readonly deps: SessionDeps) {
    this.unsubscribeChannel = deps.channel.subscribe((message) => {
      if (message === SIGNED_OUT) void this.onSignedOutElsewhere();
    });
  }

  // ---- leitura -------------------------------------------------------------------------------

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Limpa o que é da loja (cache de queries) quando a sessão acaba. Devolve o "remover". */
  onClear(hook: () => void): () => void {
    this.clearHooks.add(hook);
    return () => this.clearHooks.delete(hook);
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  private get signedOut(): boolean {
    return this.state.status === "anonymous" || this.state.status === "denied";
  }

  private set(next: SessionState): void {
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  // ---- operações -----------------------------------------------------------------------------

  /** F5, aba nova ou "Tentar de novo": o cookie renova a sessão direto (W2). */
  async restore(): Promise<void> {
    const generation = ++this.generation;
    this.set({ status: "restoring" });

    const outcome = await refreshSession(this.deps.api, this.deps.lock, () => this.claims?.sub ?? null);
    if (generation !== this.generation) return;

    switch (outcome.kind) {
      case "renewed":
        if (!outcome.claims) {
          this.set({ status: "unavailable", message: SessionMessages.startSession });
          return;
        }
        this.accessToken = outcome.accessToken;
        this.claims = outcome.claims;
        await this.loadUser(generation, "restore");
        return;
      case "rejected":
        this.clearLocal();
        this.set({
          status: "anonymous",
          // Sem cookie é a primeira visita normal: silêncio. Qualquer outro motivo é dito.
          message: outcome.code === REFRESH_MISSING_CODE ? null : rejectionMessage(outcome.code),
          expired: outcome.code !== REFRESH_MISSING_CODE,
          keepReturn: true,
        });
        return;
      case "unavailable":
        this.set({ status: "unavailable", message: SessionMessages.connection });
        return;
      case "misconfigured":
        this.set({ status: "unavailable", message: SessionMessages.originNotAllowed });
        return;
    }
  }

  /** W1 e, em seguida, o usuário. O erro volta como texto do catálogo para o formulário. */
  async login(username: string, password: string): Promise<LoginResult> {
    const generation = ++this.generation;
    let accessToken: string;
    try {
      ({ accessToken } = await this.deps.api.login(username, password));
    } catch (error) {
      if (generation !== this.generation) return { ok: true };
      return { ok: false, message: loginErrorText(error) };
    }
    if (generation !== this.generation) return { ok: true };

    const claims = decodeAccessToken(accessToken);
    if (!claims) return this.abandonLogin(generation, SessionMessages.startSession);

    this.accessToken = accessToken;
    this.claims = claims;
    return this.loadUser(generation, "login");
  }

  /** "Sair": revoga a família no servidor (melhor esforço, 5 s), limpa esta aba e avisa as outras. */
  async logout(): Promise<void> {
    const generation = ++this.generation;
    this.set({ status: "leaving" });
    await this.revokeOnServer();
    this.clearLocal();
    if (generation !== this.generation) return;
    this.set({ status: "anonymous", message: null, expired: false, keepReturn: false });
    this.deps.channel.publish(SIGNED_OUT);
  }

  /**
   * A API disse que a sessão acabou. O servidor já respondeu e limpou o cookie: não há W3.
   * Idempotente, e só vale com a sessão aberta: um 401 atrasado durante o "Sair" ou a restauração
   * não troca o estado que essas operações vão gravar. Uma troca de conta não avisa as outras abas, porque o cookie agora é da outra
   * conta, que continua válida na aba em que entrou.
   */
  expire(code: string | null): void {
    if (this.state.status !== "authenticated") return;
    ++this.generation;
    this.clearLocal();
    this.set({ status: "anonymous", message: rejectionMessage(code), expired: true, keepReturn: true });
    if (code !== USER_CHANGED_CODE) this.deps.channel.publish(SIGNED_OUT);
  }

  /**
   * Chamado pelo `apiFetch` num 401 de rota com Bearer. Dentro da aba é uma `Promise` só; entre
   * abas, o lock. Se o token já mudou desde a requisição que falhou, outra chamada já renovou.
   */
  async refreshForRetry(failedAccessToken: string): Promise<RefreshOutcome> {
    if (this.state.status !== "authenticated" || !this.accessToken || !this.claims) {
      // Sem sessão aberta (saindo, restaurando) não há o que renovar nem o que encerrar.
      return { kind: "unavailable" };
    }
    if (this.accessToken !== failedAccessToken) {
      return { kind: "renewed", accessToken: this.accessToken, claims: this.claims };
    }
    if (!this.inflightRefresh) {
      const generation = this.generation;
      this.inflightRefresh = refreshSession(this.deps.api, this.deps.lock, () => this.claims?.sub ?? null)
        .then((outcome) => {
          // Outra operação (logout, login novo) passou na frente: não repete com o token dela.
          if (generation !== this.generation) return { kind: "unavailable" } as const;
          if (outcome.kind === "renewed") {
            if (!outcome.claims) return { kind: "rejected", code: null } as const;
            this.accessToken = outcome.accessToken;
            this.claims = outcome.claims;
          }
          return outcome;
        })
        .finally(() => {
          this.inflightRefresh = null;
        });
    }
    return this.inflightRefresh;
  }

  dispose(): void {
    this.unsubscribeChannel();
    this.deps.channel.close();
    this.listeners.clear();
    this.clearHooks.clear();
  }

  // ---- internos ------------------------------------------------------------------------------

  private async onSignedOutElsewhere(): Promise<void> {
    // Durante o próprio "Sair" a saída já está em curso e termina no login puro, sem `?de=`.
    if (this.signedOut || this.state.status === "leaving") return;
    ++this.generation;
    this.clearLocal();
    this.set({ status: "anonymous", message: null, expired: false, keepReturn: true });
  }

  private async loadUser(generation: number, mode: "restore" | "login"): Promise<LoginResult> {
    const accessToken = this.accessToken;
    const sub = this.claims?.sub;
    if (!accessToken || !sub) return { ok: true };

    let user: PanelUser;
    try {
      user = await this.deps.loadUser(accessToken, sub);
    } catch (error) {
      if (generation !== this.generation) return { ok: true };
      const network = error instanceof ApiError && error.isNetwork;
      if (mode === "login") {
        return this.abandonLogin(
          generation,
          network ? SessionMessages.connection : SessionMessages.loadUser,
        );
      }
      if (error instanceof ApiError && error.status === 401) {
        this.clearLocal();
        this.set({
          status: "anonymous",
          message: SessionMessages.sessionExpired,
          expired: true,
          keepReturn: true,
        });
        return { ok: true };
      }
      this.set({
        status: "unavailable",
        message: network ? SessionMessages.connection : SessionMessages.loadUser,
      });
      return { ok: true };
    }
    if (generation !== this.generation) return { ok: true };
    await this.admit(generation, user);
    return { ok: true };
  }

  /**
   * Defesa em profundidade: o W1 e o W2 já recusam quem não é estabelecimento, mas um cookie que
   * passou é revogado antes de o painel dizer não.
   */
  private async admit(generation: number, user: PanelUser): Promise<void> {
    const roles = this.claims?.roles ?? [];
    if (user.type.toLowerCase() === ESTABLISHMENT && roles.includes(ESTABLISHMENT)) {
      this.set({ status: "authenticated", user, sub: user.id });
      return;
    }
    await this.revokeOnServer();
    this.clearLocal();
    if (generation !== this.generation) return;
    const isEstablishmentType = user.type.toLowerCase() === ESTABLISHMENT;
    const isDriver = ["motoboy", "driver"].includes(user.type.toLowerCase());
    this.set({
      status: "denied",
      message:
        isDriver && !isEstablishmentType ? SessionMessages.notEstablishment : SessionMessages.noPanelAccess,
    });
  }

  private async abandonLogin(generation: number, message: string): Promise<LoginResult> {
    await this.revokeOnServer();
    this.clearLocal();
    if (generation !== this.generation) return { ok: true };
    return { ok: false, message };
  }

  private async revokeOnServer(): Promise<void> {
    try {
      await this.deps.api.logout();
    } catch {
      // A limpeza local acontece de qualquer forma; o cookie também morre por ociosidade.
    }
  }

  private clearLocal(): void {
    this.accessToken = null;
    this.claims = null;
    this.inflightRefresh = null;
    // A escala e os pedidos desta loja não podem sobrar para a próxima conta (D-W5-09).
    for (const hook of this.clearHooks) {
      try {
        hook();
      } catch {
        // Um hook com falha não impede os outros.
      }
    }
  }
}

function loginErrorText(error: unknown): string {
  if (error instanceof SessionContractError) return SessionMessages.startSession;
  if (error instanceof ApiError) {
    if (error.isNetwork) return SessionMessages.connection;
    return errorText(error);
  }
  return SessionMessages.startSession;
}
