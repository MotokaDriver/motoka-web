import type { Metadata } from "next";
import { PlaceholderScreen } from "@/features/shell/PlaceholderScreen";
import { Paths } from "@/lib/routing/routes";

export const metadata: Metadata = { title: "Integrações" };

export default function Page() {
  return <PlaceholderScreen path={Paths.integrations} />;
}
