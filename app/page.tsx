"use client";

import Image from "next/image";
import Link from "next/link";
import motokaLogo from "../public/images/motoka-logo.png";
import motokaIcon from "../public/images/motoka-icon.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="container mx-auto py-6 px-4 md:px-6 flex justify-between items-center relative z-10">
        <div className="h-16">
          <Image 
            src={motokaLogo} 
            alt="Motoka Driver Logo" 
            width={240} 
            height={60} 
            className="h-full w-auto"
            priority
          />
        </div>
        <nav className="hidden md:flex space-x-8">
          <a href="#how-it-works" className="text-gray-700 hover:text-black transition-all duration-300 font-medium relative group">
            Como Funciona
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-black transition-all duration-300 group-hover:w-full"></span>
          </a>
          <a href="#download" className="text-gray-700 hover:text-black transition-all duration-300 font-medium relative group">
            Download
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-black transition-all duration-300 group-hover:w-full"></span>
          </a>
          <a href="#contact" className="text-gray-700 hover:text-black transition-all duration-300 font-medium relative group">
            Contato
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-black transition-all duration-300 group-hover:w-full"></span>
          </a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-8 md:py-20 relative">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
          <div className="flex flex-col space-y-6 md:space-y-8 text-center md:text-left">
            <div className="space-y-4 md:space-y-6">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-black leading-tight">
                Conectando{' '}
                <span className="text-gray-600">
                  Motoboys
                </span>{' '}
                e{' '}
                <span className="text-gray-800">
                  Estabelecimentos
                </span>
            </h1>
              <p className="text-lg md:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto md:mx-0">
                A plataforma que revoluciona a entrega urbana. Conectamos motoboys qualificados com estabelecimentos que precisam de serviços de entrega confiáveis e eficientes.
            </p>
            </div>
            
            <div className="pt-4 flex flex-col sm:flex-row gap-3 md:gap-4 w-full max-w-md mx-auto md:mx-0" id="download">
              <a 
                href="#" 
                className="group bg-black hover:bg-gray-800 text-white font-semibold px-6 py-3 md:px-8 md:py-4 rounded-2xl flex items-center justify-center gap-2 md:gap-3 transition-all duration-300 transform hover:scale-105 shadow-lg text-sm md:text-base"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.16-.37.52-.22.81L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z" />
                </svg>
                <span className="hidden sm:inline">Download para Android</span>
                <span className="sm:hidden">Android</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
              <a 
                href="#" 
                className="group bg-white border-2 border-gray-300 hover:border-black text-gray-700 hover:text-black font-semibold px-6 py-3 md:px-8 md:py-4 rounded-2xl flex items-center justify-center gap-2 md:gap-3 transition-all duration-300 transform hover:scale-105 shadow-lg text-sm md:text-base"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.624 7.222c-.876 0-2.232-.996-3.66-.96-1.884.024-3.612 1.092-4.584 2.784-1.956 3.396-.504 8.412 1.404 11.172.936 1.344 2.04 2.856 3.504 2.808 1.404-.06 1.932-.912 3.636-.912 1.692 0 2.172.912 3.66.876 1.512-.024 2.472-1.368 3.396-2.724 1.068-1.56 1.512-3.072 1.536-3.156-.036-.012-2.94-1.128-2.976-4.476-.024-2.808 2.292-4.152 2.4-4.212-1.32-1.932-3.348-2.148-4.056-2.196-1.848-.144-3.396 1.008-4.26 1.008Z" />
                  <path d="M15.384 4.836c-1.716-2.04-4.08-1.692-4.08-1.692-.144 1.332.456 2.664 1.332 3.492.9.876 2.4 1.464 3.756 1.38 0-1.26-.588-2.544-1.008-3.18Z" />
                </svg>
                <span className="hidden sm:inline">Download para iOS</span>
                <span className="sm:hidden">iOS</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-4 md:w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
          
          <div className="flex justify-center order-first md:order-last">
            <div className="relative w-64 h-[500px] sm:w-72 sm:h-[600px] md:w-96 md:h-[680px]">
              {/* Clean Container */}
              <div className="absolute inset-0 bg-gray-100 rounded-2xl md:rounded-3xl -rotate-3 md:-rotate-6"></div>
              <div className="absolute inset-0 bg-white border-2 border-gray-200 rounded-2xl md:rounded-3xl shadow-2xl flex items-center justify-center p-4 md:p-8 transform rotate-2 md:rotate-3 hover:rotate-0 transition-transform duration-500">
                <Image 
                  src={motokaIcon} 
                  alt="Motoka Driver App Icon" 
                  width={200} 
                  height={200} 
                  className="w-full h-auto sm:w-auto sm:h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 md:py-20 bg-gray-50" id="how-it-works">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-black mb-4 md:mb-6">
              Como <span className="text-gray-600">Funciona</span>
            </h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4">
              Descubra como nossa plataforma conecta motoboys e estabelecimentos de forma simples e eficiente
            </p>
          </div>
          
          {/* Toggle Buttons */}
          <div className="flex justify-center mb-12 md:mb-16 px-4">
            <div className="bg-white p-1 md:p-2 rounded-xl md:rounded-2xl shadow-lg border border-gray-200 inline-flex w-full max-w-md">
              <button 
                id="motoboy-btn"
                className="px-4 py-3 md:px-8 md:py-4 rounded-lg md:rounded-xl font-semibold transition-all duration-300 bg-black text-white text-sm md:text-base flex-1"
                onClick={() => {
                  const motoboyBtn = document.getElementById('motoboy-btn');
                  const establishmentBtn = document.getElementById('establishment-btn');
                  const motoboySteps = document.getElementById('motoboy-steps');
                  const establishmentSteps = document.getElementById('establishment-steps');
                  
                  if (motoboyBtn && establishmentBtn && motoboySteps && establishmentSteps) {
                    motoboyBtn.classList.add('bg-black', 'text-white');
                    motoboyBtn.classList.remove('text-gray-600', 'hover:text-black', 'bg-white');
                    establishmentBtn.classList.remove('bg-black', 'text-white');
                    establishmentBtn.classList.add('text-gray-600', 'hover:text-black', 'bg-white');
                    motoboySteps.classList.remove('hidden');
                    establishmentSteps.classList.add('hidden');
                  }
                }}
              >
                Para Motoboys
              </button>
              <button 
                id="establishment-btn"
                className="px-4 py-3 md:px-8 md:py-4 rounded-lg md:rounded-xl font-semibold transition-all duration-300 text-gray-600 hover:text-black bg-white text-sm md:text-base flex-1"
                onClick={() => {
                  const motoboyBtn = document.getElementById('motoboy-btn');
                  const establishmentBtn = document.getElementById('establishment-btn');
                  const motoboySteps = document.getElementById('motoboy-steps');
                  const establishmentSteps = document.getElementById('establishment-steps');
                  
                  if (motoboyBtn && establishmentBtn && motoboySteps && establishmentSteps) {
                    establishmentBtn.classList.add('bg-black', 'text-white');
                    establishmentBtn.classList.remove('text-gray-600', 'hover:text-black', 'bg-white');
                    motoboyBtn.classList.remove('bg-black', 'text-white');
                    motoboyBtn.classList.add('text-gray-600', 'hover:text-black', 'bg-white');
                    establishmentSteps.classList.remove('hidden');
                    motoboySteps.classList.add('hidden');
                  }
                }}
              >
                Para Estabelecimentos
              </button>
            </div>
          </div>

          {/* Motoboy Steps */}
          <div id="motoboy-steps" className="max-w-5xl mx-auto px-4">
            <div className="bg-white p-6 md:p-10 rounded-2xl md:rounded-3xl shadow-lg border border-gray-200">
              <h3 className="text-2xl md:text-3xl font-bold mb-8 md:mb-12 text-center flex flex-col md:flex-row items-center justify-center gap-3 md:gap-4">
                <div className="p-2 md:p-3 bg-black rounded-xl md:rounded-2xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-8 md:w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <span className="text-black">
                  Passo a Passo para Motoboys
                </span>
              </h3>
              
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">1</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Baixe o aplicativo Motoka Driver</h4>
                    <p className="text-gray-600 text-lg">Disponível para Android e iOS</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">2</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Crie sua conta</h4>
                    <p className="text-gray-600 text-lg">Forneça seus dados pessoais e documentos necessários</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">3</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Complete seu perfil</h4>
                    <p className="text-gray-600 text-lg">Adicione foto, CNH e informações da sua moto</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">4</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Ative sua disponibilidade</h4>
                    <p className="text-gray-600 text-lg">Defina seus horários e áreas de atuação</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">5</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Realize as entregas</h4>
                    <p className="text-gray-600 text-lg">Siga as instruções do aplicativo e confirme cada etapa</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">6</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Receba seus pagamentos</h4>
                    <p className="text-gray-600 text-lg">Os valores são recebidos diretamente pelo estabelecimento ao final do serviço</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Establishment Steps */}
          <div id="establishment-steps" className="max-w-5xl mx-auto hidden">
            <div className="bg-white p-10 rounded-3xl shadow-lg border border-gray-200">
              <h3 className="text-3xl font-bold mb-12 text-center flex items-center justify-center gap-4">
                <div className="p-3 bg-black rounded-2xl">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <span className="text-black">
                  Passo a Passo para Estabelecimentos
                </span>
              </h3>
              
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">1</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Baixe o aplicativo Motoka Driver</h4>
                    <p className="text-gray-600 text-lg">Disponível para Android e iOS</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">2</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Crie sua conta</h4>
                    <p className="text-gray-600 text-lg">Forneça os dados do seu estabelecimento e documentos</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">3</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Configure seu perfil</h4>
                    <p className="text-gray-600 text-lg">Adicione logo, horário de funcionamento e área de entrega</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">4</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Crie um serviço de entrega</h4>
                    <p className="text-gray-600 text-lg">Defina origem, destino e valor do serviço</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">5</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Aguarde um motoboy</h4>
                    <p className="text-gray-600 text-lg">O sistema notifica motoboys próximos automaticamente</p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="group flex items-start gap-6 p-6 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all duration-300 border border-gray-200">
                  <div className="flex-shrink-0">
                    <div className="bg-black text-white rounded-2xl w-12 h-12 flex items-center justify-center text-lg font-bold shadow-lg group-hover:scale-110 transition-transform duration-300">6</div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-black mb-3 group-hover:text-gray-600 transition-colors duration-300">Avalie o serviço</h4>
                    <p className="text-gray-600 text-lg">Forneça feedback sobre a qualidade da entrega</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12 md:py-20 bg-black" id="contact">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6 text-white">
            Entre em <span className="text-gray-400">Contato</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-300 mb-8 md:mb-12 max-w-3xl mx-auto px-4">
            Tem alguma dúvida sobre o Motoka Driver? Nossa equipe está pronta para ajudar você a revolucionar suas entregas.
          </p>
          <a 
            href="https://wa.me/5541997536991" 
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-4 md:px-10 md:py-5 rounded-2xl inline-flex items-center gap-3 md:gap-4 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl shadow-xl text-base md:text-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
            </svg>
            Falar no WhatsApp
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-gray-800">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <div className="mb-6 md:mb-0">
              <Image 
                src={motokaLogo} 
                alt="Motoka Driver Logo" 
                width={120} 
                height={30} 
                className="h-8 w-auto"
              />
            </div>
            <p className="text-gray-400 text-sm">© {new Date().getFullYear()} Motoka Driver. Todos os direitos reservados.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-gray-400">
            <Link href="/termos-de-uso" className="hover:text-white transition-colors">
              Termos de Uso
            </Link>
            <Link href="/politica-de-privacidade" className="hover:text-white transition-colors">
              Política de Privacidade
            </Link>
            <Link href="/excluir-conta" className="hover:text-white transition-colors">
              Excluir Conta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}