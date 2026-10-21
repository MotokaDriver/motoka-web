import type { Metadata } from "next";
import { IntegrationsScreen } from "@/features/integrations/IntegrationsScreen";

export const metadata: Metadata = { title: "Integrações" };

export default function Page() {
  return <IntegrationsScreen />;
}
