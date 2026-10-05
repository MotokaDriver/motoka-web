import { CSPProvider } from "@base-ui/react/csp-provider";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

// Inter auto-hospedada (DN-10), subset latino em woff2, a partir dos TTF do design.
const inter = localFont({
  src: [
    { path: "../src/ui/fonts/Inter-Regular.woff2", weight: "400", style: "normal" },
    { path: "../src/ui/fonts/Inter-Medium.woff2", weight: "500", style: "normal" },
    { path: "../src/ui/fonts/Inter-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../src/ui/fonts/Inter-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Painel · Motoka", template: "%s · Motoka" },
  description: "Painel web do estabelecimento Motoka.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  colorScheme: "dark light",
};

/**
 * Layout raiz ÚNICO (DN-23): dá o `app/not-found.tsx` estável, exportado como `out/404.html`.
 * Sem sessão aqui; os providers ficam no layout do grupo `(app)`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // `data-theme` é trocado pelo /theme-init.js antes da hidratação.
    <html lang="pt-BR" data-theme="dark" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Síncrono de propósito: aplica o tema antes da primeira pintura, sem flash. Não pode
            ser inline por causa da CSP (`script-src 'self'`), e tem menos de 1 KB (DN-13). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body>
        {/* A Base UI não injeta <style> (CSP `style-src 'self'`); o CSS dela está em globals.css (DN-06). */}
        <CSPProvider disableStyleElements>{children}</CSPProvider>
      </body>
    </html>
  );
}
