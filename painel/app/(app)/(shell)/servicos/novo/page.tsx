import type { Metadata } from "next";
import { NewServiceScreen } from "@/features/services/NewServiceScreen";

export const metadata: Metadata = { title: "Solicitar serviço" };

export default function Page() {
  return <NewServiceScreen />;
}
