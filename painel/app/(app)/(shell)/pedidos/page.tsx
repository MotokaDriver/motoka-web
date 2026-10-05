import type { Metadata } from "next";
import { Suspense } from "react";
import { DeliveriesScreen } from "@/features/deliveries/DeliveriesScreen";

export const metadata: Metadata = { title: "Pedidos" };

export default function Page() {
  // useSearchParams (?pedido= e ?filtro=) exige a fronteira de Suspense no export estatico.
  return (
    <Suspense fallback={null}>
      <DeliveriesScreen />
    </Suspense>
  );
}
