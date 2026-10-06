import type { Metadata } from "next";
import { NoticesScreen } from "@/features/notices/NoticesScreen";

export const metadata: Metadata = { title: "Avisos" };

export default function Page() {
  return <NoticesScreen />;
}
