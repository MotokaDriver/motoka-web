import Image from "next/image";
import Link from "next/link";
import motokaLogo from "../../public/images/motoka-logo.png";

export default function Footer() {
  return (
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
  );
}
