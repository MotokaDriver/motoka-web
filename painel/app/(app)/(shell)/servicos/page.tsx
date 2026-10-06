import type { Metadata } from "next";
import { Suspense } from "react";
import { ServicesScreen } from "@/features/services/ServicesScreen";

export const metadata: Metadata = { title: "Contratar motoboys" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ServicesScreen />
    </Suspense>
  );
}
