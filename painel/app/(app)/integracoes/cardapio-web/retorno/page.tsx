import type { Metadata } from "next";
import { Suspense } from "react";
import { PartnerReturn } from "@/features/integrations/PartnerReturn";

export const metadata: Metadata = { title: "Conectando o Cardápio Web" };

// Fora da moldura do painel (sem o ShellGate): quem chega sem sessão vê a explicação, e não o login com o code solto.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <PartnerReturn type="cardapio_web" />
    </Suspense>
  );
}
