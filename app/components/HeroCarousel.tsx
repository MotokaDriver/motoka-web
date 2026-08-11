"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import telaTrabalheQuandoQuiser from "../../public/images/app/01-trabalhe-quando-quiser.png";
import telaAcheServicos from "../../public/images/app/02-ache-servicos.png";
import telaNegocieAntesDeAceitar from "../../public/images/app/03-negocie-antes-de-aceitar.png";
import telaDetalheDoServico from "../../public/images/app/04-detalhe-do-servico.png";
import telaPecaMotoboys from "../../public/images/app/05-peca-motoboys.png";
import telaMotoboysQueAceitaram from "../../public/images/app/06-motoboys-que-aceitaram.png";
import telaPixOuCartao from "../../public/images/app/07-pix-ou-cartao.png";
import telaAvisos from "../../public/images/app/08-avisos.png";

const images = [
    { src: telaTrabalheQuandoQuiser, alt: "Tela inicial com os serviços em andamento" },
    { src: telaAcheServicos, alt: "Tela de busca de serviços disponíveis" },
    { src: telaNegocieAntesDeAceitar, alt: "Tela de negociação de valores antes de aceitar" },
    { src: telaDetalheDoServico, alt: "Tela com os detalhes do serviço" },
    { src: telaPecaMotoboys, alt: "Tela de solicitação de motoboys" },
    { src: telaMotoboysQueAceitaram, alt: "Tela com os motoboys que aceitaram o serviço" },
    { src: telaPixOuCartao, alt: "Tela de pagamento por Pix ou cartão" },
    { src: telaAvisos, alt: "Tela de avisos e notificações" },
];

export default function HeroCarousel() {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveIndex((prev) => (prev + 1) % images.length);
        }, 3500);

        return () => clearInterval(interval);
    }, []);

    const getStyles = (index: number) => {
        // Calculate difference handling the wrap-around
        let diff = (index - activeIndex) % images.length;
        if (diff < 0) diff += images.length;

        // We want to show: Center (0), Right (1), Left (Last)
        // For 4 images: 0 is center, 1 is right, 2 is hidden/back, 3 is left

        if (diff === 0) {
            return "z-30 scale-100 opacity-100 translate-x-0 translate-z-0 rotate-y-0 shadow-2xl";
        } else if (diff === 1) {
            return "z-20 scale-85 opacity-60 translate-x-[60%] -translate-z-10 -rotate-y-12 blur-[1px]";
        } else if (diff === images.length - 1) {
            return "z-20 scale-85 opacity-60 -translate-x-[60%] -translate-z-10 rotate-y-12 blur-[1px]";
        } else {
            return "z-10 scale-75 opacity-0 translate-x-0 -translate-z-20";
        }
    };

    return (
        <div className="relative w-full max-w-[600px] h-[600px] flex items-center justify-center perspective-[1200px] overflow-visible mx-auto">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-purple-500/10 rounded-full blur-3xl -z-10 transform scale-150"></div>

            {images.map((img, index) => (
                <div
                    key={index}
                    className={`absolute transition-all duration-700 ease-out will-change-transform ${getStyles(index)}`}
                    style={{
                        transformStyle: 'preserve-3d',
                        width: '285px',
                        height: '600px',
                    }}
                >
                    {/* As telas já vêm com a moldura do celular e fundo transparente */}
                    <Image
                        src={img.src}
                        alt={img.alt}
                        fill
                        className="object-contain drop-shadow-2xl"
                        sizes="285px"
                        priority={index === 0}
                    />

                    {/* Shadow below phone */}
                    <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-3/4 h-4 bg-black/40 blur-xl rounded-full"></div>
                </div>
            ))}
        </div>
    );
}
