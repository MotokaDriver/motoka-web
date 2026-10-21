import { catalogMessage } from "@/lib/errors/messages";

/** Textos fixos da sessão do painel (porte de `panel_messages.dart`). Nunca o `detail` da API. */
export const SessionMessages = {
  sessionExpired: "Sua sessão expirou. Entre novamente.",
  connection: "Não foi possível conectar ao Motoka. Verifique a conexão e tente novamente.",
  loadUser: "Não foi possível carregar seus dados. Tente novamente.",
  originNotAllowed: "Requisição não permitida.",
  userChanged: "Outra conta entrou neste navegador. Entre novamente.",
  notEstablishment: "O painel é só para estabelecimentos.",
  noPanelAccess: "Este perfil não tem acesso ao painel.",
  startSession: "Não foi possível iniciar sua sessão. Tente novamente.",
} as const;

/**
 * Código local (não vem da API): o cookie de refresh agora é de outra conta, porque alguém entrou
 * com outra loja em outra aba.
 */
export const USER_CHANGED_CODE = "PANEL_SESSION_USER_CHANGED";
export const REFRESH_MISSING_CODE = "AUTH_REFRESH_MISSING";

/**
 * Texto do fim de uma sessão. `AUTH_REFRESH_MISSING` no meio da sessão quer dizer que o navegador
 * perdeu o cookie (ociosidade, cookies limpos): lê-se "expirou". Só é silencioso na restauração,
 * que trata o caso antes de chegar aqui.
 */
export function rejectionMessage(code: string | null | undefined): string {
  if (!code) return SessionMessages.sessionExpired;
  if (code === USER_CHANGED_CODE) return SessionMessages.userChanged;
  return catalogMessage(code) ?? SessionMessages.sessionExpired;
}
