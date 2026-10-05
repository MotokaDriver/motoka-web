import type { Metadata } from "next";
import { PlaceholderScreen } from "@/features/shell/PlaceholderScreen";
import { Paths } from "@/lib/routing/routes";

export const metadata: Metadata = { title: "Pedidos" };

export default function Page() {
  return <PlaceholderScreen path={Paths.deliveries} />;
}
