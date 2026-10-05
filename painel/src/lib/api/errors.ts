import { errorText, type ErrorLike } from "@/lib/errors/messages";

/** Campo recusado pela API. A `message` do backend (Pydantic, em inglês) não é guardada. */
export interface FieldError {
  readonly field: string;
}

/**
 * Toda resposta não-2xx (e toda falha de rede) vira um `ApiError`. `status === null` quer dizer que
 * a requisição não teve resposta (rede, CORS, timeout). O `detail` do backend não é guardado: o
 * texto da tela sai sempre do catálogo (§5.1).
 */
export class ApiError extends Error implements ErrorLike {
  readonly status: number | null;
  readonly code: string | null;
  readonly fieldErrors: readonly FieldError[];
  /** Segundos do `Retry-After` de um 429/503, quando a API mandou. */
  readonly retryAfter: number | null;
  readonly timedOut: boolean;

  constructor(init: {
    status: number | null;
    code?: string | null;
    fieldErrors?: readonly FieldError[];
    retryAfter?: number | null;
    timedOut?: boolean;
  }) {
    super(init.code ?? (init.status === null ? "NETWORK_ERROR" : `HTTP_${init.status}`));
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code ?? null;
    this.fieldErrors = init.fieldErrors ?? [];
    this.retryAfter = init.retryAfter ?? null;
    this.timedOut = init.timedOut ?? false;
  }

  get isNetwork(): boolean {
    return this.status === null;
  }

  /** Rede, 5xx e 429 não dizem nada sobre a sessão: nunca deslogam (§5.1). */
  get isUnavailable(): boolean {
    return this.status === null || this.status === 429 || this.status >= 500;
  }

  /** Texto pt-BR para a tela. */
  text(overrides?: Readonly<Record<string, string>>): string {
    return errorText(this, overrides);
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export const ROUTE_NOT_FOUND = "ROUTE_NOT_FOUND";

/**
 * Só um 404 com `ROUTE_NOT_FOUND` quer dizer "a API em execução não tem esta rota". 405, 422 e um
 * 404 de recurso nunca contam. Consultado só nos probes de feature (badge, lembrete, capabilities),
 * porque a API também devolve `ROUTE_NOT_FOUND` para um `{id}` que não é UUID (ressalva 12).
 */
export function isRouteMissing(error: unknown): boolean {
  return isApiError(error) && error.status === 404 && error.code === ROUTE_NOT_FOUND;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Todo id vindo da URL ou do usuário passa por aqui antes de virar caminho da API. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.round((date - Date.now()) / 1000));
}

/** Lê o envelope `{error_code, detail, errors?}` sem nunca guardar o `detail`. */
export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let code: string | null = null;
  let fieldErrors: FieldError[] = [];
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      const raw = (body as Record<string, unknown>).error_code;
      if (typeof raw === "string" && /^[A-Z0-9_]+$/.test(raw)) code = raw;
      const errors = (body as Record<string, unknown>).errors;
      if (Array.isArray(errors)) {
        fieldErrors = errors.flatMap((item: unknown) => {
          if (!item || typeof item !== "object") return [];
          const field = (item as Record<string, unknown>).field;
          return typeof field === "string"
            ? [{ field }]
            : [];
        });
      }
    }
  } catch {
    // Sem envelope (proxy, 502 da Cloudflare): fica só o status.
  }
  return new ApiError({
    status: response.status,
    code,
    fieldErrors,
    retryAfter: parseRetryAfter(response.headers.get("Retry-After")),
  });
}
