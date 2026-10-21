export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.app.motoka_app";
export const APP_STORE_URL = "https://apps.apple.com/br/app/motoka-driver/id6759629174";

const LINK =
  "type-label-md inline-flex min-h-10 items-center rounded-md border border-border px-3 py-2 text-text-primary hover:bg-surface-variant";

/** Links das lojas de aplicativo (para o que só o app faz, como cadastrar um cartão novo). */
export function AppLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
        Baixar no Google Play
      </a>
      <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={LINK}>
        Baixar na App Store
      </a>
    </div>
  );
}
