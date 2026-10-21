import type { Metadata } from "next";
import { Suspense } from "react";
import { SettlementsScreen } from "@/features/settlements/SettlementsScreen";

export const metadata: Metadata = { title: "Acertos" };

export default function Page() {
  // useSearchParams (?filtro=, ?semana=, ?motoboy=, ?acerto=) exige a fronteira de Suspense no export estatico.
  return (
    <Suspense fallback={null}>
      <SettlementsScreen />
    </Suspense>
  );
}
