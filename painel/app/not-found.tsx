import type { Metadata } from "next";
import { Paths } from "@/lib/routing/routes";
import { EmptyState } from "@/ui/EmptyState";

export const metadata: Metadata = { title: "Página não encontrada" };

/**
 * 404 global (DN-23), exportado como `out/404.html` e servido pelo Workers com
 * `not_found_handling: "404-page"`. Estático: tokens e tema, sem sessão.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <EmptyState icon="error" title="Página não encontrada." headingLevel={1}>
        {/* <a> e não <Link>: o 404 é servido para qualquer caminho e não deve depender do roteador. */}
        <a
          href={Paths.home}
          className="type-label-lg inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-on-primary hover:bg-primary-dark"
        >
          Ir para o Mapa ao vivo
        </a>
      </EmptyState>
    </main>
  );
}
