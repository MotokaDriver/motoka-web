import Image from "next/image";
import Link from "next/link";
import motokaLogo from "../public/images/motoka-logo.png";
import motokaIcon from "../public/images/motoka-icon.png";

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="container mx-auto py-6 px-4 md:px-6 flex justify-between items-center">
        <div className="h-12">
          <Image 
            src={motokaLogo} 
            alt="Motoka Driver Logo" 
            width={180} 
            height={45} 
            className="h-full w-auto"
            priority
          />
        </div>
        <nav className="hidden md:flex space-x-6">
          <a href="#how-it-works" className="text-gray-800 hover:text-primary transition-colors">Como Funciona</a>
          <a href="#download" className="text-gray-800 hover:text-primary transition-colors">Download</a>
          <a href="#contact" className="text-gray-800 hover:text-primary transition-colors">Contato</a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-12 md:py-20">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="flex flex-col space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900">
              Conectando <span className="text-primary">Motoboys</span> e <span className="text-primary">Estabelecimentos</span>
            </h1>
            <p className="text-lg text-gray-800">
              O Motoka Driver conecta motoboys com estabelecimentos que precisam de serviços de entrega. Encontre trabalhos diários ou crie serviços com o valor que deseja pagar.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-4" id="download">
              <a 
                href="#" 
                className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.16-.37.52-.22.81L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z" />
                </svg>
                Download para Android
              </a>
              <a 
                href="#" 
                className="bg-white border-2 border-primary text-primary hover:bg-primary/10 font-semibold px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.624 7.222c-.876 0-2.232-.996-3.66-.96-1.884.024-3.612 1.092-4.584 2.784-1.956 3.396-.504 8.412 1.404 11.172.936 1.344 2.04 2.856 3.504 2.808 1.404-.06 1.932-.912 3.636-.912 1.692 0 2.172.912 3.66.876 1.512-.024 2.472-1.368 3.396-2.724 1.068-1.56 1.512-3.072 1.536-3.156-.036-.012-2.94-1.128-2.976-4.476-.024-2.808 2.292-4.152 2.4-4.212-1.32-1.932-3.348-2.148-4.056-2.196-1.848-.144-3.396 1.008-4.26 1.008Z" />
                  <path d="M15.384 4.836c-1.716-2.04-4.08-1.692-4.08-1.692-.144 1.332.456 2.664 1.332 3.492.9.876 2.4 1.464 3.756 1.38 0-1.26-.588-2.544-1.008-3.18Z" />
                </svg>
                Download para iOS
              </a>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="relative w-64 h-[500px] md:w-80 md:h-[580px]">
              <div className="absolute inset-0 bg-primary/20 rounded-3xl -rotate-6"></div>
              <div className="absolute inset-0 bg-white border-2 border-primary/30 rounded-3xl shadow-lg flex items-center justify-center p-8">
                <Image 
                  src={motokaIcon} 
                  alt="Motoka Driver App Icon" 
                  width={240} 
                  height={240} 
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-gray-50" id="how-it-works">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Como Funciona</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-2xl font-semibold mb-4 text-primary flex items-center gap-3">
                <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-lg">1</span>
                Para Motoboys
              </h3>
              <ul className="space-y-3 text-gray-800">
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0 mt-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Cadastre-se no aplicativo Motoka Driver
                </li>
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0 mt-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Procure serviços disponíveis em sua região
                </li>
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0 mt-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Veja os detalhes e valores oferecidos
                </li>
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0 mt-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Aceite serviços e receba pagamentos após a conclusão
                </li>
              </ul>
            </div>
            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <h3 className="text-2xl font-semibold mb-4 text-primary flex items-center gap-3">
                <span className="bg-primary text-white rounded-full w-8 h-8 flex items-center justify-center text-lg">2</span>
                Para Estabelecimentos
              </h3>
              <ul className="space-y-3 text-gray-800">
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0 mt-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Registre seu estabelecimento no Motoka Driver
                </li>
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0 mt-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Crie serviços de entrega com suas necessidades específicas
                </li>
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0 mt-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Defina o valor que está disposto a pagar
                </li>
                <li className="flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary flex-shrink-0 mt-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Acompanhe suas entregas em tempo real e avalie o serviço
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16 bg-white" id="contact">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">Entre em Contato</h2>
          <p className="text-lg text-gray-800 mb-8 max-w-2xl mx-auto">
            Tem alguma dúvida sobre o Motoka Driver? Nossa equipe está pronta para ajudar.
          </p>
          <a 
            href="mailto:contato@motoka.com" 
            className="bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-3 rounded-lg inline-flex items-center gap-2 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            Enviar Email
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 py-8 border-t border-gray-200">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <div className="mb-4 md:mb-0">
              <Image 
                src={motokaLogo} 
                alt="Motoka Driver Logo" 
                width={120} 
                height={30} 
                className="h-8 w-auto"
              />
            </div>
            <p className="text-gray-800 text-sm">© {new Date().getFullYear()} Motoka Driver. Todos os direitos reservados.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-gray-800">
            <Link href="/termos-de-uso" className="hover:text-primary transition-colors">
              Termos de Uso
            </Link>
            <Link href="/politica-de-privacidade" className="hover:text-primary transition-colors">
              Política de Privacidade
            </Link>
            <Link href="/excluir-conta" className="hover:text-primary transition-colors">
              Excluir Conta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
