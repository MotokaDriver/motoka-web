"use client";

import { DESTINATIONS } from "@/lib/routing/routes";
import { EmptyState } from "@/ui/EmptyState";
import { PageHead } from "@/ui/PageHead";
import { isAvailable, useCapabilities } from "./capabilities";

/**
 * Tela de um destino que ainda não foi feito (WN-0):
 * - feature desligada na API (`capabilities` = false): "Em breve";
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
