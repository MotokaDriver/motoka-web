/**
 * Quantos dialogs/drawers do painel estão abertos. Os atalhos de uma letra não disparam com algum
 * aberto (corrige o B-1 do Flutter). Todo overlay do painel passa pelos wrappers de `ui/`, que
 * mantêm este contador a partir do estado da Base UI.
 */
let openCount = 0;

export function overlayOpened(): void {
  openCount += 1;
}

export function overlayClosed(): void {
  openCount = Math.max(0, openCount - 1);
}

export function isOverlayOpen(): boolean {
  return openCount > 0;
}

/** Só para testes. */
export function resetOverlays(): void {
  openCount = 0;
}
