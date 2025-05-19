import Image from "next/image";
import Link from "next/link";
import motokaLogo from "../../public/images/motoka-logo.png";

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function PageLayout({ children, title }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="container mx-auto py-6 px-4 md:px-6 flex justify-between items-center">
        <Link href="/" className="h-12">
          <Image 
            src={motokaLogo} 
            alt="Motoka Driver Logo" 
            width={180} 
            height={45} 
            className="h-full w-auto"
            priority
          />
        </Link>
        <nav className="hidden md:flex space-x-6">
          <Link href="/#how-it-works" className="text-gray-800 hover:text-primary transition-colors">
            Como Funciona
          </Link>
          <Link href="/#download" className="text-gray-800 hover:text-primary transition-colors">
            Download
          </Link>
          <Link href="/#contact" className="text-gray-800 hover:text-primary transition-colors">
            Contato
          </Link>
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 md:px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">{title}</h1>
          <div className="prose prose-lg max-w-none text-gray-800">
            {children}
          </div>
        </div>
      </main>

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