import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Features from "./components/landing/Features";
import Hero from "./components/landing/Hero";
import LandingFooter from "./components/landing/LandingFooter";
import LandingNav from "./components/landing/LandingNav";
import Reveal from "./components/landing/Reveal";
import { Faq, FinalCta, HowItWorks, Motoboys, Together } from "./components/landing/Sections";

const inter = Inter({
  variable: "--font-inter-sans",
  subsets: ["latin"],
  display: "swap",
});

const TITLE = "Motoka Driver: sua equipe de entrega no mapa e no controle";
const DESCRIPTION =
  "Monte a escala, aprove quem entra na equipe e acompanhe cada entrega ao vivo pelo painel web. Motoboys pegam turnos e serviços avulsos pelo app Motoka Driver, para iPhone e Android.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://motokadriver.com/",
    siteName: "Motoka Driver",
    locale: "pt_BR",
    type: "website",
  },
};

export default function Home() {
  return (
    <div
      className={`${inter.variable} min-h-screen bg-lp-bg font-lp text-lp-ink antialiased selection:bg-lp-blue selection:text-white`}
    >
      <a
        href="#topo"
        className="sr-only z-[60] rounded-lg bg-lp-blue px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <LandingNav />
      <main id="topo" tabIndex={-1} className="outline-none">
        <Hero />
        <Features />
        <Motoboys />
        <HowItWorks />
        <Together />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
      <Reveal />
    </div>
  );
}
