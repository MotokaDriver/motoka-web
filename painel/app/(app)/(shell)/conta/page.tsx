import type { Metadata } from "next";
import { AccountScreen } from "@/features/account/AccountScreen";

export const metadata: Metadata = { title: "Conta" };

export default function Page() {
  return <AccountScreen />;
}
