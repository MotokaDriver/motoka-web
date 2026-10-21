"use client";

import { useState } from "react";
import { BrowserFrame, type WebScreen } from "./Frames";
import Icon from "./Icon";
import SectionHead, { section, wrap } from "./SectionHead";
import { focusRing } from "./links";

type Feature = {
  title: string;
  screen: WebScreen;
  cap: string;
  desc: string;
  points: string[];
  alt: string;
  soon?: boolean;
};

const FEATURES: Feature[] = [
  {
    title: "Mapa ao vivo",
    screen: "aovivo",
    cap: "painel.motokadriver.com/ao-vivo",
    desc: "Veja cada motoboy no mapa durante o turno e o que falta entregar.",
    points: [
      "Posição do motoboy atualizada durante o turno",
      "Pedidos que pedem sua ação aparecem primeiro",
      "Ligue ou chame no WhatsApp direto do painel",
    ],
    alt: "Painel web com o mapa ao vivo da equipe e a lista de pedidos que pedem atenção.",
  },
  {
    title: "Equipe e escala",
    screen: "equipe",
    cap: "painel.motokadriver.com/equipe",
    desc: "Monte a semana da equipe e controle quem entra.",
    points: [
      "Escala semanal com os turnos de cada motoboy",
      "Convite por link ou QR code",
      "Você aprova ou recusa cada pedido para entrar",
    ],
    alt: "Painel web com a escala semanal da equipe e os turnos de cada motoboy.",
  },
  {
    title: "Pedidos",
    screen: "pedidos",
    cap: "painel.motokadriver.com/pedidos",
    desc: "Crie o pedido, escolha o motoboy e acompanhe até a entrega.",
    points: [
      "Endereço preenchido pelo CEP",
      "Atribuição para quem está em turno",
      "Status atualizado a cada passo do motoboy",
    ],
    alt: "Painel web com os pedidos do dia, o motoboy de cada um e o status da entrega.",
  },
  {
    title: "Contratar e negociar",
    screen: "novoServico",
    cap: "painel.motokadriver.com/servicos/novo",
    desc: "Faltou gente? Publique um período para motoboys de fora da equipe.",
    points: [
      "Valor por período e bônus por entrega",
      "O motoboy aceita ou faz contraproposta",
      "Taxa da plataforma paga no Pix ou no cartão",
    ],
    alt: "Painel web no formulário para contratar motoboys por período, com valor e forma de pagamento.",
  },
  {
    title: "Integrações com PDV",
    screen: "integracoes",
    cap: "painel.motokadriver.com/integracoes · em breve",
    soon: true,
    desc: "Em breve: os pedidos do seu sistema chegando direto no Motoka.",
    points: ["Saipos", "Cardápio Web", "Nuvemshop e Open Delivery"],
    alt: "Painel web com as integrações marcadas como em breve: Saipos, Cardápio Web, Open Delivery e Nuvemshop.",
  },
];

export default function Features() {
  const [cur, setCur] = useState(0);
  const f = FEATURES[cur];

  return (
    <section id="lojas" aria-labelledby="lojas-titulo" className={section}>
      <div className={wrap}>
        <SectionHead
          id="lojas-titulo"
          eyebrow="Para estabelecimentos · painel web"
          title="A operação de entrega da sua loja em uma tela."
          lead="Restaurante, mercado ou farmácia: o painel mostra quem está rodando, o que falta entregar e quem precisa de você agora."
        />

        <div className="grid grid-cols-1 items-start gap-12 lp-lg:grid-cols-[360px_minmax(0,1fr)]">
          <ul className="m-0 flex list-none flex-col border-t border-lp-line p-0">
            {FEATURES.map((it, i) => {
              const on = i === cur;
              return (
                <li key={it.title} className="relative border-b border-lp-line">
                  <button
                    type="button"
                    aria-expanded={on}
                    aria-controls={`recurso-${i}`}
                    onClick={() => setCur(i)}
                    className={`group grid w-full cursor-pointer grid-cols-[28px_minmax(0,1fr)] gap-3.5 border-0 bg-transparent pt-[22px] pr-1 text-left font-[inherit] text-lp-ink ${focusRing} ${on ? "pb-0" : "pb-[22px]"}`}
                  >
                    <span className={`font-mono text-xs leading-6 ${on ? "text-lp-blue-2" : "text-lp-ink-3"}`}>
                      0{i + 1}
                    </span>
                    <span>
                      <span
                        className={`flex items-center gap-2.5 text-lg font-semibold tracking-[-0.01em] transition-colors group-hover:text-lp-ink ${
                          on ? "text-lp-ink" : "text-lp-ink-2"
                        }`}
                      >
                        {it.title}
                        {it.soon && (
                          <span className="inline-flex h-[22px] items-center rounded-full border border-[rgba(212,146,42,.45)] px-2 text-[11px] font-semibold tracking-[.3px] text-[#E2A851]">
                            Em breve
                          </span>
                        )}
                      </span>
                      <span className="mt-2 block text-[15px] leading-[1.55] text-lp-ink-3 text-pretty">
                        {it.desc}
                      </span>
                    </span>
                  </button>
                  <ul
                    id={`recurso-${i}`}
                    hidden={!on}
                    className="m-0 flex list-none flex-col gap-2 pt-3.5 pr-1 pb-[22px] pl-[42px]"
                  >
                    {it.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-sm leading-[1.45] text-lp-ink-2">
                        <Icon name="check" size={17} className="mt-px text-lp-blue-2" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 -bottom-px h-px origin-left bg-lp-blue transition-transform duration-300 motion-reduce:transition-none ${
                      on ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </li>
              );
            })}
          </ul>

          <div
            className="sticky top-16 z-[5] -order-1 border-b border-lp-line bg-lp-bg pt-3 pb-2.5 lp-lg:top-24 lp-lg:order-none lp-lg:border-b-0 lp-lg:bg-transparent lp-lg:p-0"
          >
            <BrowserFrame
              key={f.screen}
              screen={f.screen}
              alt={f.alt}
              sizes="(min-width: 1081px) 760px, 100vw"
              className="lp-swap"
            />
            <p className="m-0 mt-4 hidden items-center gap-2 font-mono text-xs leading-[1.4] text-lp-ink-3 lp-lg:flex">
              <Icon name="monitor" size={16} />
              {f.cap}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
