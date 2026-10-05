// Valores de build, validados no next.config.ts (DN-14). Públicos por natureza: nenhum segredo.
export const API_ORIGIN: string = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const API_BASE = `${API_ORIGIN}/v1`;
export const APP_ENV: string = process.env.NEXT_PUBLIC_APP_ENV ?? "dev";
