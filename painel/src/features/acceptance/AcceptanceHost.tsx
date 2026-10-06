"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isAvailable, useCapabilities } from "@/features/shell/capabilities";
import { Paths } from "@/lib/routing/routes";
import { Btn } from "@/ui/Btn";
import { Icon } from "@/ui/Icon";
import { useAwaitingAlerts } from "./alerts";
import { clock, secondsLeft } from "./countdown";
import { useAwaiting, useOdConnected, useTick } from "./hooks";

// Só carrega quando alguém abre o drawer: o parser e as telas de Pedidos não entram no shell de todas as telas.
const AcceptanceDrawer = dynamic(() => import("./AcceptanceDrawer"), { ssr: false });

/**
 * Aceite dos pedidos que chegam do PDV (WN-4a, WEB-2): banner no topo de toda tela logada e o drawer com as ações.
 * Polling de 5 s em `/pedidos/` e de 10 s no resto (só com integração conectada); a contagem usa o relógio do servidor.
 */
export function AcceptanceHost() {
  const pathname = usePathname();
  const capabilities = useCapabilities();
  const deliveriesOn = isAvailable(capabilities, "deliveries");
  const onOrders = pathname.startsWith(Paths.deliveries);
  const connected = useOdConnected(deliveriesOn && !onOrders);
  const query = useAwaiting(deliveriesOn && (onOrders || connected), onOrders ? 5_000 : 10_000);
  const [open, setOpen] = useState(false);
  const data = query.data;
  const items = data?.items ?? [];
  const now = useTick(items.length > 0);
  useAwaitingAlerts(items.map((item) => item.id));

  if (!data || items.length === 0) return null;
  const soonest = items
    .map((item) => secondsLeft(item.acceptDeadlineAt, data.offsetMs, now))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b)[0];

  return (
    <>
      <section aria-label="Pedidos esperando o seu aceite" className="flex flex-wrap items-center gap-3 border-b border-warning/40 bg-warning/10 px-5 py-2.5 lg:px-7">
        <span className="text-warning">
          <Icon name="notifications_active" size={20} />
        </span>
        <p role="status" className="type-body-md min-w-0 flex-1 font-semibold text-text-primary">
          {items.length === 1 ? "1 pedido esperando o seu aceite" : `${items.length} pedidos esperando o seu aceite`}
        </p>
        {soonest !== undefined && (
          <span aria-hidden className="type-label-md font-semibold tabular-nums text-warning">
            {`prazo ${clock(soonest)}`}
          </span>
        )}
        <Btn onClick={() => setOpen(true)}>Responder</Btn>
      </section>
      {open && <AcceptanceDrawer open={open} onOpenChange={setOpen} data={data} now={now} />}
    </>
  );
}
