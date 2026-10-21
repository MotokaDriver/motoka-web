import { takeReloadMark } from "@/lib/prefs/prefs";

/**
 * Deploy novo com a aba aberta (DN-24): o Workers Static Assets serve só a versão atual, então um
 * `import()` de um chunk antigo falha. Estes são os formatos de erro do Turbopack/webpack e dos
 * navegadores para isso.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  if (typeof message !== "string") return false;
  return (
    /Loading (CSS )?chunk [\w-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Failed to load chunk/i.test(message)
  );
}

export type ChunkRecoveryAction = "reloaded" | "ask";

/**
 * Uma recarga automática por aba (marca em `sessionStorage`, sem loop); na segunda falha, o aviso
 * com botão. Nunca esconde um erro que não é de chunk.
 */
export function recoverFromChunkError(reload: () => void): ChunkRecoveryAction {
  if (takeReloadMark()) {
    reload();
    return "reloaded";
  }
  return "ask";
}

export const UPDATED_MESSAGE = "O painel foi atualizado. Recarregue a página.";
