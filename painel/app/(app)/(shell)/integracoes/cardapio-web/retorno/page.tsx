import type { Metadata } from "next";
import { Suspense } from "react";
import { OauthReturn } from "@/features/integrations/OauthReturn";

export const metadata: Metadata = { title: "Conectando o Cardápio Web" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OauthReturn />
    </Suspense>
  );
}
