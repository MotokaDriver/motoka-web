import type { Metadata } from "next";
import Features from "./components/landing/Features";
import Hero from "./components/landing/Hero";
import Reveal from "./components/landing/Reveal";
import { Faq, FinalCta, HowItWorks, Motoboys, Together } from "./components/landing/Sections";
import SiteShell from "./components/landing/SiteShell";

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
    <SiteShell home>
      <Hero />
      <Features />
      <Motoboys />
      <HowItWorks />
      <Together />
      <Faq />
      <FinalCta />
      <Reveal />
    </SiteShell>
  );
}
