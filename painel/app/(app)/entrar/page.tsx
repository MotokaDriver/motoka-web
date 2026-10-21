import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/features/session/LoginScreen";
import { Spinner } from "@/ui/Spinner";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  // `useSearchParams` num export estático pede Suspense (o `?de=` só existe no navegador).
  return (
    <Suspense
      fallback={
        <main className="grid min-h-dvh place-items-center text-primary-text">
          <Spinner size={32} label="Carregando o painel" />
        </main>
      }
    >
      <LoginScreen />
    </Suspense>
  );
}
