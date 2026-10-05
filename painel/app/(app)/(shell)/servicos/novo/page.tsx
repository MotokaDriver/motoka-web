import type { Metadata } from "next";
import { PlaceholderScreen } from "@/features/shell/PlaceholderScreen";
import { Paths } from "@/lib/routing/routes";

export const metadata: Metadata = { title: "Solicitar serviço" };

/** Sub-tela de "Contratar motoboys" (WN-7): acende o mesmo item da sidebar. */
export default function Page() {
  return (
    <PlaceholderScreen
      path={Paths.services}
      label="Solicitar serviço"
      subtitle="Peça um período avulso de motoboys"
    />
  );
}
