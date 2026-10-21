import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "./components/GoogleAnalytics";

// Inter e o tema escuro da landing valem para todas as páginas públicas (home, legais,
// excluir conta, pedido e 404). O painel é outro app (painel/) e não passa por aqui.
const inter = Inter({
  variable: "--font-inter-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Motoka Driver",
  description: "Logística de motoboys para estabelecimentos. Painel web para a loja, app para o motoboy.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <head>
        <GoogleAnalytics />
      </head>
      <body
        // Extensões de navegador (ColorZilla, Grammarly, etc.) injetam
        // atributos no <body> antes do React hidratar (ex.: cz-shortcut-listen),
        // gerando um aviso de hidratação falso. suppressHydrationWarning cobre
        // só os atributos deste elemento — não afeta os filhos.
        suppressHydrationWarning
        className="bg-lp-bg font-lp text-lp-ink antialiased"
      >
        {children}
      </body>
    </html>
  );
}
