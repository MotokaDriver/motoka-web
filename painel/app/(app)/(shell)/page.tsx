"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Paths } from "@/lib/routing/routes";

/** `/` não tem tela: vai para o Mapa ao vivo (a guarda do shell cuida de quem não entrou). */
export default function HomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(Paths.home);
  }, [router]);
  return null;
}
