import { API_ERROR_MESSAGES } from "./catalog";

/** Sem resposta da API (rede, CORS, timeout). */
export const NETWORK_MESSAGE =
  "Não foi possível conectar ao Motoka. Verifique a conexão e tente novamente.";

/** Resposta recebida que o painel não conseguiu ler. */
export const UNKNOWN_MESSAGE = "Ocorreu um erro, tente novamente mais tarde.";

/**
 * Texto por faixa de status, para `error_code` desconhecido ou resposta sem envelope.
 * Igual a `apiErrorMessageForStatus` do app.
 */
export function messageForStatus(status: number | null | undefined): string {
  switch (status) {
    case 400:
    case 409:
    case 422:
      return "Não foi possível concluir a operação. Confira sua conexão e os dados enviados, e tente novamente.";
    case 401:
      return "Sua sessão expirou. Entre novamente.";
    case 403:
      return "Você não tem permissão para realizar esta ação.";
    case 404:
      return "Não encontramos o que você procura.";
    case 413:
      return "O envio ficou grande demais. Tente novamente com arquivos menores.";
    case 415:
      return "Formato de arquivo não aceito.";
    case 429:
      return "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.";
    case 502:
      return "Não foi possível falar com o servidor agora. Tente novamente em instantes.";
    default:
      return UNKNOWN_MESSAGE;
  }
}

/** Texto do catálogo para um `error_code`, ou `undefined` se o código for desconhecido. */
export function catalogMessage(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return Object.prototype.hasOwnProperty.call(API_ERROR_MESSAGES, code)
    ? API_ERROR_MESSAGES[code]
    : undefined;
}

export interface ErrorLike {
  readonly status: number | null;
  readonly code: string | null;
}

/**
 * Texto de um erro numa tela do painel: o override da tela (constante do código, nunca dado da
 * API), o texto do catálogo pelo `error_code`, ou o fallback por status. Nunca o `detail`.
 */
export function errorText(
  error: ErrorLike,
  overrides: Readonly<Record<string, string>> = {},
): string {
  if (error.status === null) return NETWORK_MESSAGE;
  if (error.code && Object.prototype.hasOwnProperty.call(overrides, error.code)) {
    return overrides[error.code] as string;
  }
  return catalogMessage(error.code) ?? messageForStatus(error.status);
}
