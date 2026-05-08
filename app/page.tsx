"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import step1Img from "../public/images/step1.jpg";
import step2Img from "../public/images/step2.jpg";
import step3Img from "../public/images/step3.png";
import step4Img from "../public/images/step4.png";
import step5Img from "../public/images/step5.png";
import step6Img from "../public/images/step6.png";
import step7Img from "../public/images/step7.png";
import motokaLogo from "../public/images/motoka-logo.png";
import primeLogo from "../public/images/prime.png";
import verificadaLogo from "../public/images/verificada-dark.png";
import HeroCarousel from "./components/HeroCarousel";
import { inView } from "motion";

export default function Home() {
  useEffect(() => {
    // Animate elements when they come into view
    const elements = document.querySelectorAll(".animate-on-scroll");

    elements.forEach((el) => {
      inView(el as HTMLElement, () => {
        const element = el as HTMLElement;
        element.style.transition = "opacity 0.6s ease-out, transform 0.6s ease-out";
        element.style.opacity = "1";
        element.style.transform = "translateY(0)";
      }, { amount: 0.2 });

      // Set initial state
      const element = el as HTMLElement;
      element.style.opacity = "0";
      element.style.transform = "translateY(30px)";
    });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-500 selection:text-white">''
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 transition-all duration-300">
        <div className="container mx-auto px-4 md:px-6 h-20 flex justify-between items-center">
          <div className="h-12 md:h-16 relative w-48 md:w-64">
            <Image
              src={motokaLogo}
              alt="Motoka Driver Logo"
              fill
              className="object-contain object-left"
              priority
            />
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#how-it-works" className="text-gray-600 hover:text-blue-600 font-medium transition-colors text-sm uppercase tracking-wide">
              Como Funciona
            </a>
            <a href="#download-app" className="text-gray-600 hover:text-blue-600 font-medium transition-colors text-sm uppercase tracking-wide">
              Download
            </a>
            <a
              href="#contact"
              className="bg-black text-white px-6 py-2.5 rounded-full font-medium hover:bg-gray-800 transition-all transform hover:scale-105 shadow-lg shadow-gray-200"
            >
              Contato
            </a>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32 px-4 overflow-hidden relative">
        {/* Background Blobs */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-100 rounded-full blur-3xl opacity-50"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-100 rounded-full blur-3xl opacity-50"></div>
        </div>

        <div className="container mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className="flex flex-col space-y-8 text-center lg:text-left z-10">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
              Conectando <br className="hidden lg:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Quem Precisa
              </span>{' '}
              <br className="hidden lg:block" />
              a Quem Entrega.
            </h1>

            <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-light">
              A plataforma definitiva que revoluciona a logística urbana. Conectamos motoboys qualificados e estabelecimentos em segundos.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4" id="download">
              <a
                href="#"
                className="group bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.16-.37.52-.22.81L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z" /></svg>
                <div className="text-left">
                  <div className="text-[10px] uppercase font-medium opacity-80">Disponível no</div>
                  <div className="text-sm font-bold leading-none">Google Play</div>
                </div>
              </a>

              <a
                href="#"
                className="group bg-white text-gray-900 border border-gray-200 hover:border-gray-300 px-8 py-4 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.21-.93 3.69-.93.95 0 1.74.29 2.38.74-2.05 1.22-1.71 4.58.62 5.54-.52 1.56-1.27 3.1-2.09 4.23-.59.85-1.21 1.71-1.78 1.71H17.05zM12.95 5.13c-.66-1.04-.15-2.61.98-3.13 1.01-.46 2.45.18 2.45 1.8 0 1.35-.98 2.58-2.09 2.58-.35 0-.9-.07-1.34-1.25z" /></svg>
                <div className="text-left">
                  <div className="text-[10px] uppercase font-medium opacity-60">Baixar na</div>
                  <div className="text-sm font-bold leading-none">App Store</div>
                </div>
              </a>
            </div>

            <div className="pt-8 flex items-center justify-center lg:justify-start gap-6 text-gray-500 text-sm font-medium">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                <span>Cadastro Gratuito</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                <span>Segurança Total</span>
              </div>
            </div>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <HeroCarousel />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-white relative overflow-hidden" id="how-it-works">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 animate-on-scroll">
            <h2 className="text-4xl md:text-5xl font-extrabold text-blue-900 mb-6">
              Da urgência à solução em minutos
            </h2>
            <p className="text-xl text-gray-600">
              Veja como é fácil e rápido solicitar um motoboy no Motoka Driver.
            </p>
          </div>


          {/* Winding Timeline */}
          <div className="relative max-w-5xl mx-auto">
            {/* Background dashed line */}
            <div className="absolute left-[50%] top-0 bottom-0 w-0.5 border-l-2 border-dashed border-blue-200 -translate-x-[50%] hidden lg:block z-0"></div>

            {/* Step 1 */}
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between mb-32 group animate-on-scroll">
              <div className="w-full lg:w-5/12 flex justify-center lg:justify-end mb-8 lg:mb-0 relative">
                <div className="relative w-[340px] h-[240px] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:shadow-blue-500/20">
                  <Image src={step1Img} alt="Urgência no estabelecimento" fill className="object-cover" />
                </div>
                {/* Speech Bubble */}
                <div className="absolute -right-8 -top-8 bg-white p-4 rounded-2xl shadow-xl max-w-[200px] rounded-bl-none border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl z-20">
                  <p className="text-sm font-medium text-gray-800">&quot;Poxa, meu motoboy precisou se ausentar, preciso de outro!&quot;</p>
                </div>
              </div>

              <div className="hidden lg:flex w-2/12 justify-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30 border-4 border-white z-10">1</div>
              </div>

              <div className="w-full lg:w-5/12 text-center lg:text-left">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-blue-100">
                  <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                    <div className="lg:hidden w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">1</div>
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Urgência no estabelecimento</h3>
                  </div>
                  <p className="text-gray-600 text-lg">Algo inesperado aconteceu e a entrega não pode esperar.</p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 flex flex-col lg:flex-row-reverse items-center justify-between mb-32 group animate-on-scroll">
              <div className="w-full lg:w-5/12 flex justify-center lg:justify-start mb-8 lg:mb-0 relative">
                <div className="relative w-[340px] h-[240px] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:shadow-blue-500/20">
                  <Image src={step2Img} alt="Solicitação criada" fill className="object-cover" />
                </div>
                {/* Speech Bubble */}
                <div className="absolute -left-8 -top-8 bg-white p-4 rounded-2xl shadow-xl max-w-[200px] rounded-br-none border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl z-20">
                  <p className="text-sm font-medium text-gray-800">&quot;Vou solicitar um motoboy no Motoka Driver.&quot;</p>
                </div>
              </div>

              <div className="hidden lg:flex w-2/12 justify-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30 border-4 border-white z-10">2</div>
              </div>

              <div className="w-full lg:w-5/12 text-center lg:text-left">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-blue-100">
                  <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                    <div className="lg:hidden w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">2</div>
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Solicitação criada no app</h3>
                  </div>
                  <p className="text-gray-600 text-lg">Ele informa origem, destino, período desejado e valor sugerido e envia a solicitação.</p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between mb-32 group animate-on-scroll">
              <div className="w-full lg:w-5/12 flex justify-center lg:justify-end mb-8 lg:mb-0 relative">
                <div className="relative w-[340px] h-[240px] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:shadow-blue-500/20">
                  <Image src={step3Img} alt="Motoboys próximos" fill className="object-cover" />
                </div>
                <div className="absolute -right-8 -top-8 bg-white p-4 rounded-2xl shadow-xl max-w-[200px] rounded-bl-none border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl z-20">
                  <p className="text-sm font-medium text-gray-800">&quot;Sua solicitação foi enviada para motoboys próximos.&quot;</p>
                </div>
              </div>

              <div className="hidden lg:flex w-2/12 justify-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30 border-4 border-white z-10">3</div>
              </div>

              <div className="w-full lg:w-5/12 text-center lg:text-left">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-blue-100">
                  <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                    <div className="lg:hidden w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">3</div>
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Motoboys próximos recebem</h3>
                  </div>
                  <p className="text-gray-600 text-lg">A solicitação é enviada para motoboys disponíveis na região.</p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative z-10 flex flex-col lg:flex-row-reverse items-center justify-between mb-32 group animate-on-scroll">
              <div className="w-full lg:w-5/12 flex justify-center lg:justify-start mb-8 lg:mb-0 relative">
                <div className="relative w-[340px] h-[240px] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:shadow-blue-500/20">
                  <Image src={step4Img} alt="Contraproposta" fill className="object-cover" />
                </div>
                <div className="absolute -left-12 -top-12 bg-white p-4 rounded-2xl shadow-xl max-w-[220px] rounded-br-none border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl z-20">
                  <p className="text-sm font-medium text-gray-800">&quot;Posso ficar no local por R$ 80,00 no período + R$ 5,00 por entrega ou fazer uma contraproposta.&quot;</p>
                </div>
              </div>

              <div className="hidden lg:flex w-2/12 justify-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30 border-4 border-white z-10">4</div>
              </div>

              <div className="w-full lg:w-5/12 text-center lg:text-left">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-blue-100">
                  <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                    <div className="lg:hidden w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">4</div>
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Motoboy aceita ou faz contraproposta</h3>
                  </div>
                  <p className="text-gray-600 text-lg">O motoboy pode aceitar instantaneamente ou sugerir outro valor para o período.</p>
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between mb-32 group animate-on-scroll">
              <div className="w-full lg:w-5/12 flex justify-center lg:justify-end mb-8 lg:mb-0 relative">
                <div className="relative w-[340px] h-[240px] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:shadow-blue-500/20">
                  <Image src={step2Img} alt="Negociação" fill className="object-cover" />
                </div>
                <div className="absolute -right-8 -top-8 bg-white p-4 rounded-2xl shadow-xl max-w-[200px] rounded-bl-none border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl z-20">
                  <p className="text-sm font-medium text-gray-800">&quot;Ótima proposta! Vamos confirmar.&quot;</p>
                </div>
              </div>

              <div className="hidden lg:flex w-2/12 justify-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30 border-4 border-white z-10">5</div>
              </div>

              <div className="w-full lg:w-5/12 text-center lg:text-left">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-blue-100">
                  <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                    <div className="lg:hidden w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">5</div>
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Negociação e confirmação</h3>
                  </div>
                  <p className="text-gray-600 text-lg">O estabelecimento escolhe a melhor proposta e confirma o período de trabalho.</p>
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className="relative z-10 flex flex-col lg:flex-row-reverse items-center justify-between mb-32 group animate-on-scroll">
              <div className="w-full lg:w-5/12 flex justify-center lg:justify-start mb-8 lg:mb-0 relative">
                <div className="relative w-[340px] h-[240px] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:shadow-blue-500/20">
                  <Image src={step6Img} alt="Motoboy no local" fill className="object-cover" />
                </div>
                <div className="absolute -left-8 -top-8 bg-white p-4 rounded-2xl shadow-xl max-w-[200px] rounded-br-none border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl z-20">
                  <p className="text-sm font-medium text-gray-800">&quot;Combinado! Estou no local e pronto para ajudar.&quot;</p>
                </div>
              </div>

              <div className="hidden lg:flex w-2/12 justify-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30 border-4 border-white z-10">6</div>
              </div>

              <div className="w-full lg:w-5/12 text-center lg:text-left">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-blue-100">
                  <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                    <div className="lg:hidden w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">6</div>
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Motoboy no local pelo período combinado</h3>
                  </div>
                  <p className="text-gray-600 text-lg">O motoboy fica no estabelecimento pelo tempo acordado, pronto para realizar as entregas sempre que precisar.</p>
                </div>
              </div>
            </div>

            {/* Step 7 */}
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between mb-16 group animate-on-scroll">
              <div className="w-full lg:w-5/12 flex justify-center lg:justify-end mb-8 lg:mb-0 relative">
                <div className="relative w-[340px] h-[240px] rounded-3xl overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:shadow-blue-500/20">
                  <Image src={step7Img} alt="Pagamento" fill className="object-cover" />
                </div>
                <div className="absolute -right-8 -top-8 bg-white p-4 rounded-2xl shadow-xl max-w-[200px] rounded-bl-none border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl z-20">
                  <p className="text-sm font-medium text-gray-800">&quot;Período concluído! Aqui está o pagamento. Obrigado pelo apoio!&quot;</p>
                </div>
              </div>

              <div className="hidden lg:flex w-2/12 justify-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30 border-4 border-white z-10">7</div>
              </div>

              <div className="w-full lg:w-5/12 text-center lg:text-left">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-xl hover:border-blue-100">
                  <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                    <div className="lg:hidden w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">7</div>
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">Pagamento direto ao motoboy</h3>
                  </div>
                  <p className="text-gray-600 text-lg">No final do período combinado, o estabelecimento paga o valor acordado diretamente ao motoboy.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Features Banner */}
          <div className="mt-24 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-on-scroll">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 text-blue-600 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Rápido</h4>
              <p className="text-sm text-gray-600">Encontre um motoboy disponível em minutos.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 text-blue-600 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Negocie</h4>
              <p className="text-sm text-gray-600">Escolha o melhor valor e período para você.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 text-blue-600 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Seguro</h4>
              <p className="text-sm text-gray-600">Motoboys verificados.</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 text-blue-600 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Econômico</h4>
              <p className="text-sm text-gray-600">Mais controle e menos custos para seu negócio.</p>
            </div>
          </div>


        </div>
      </section>

      {/* Download App Section */}
      <section className="py-24 bg-white" id="download-app">
        <div className="container mx-auto px-4 md:px-6 text-center animate-on-scroll">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-8">
            Pronto para começar?
          </h2>
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
            Baixe o app agora mesmo e revolucione suas entregas!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="#"
              className="group bg-gray-900 text-white px-10 py-5 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 min-w-[240px]"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.16-.37.52-.22.81L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z" /></svg>
              <div className="text-left">
                <div className="text-xs uppercase font-medium opacity-80">Disponível no</div>
                <div className="text-lg font-bold leading-none">Google Play</div>
              </div>
            </a>

            <a
              href="#"
              className="group bg-gray-900 text-white px-10 py-5 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 shadow-xl hover:shadow-2xl hover:-translate-y-1 min-w-[240px]"
            >
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.21-.93 3.69-.93.95 0 1.74.29 2.38.74-2.05 1.22-1.71 4.58.62 5.54-.52 1.56-1.27 3.1-2.09 4.23-.59.85-1.21 1.71-1.78 1.71H17.05zM12.95 5.13c-.66-1.04-.15-2.61.98-3.13 1.01-.46 2.45.18 2.45 1.8 0 1.35-.98 2.58-2.09 2.58-.35 0-.9-.07-1.34-1.25z" /></svg>
              <div className="text-left">
                <div className="text-xs uppercase font-medium opacity-80">Baixar na</div>
                <div className="text-lg font-bold leading-none">App Store</div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* WhatsApp Contact Section */}
      <section className="py-24 bg-gray-900 relative overflow-hidden" id="contact">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-600 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-600 rounded-full blur-[100px]"></div>
        </div>

        <div className="container mx-auto px-4 md:px-6 relative z-10 text-center animate-on-scroll">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Para mais informações
          </h2>
          <p className="text-lg text-gray-300 mb-10 max-w-xl mx-auto">
            Entre em contato no nosso WhatsApp. Estamos prontos para ajudar!
          </p>

          <a
            href="https://wa.me/5541997536991"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 bg-green-500 hover:bg-green-600 text-white font-bold px-10 py-5 rounded-2xl transition-all transform hover:scale-105 shadow-xl shadow-green-500/20"
          >
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" /></svg>
            <span className="text-lg">Falar no WhatsApp</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-gray-900">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-8">
            {/* Left Side: Logo & Copyright */}
            <div className="flex flex-col items-center md:items-start gap-4 md:justify-self-start">
              <div className="relative w-32 h-8 opacity-80 hover:opacity-100 transition-opacity">
                <Image
                  src={motokaLogo}
                  alt="Motoka Driver Logo"
                  fill
                  className="object-contain object-left"
                />
              </div>
              <p className="text-gray-500 text-sm">© 2025 Motoka Driver</p>
            </div>

            {/* Center: Links */}
            <div className="flex gap-8 text-sm text-gray-400 md:justify-self-center">
              <Link href="/termos-de-uso" className="hover:text-white transition-colors">Termos de Uso</Link>
              <Link href="/politica-de-privacidade" className="hover:text-white transition-colors">Privacidade</Link>
              <Link href="/excluir-conta" className="hover:text-white transition-colors">Excluir Conta</Link>
            </div>

            {/* Right Side: Startup Logos */}
            <div className="flex items-center gap-8 md:justify-self-end">
              <div className="relative w-48 h-24">
                <Image
                  src={primeLogo}
                  alt="Prime"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="relative w-48 h-24">
                <Image
                  src={verificadaLogo}
                  alt="Verificada"
                  fill
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}