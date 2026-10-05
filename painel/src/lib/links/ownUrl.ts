import { APP_ENV } from "@/lib/env";
import { trustedUrl } from "./links";

/**
 * Link que a API devolve e que o painel mostra, copia ou codifica (convite, rastreio do cliente): só
 * vale se for https (ou http://localhost fora de prod) e do host do próprio painel, que serve `/convite/`
 * e `/r/` (§6.2). Inválido vira `""`, e a tela mostra que o link não está disponível.
 */
export function checkedOwnUrl(url: string): string {
  return trustedUrl(url, window.location.host, { allowLocalhost: APP_ENV !== "prod" }) ?? "";
}
