// URL do painel web do estabelecimento. Validada e injetada em build por next.config.ts
// (https, allowlist de host, sem credenciais). Não é segredo: é um link público.
// Abre na mesma aba (sem target="_blank"); se um dia abrir em nova aba, usar
// rel="noopener noreferrer".
export const PAINEL_URL: string = process.env.NEXT_PUBLIC_PAINEL_URL as string;
export const ENTRAR_LABEL = "Entrar na área do estabelecimento";
