import { Icon } from "./Icon";

/**
 * Caixa de erro do tamanho de um campo (`InlineError` do design). `role="alert"` para o leitor de
 * tela anunciar quando aparece.
 */
export function InlineError({
  message,
  onRetry,
  retryLabel = "Tentar de novo",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-error-tint-border bg-error-tint-soft p-3">
      <div className="flex items-start gap-2">
        <span className="text-error">
          <Icon name="error" size={18} />
        </span>
        <span className="type-body-sm flex-1 text-text-secondary">{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="type-body-sm min-h-6 cursor-pointer self-end rounded-sm px-1 font-semibold text-primary-text hover:underline"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
