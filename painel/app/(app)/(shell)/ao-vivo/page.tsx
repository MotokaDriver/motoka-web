import type { Metadata } from "next";
import { LiveScreen } from "@/features/live/LiveScreen";

export const metadata: Metadata = { title: "Mapa ao vivo" };

export default function Page() {
  return <LiveScreen />;
}
