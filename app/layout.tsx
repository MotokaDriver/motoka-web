import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GoogleAnalytics from "./components/GoogleAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Motoka Driver - Download App",
  description: "Baixe o aplicativo Motoka Driver para Android e iOS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <GoogleAnalytics />
      </head>
      <body
        // Extensões de navegador (ColorZilla, Grammarly, etc.) injetam
        // atributos no <body> antes do React hidratar (ex.: cz-shortcut-listen),
        // gerando um aviso de hidratação falso. suppressHydrationWarning cobre
        // só os atributos deste elemento — não afeta os filhos.
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
