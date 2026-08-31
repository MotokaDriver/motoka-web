import Image from "next/image";
import Link from "next/link";
import motokaLogo from "../../public/images/motoka-logo.png";

export default function Header() {
  return (
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
  );
}
