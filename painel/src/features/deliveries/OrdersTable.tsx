"use client";

import { memo } from "react";
import { Chip } from "@/ui/Chip";
import { Icon } from "@/ui/Icon";
import { Label } from "@/ui/Label";
import { cn } from "@/ui/cn";
import { otherDayLine, trackCell, type TrackCellInfo } from "./logic";
import { STATUS, type DeliveryItem } from "./model";
import { SourceBadge } from "./SourceBadge";

const COLUMNS = "grid-cols-[120px_minmax(0,1fr)_96px_160px]";

function TrackCell({ info }: { info: TrackCellInfo }) {
  if (info.kind === "none") return null;
  const warn = info.kind === "unsent";
  return (
    <span className={cn("type-caption flex items-center gap-1 whitespace-nowrap", warn ? "text-warning" : "text-text-tertiary")}>
      <Icon name={info.kind === "platform" ? "mobile" : warn ? "schedule" : info.kind === "sent" || info.kind === "opened" ? "check" : "link"} size={13} />
      {info.text}
    </span>
  );
}

const Row = memo(function Row({
  item,
  selected,
  now,
  onSelect,
}: {
  item: DeliveryItem;
  selected: boolean;
  now: Date;
  onSelect: (id: string) => void;
}) {
  const status = STATUS[item.status];
  const other = otherDayLine(item.createdAt, now);
  const address = [item.addressLine, item.neighborhood].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Pedido ${item.number}${item.needsAttention ? ", precisa da sua atenção" : ""}, ${item.customerName ?? "cliente sem nome"}, ${status.label}`}
        onClick={() => onSelect(item.id)}
        className={cn(
          "grid w-full cursor-pointer items-center gap-3 border-b border-divider px-4 py-3 text-left",
          COLUMNS,
          selected ? "bg-primary-tint" : "hover:bg-surface-variant",
          item.status === "cancelled" && "opacity-70",
        )}
      >
        <span className="flex min-w-0 flex-col items-start gap-1">
          <span className="type-title-sm flex items-center gap-1 font-bold text-text-primary">
            {item.needsAttention && (
              <span className="text-warning" title="Precisa da sua atenção">
                <Icon name="priority_high" size={16} />
              </span>
            )}
            {`#${item.number}`}
          </span>
          <SourceBadge origin={item.origin} channel={item.channel} />
          {other && <span className="type-caption text-text-tertiary">{other}</span>}
        </span>
        <span className="min-w-0">
          <span className="type-body-md block truncate text-text-primary">{item.customerName ?? "Cliente sem nome"}</span>
          {address && <span className="type-caption block truncate text-text-tertiary">{address}</span>}
        </span>
        <span className={cn("type-body-md truncate", item.driver ? "text-text-secondary" : "text-warning")}>{item.driver?.shortName ?? "sem"}</span>
        <span className="flex flex-col items-start gap-1">
          <span className="flex flex-wrap gap-1">
            <Chip tone={status.tone}>{status.label}</Chip>
            {item.cancellation && item.status !== "cancelled" && <Chip tone="error">Cancelado</Chip>}
          </span>
          <TrackCell info={trackCell(item.status, item.tracking)} />
        </span>
      </button>
    </li>
  );
});

/** Tabela de pedidos (colunas 120 / flex / 96 / 160). Linha cancelada a 70%; selecionada em `primary` 10%. */
export function OrdersTable({
  items,
  selectedId,
  now,
  onSelect,
}: {
  items: readonly DeliveryItem[];
  selectedId: string | null;
  now: Date;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mx-5 overflow-hidden rounded-lg border border-border lg:mx-7">
      <div className={cn("grid gap-3 border-b border-border bg-surface px-4 py-2.5", COLUMNS)} aria-hidden>
        {["Pedido", "Cliente", "Motoboy", "Status"].map((h) => (
          <Label key={h}>{h}</Label>
        ))}
      </div>
      <ul aria-label="Pedidos">
        {items.map((item) => (
          <Row key={item.id} item={item} selected={item.id === selectedId} now={now} onSelect={onSelect} />
        ))}
      </ul>
    </div>
  );
}
