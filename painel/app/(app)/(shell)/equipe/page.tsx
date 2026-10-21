import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamScreen } from "@/features/team/TeamScreen";

export const metadata: Metadata = { title: "Minha equipe" };

export default function Page() {
  // useSearchParams (semana na URL) exige a fronteira de Suspense no export estatico.
  return (
    <Suspense fallback={null}>
      <TeamScreen />
    </Suspense>
  );
}
