import { cn } from "@/ui/cn";
import { CHANNEL_LABEL, ORIGIN_INFO, type Channel, type Origin } from "./model";

/** Origem do pedido (`SourceBadge` do design): ponto na cor da marca e rótulo; manual mostra o canal. */
export function SourceBadge({ origin, channel }: { origin: Origin; channel: Channel | null }) {
  const info = ORIGIN_INFO[origin];
  const label = origin === "manual" && channel ? CHANNEL_LABEL[channel] : info.label;
  return (
    <span
      className={cn("type-label-sm inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[2px] font-semibold text-text-secondary")}
      style={{ borderColor: `color-mix(in srgb, ${info.color} 45%, transparent)`, background: `color-mix(in srgb, ${info.color} 12%, transparent)` }}
    >
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: info.color }} />
      {label}
    </span>
  );
}
