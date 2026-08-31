// Redirecionamento web -> app Motoka Driver.
//
// IMPORTANTE (estado atual): o app Flutter ainda NÃO registra nenhum deep link
// (sem intent-filter de VIEW no AndroidManifest, sem CFBundleURLTypes/Universal
// Links no iOS). Enquanto isso não existir, abrir uma tela de pedido específica
// a partir do navegador é impossível — então:
//   - Android: usamos `intent://` com o pacote do app e `browser_fallback_url`.
//     Se o app estiver instalado ele abre (na tela inicial, até o app tratar o
//     link); se não, o usuário cai direto na Play Store.
//   - iOS: tentamos o esquema `motoka://` e, por timeout, caímos para a App
//     Store. Sem o esquema registrado, o timeout sempre leva à loja.
//   - Desktop/outros: não há app; devolvemos "other" e a UI mostra as lojas.
//
// Este arquivo já monta o alvo com `order/{id}?action=...`, pronto para funcionar
// de ponta a ponta assim que o time do app registrar o deep link (ver README).

export const ANDROID_PACKAGE = "com.app.motoka_app";
export const APP_SCHEME = "motoka";
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
export const APP_STORE_URL = "https://apps.apple.com/br/app/motoka-driver/id6759629174";

export type Platform = "android" | "ios" | "other";
export type OrderAction = "accept" | "counter";

export function getPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  // iPadOS 13+ se apresenta como Mac; o toque é o desempate.
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && "ontouchend" in document)) {
    return "ios";
  }
  return "other";
}

// Caminho relativo que identifica o pedido e a ação dentro do app.
function appPath(orderId: string, action: OrderAction): string {
  return `order/${encodeURIComponent(orderId)}?action=${action}`;
}

function androidIntentUrl(orderId: string, action: OrderAction): string {
  const path = appPath(orderId, action);
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return (
    `intent://${path}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`
  );
}

function iosSchemeUrl(orderId: string, action: OrderAction): string {
  return `${APP_SCHEME}://${appPath(orderId, action)}`;
}

// Abre o app; se não estiver instalado, encaminha para a loja.
// `onFallback` é chamado no desktop (sem app), para a UI revelar as lojas.
export function openInApp(orderId: string, action: OrderAction, onFallback?: () => void): void {
  const platform = getPlatform();

  if (platform === "android") {
    window.location.href = androidIntentUrl(orderId, action);
    return;
  }

  if (platform === "ios") {
    // Se o app abrir, a aba fica oculta e cancelamos o pulo para a loja.
    let cancelled = false;
    const onHide = () => {
      if (document.hidden) cancelled = true;
    };
    document.addEventListener("visibilitychange", onHide);

    window.location.href = iosSchemeUrl(orderId, action);

    window.setTimeout(() => {
      document.removeEventListener("visibilitychange", onHide);
      if (!cancelled && !document.hidden) {
        window.location.href = APP_STORE_URL;
      }
    }, 1200);
    return;
  }

  onFallback?.();
}
