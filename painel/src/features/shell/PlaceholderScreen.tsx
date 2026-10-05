"use client";

import { DESTINATIONS } from "@/lib/routing/routes";
import { EmptyState } from "@/ui/EmptyState";
import { PageHead } from "@/ui/PageHead";
import { isAvailable, useCapabilities } from "./capabilities";

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.app.motoka_app";
export const APP_STORE_URL = "https://apps.apple.com/br/app/motoka-driver/id6759629174";

/**
 * Tela de um destino que ainda não foi feito (WN-0):
 * - feature desligada na API (`capabilities` = false): "Em breve";
 * - tela que hoje só existe no app (WN-7): "Por enquanto, use o app Motoka para isso.";
 * - o resto: "Em construção".
 */
export function PlaceholderScreen({ path, label: labelOverride, subtitle: subtitleOverride }: { path: string; label?: string; subtitle?: string }) {
  const destination = DESTINATIONS.find((d) => d.path === path);
  const capabilities = useCapabilities();
  const label = labelOverride ?? destination?.label ?? "Painel";
  const subtitle = subtitleOverride ?? destination?.subtitle;
  const icon = destination?.icon ?? "construction";

  let body;
  if (destination && !isAvailable(capabilities, destination.capability)) {
    body = <EmptyState icon={icon} title="Em breve" description={subtitle} />;
  } else if (destination?.appOnly) {
    body = (
      <EmptyState icon="storefront" title="Por enquanto, use o app Motoka para isso.">
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="type-label-lg inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2.5 text-text-primary hover:bg-surface-variant"
          >
            Baixar no Google Play
          </a>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="type-label-lg inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2.5 text-text-primary hover:bg-surface-variant"
          >
            Baixar na App Store
          </a>
        </div>
      </EmptyState>
    );
  } else {
    body = (
      <EmptyState
        icon="construction"
        title="Em construção"
        description="Esta área do painel ainda está sendo preparada."
      />
    );
  }

  return (
    <>
      <PageHead title={label} sub={subtitle} />
      <div className="flex flex-1 items-center justify-center py-16">{body}</div>
    </>
  );
}
