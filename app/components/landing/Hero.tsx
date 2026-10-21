"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Icon, { type IconName } from "./Icon";
import { BrowserFrame, PhoneFrame } from "./Frames";
import { PAINEL_URL, btnPrimary, btnSecondary, focusRing } from "./links";
import { wrap } from "./SectionHead";
import StoreBadges from "./StoreBadges";

type Audience = "loja" | "moto";

const TABS: { id: Audience; label: string; icon: IconName }[] = [
  { id: "loja", label: "Sou estabelecimento", icon: "store" },
  { id: "moto", label: "Sou motoboy", icon: "bike" },
];

const h1Class =
  "m-0 text-[clamp(40px,5.6vw,72px)] font-bold leading-[1.02] tracking-[-0.045em] text-balance";
const leadClass =
  "m-0 max-w-[560px] text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-lp-ink-2 text-pretty";

function Note({ children }: { children: string }) {
  return (
    <p className="m-0 flex items-start gap-2 text-sm leading-normal text-lp-ink-3">
      <Icon name="info" size={18} className="mt-px" />
      {children}
    </p>
  );
}

export default function Hero() {
  const [aud, setAud] = useState<Audience>("loja");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const isLoja = aud === "loja";

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setAud(TABS[next].id);
    refs.current[next]?.focus();
  }

  return (
    <section aria-label="Apresentação" className="overflow-hidden pt-[104px] lp-md:pt-[136px]">
      <div className={wrap}>
        <div
          role="tablist"
          aria-label="Escolha seu perfil"
          className="flex w-full gap-1 rounded-[10px] border border-lp-line bg-[#0F0F0F] p-1 min-[421px]:inline-flex min-[421px]:w-auto"
        >
          {TABS.map((t, i) => {
            const on = t.id === aud;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`aba-${t.id}`}
                aria-selected={on}
                aria-controls="painel-perfil"
                tabIndex={on ? 0 : -1}
                onClick={() => setAud(t.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={`inline-flex h-[38px] flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[7px] border px-2 text-[13px] font-semibold transition-colors duration-200 min-[421px]:flex-none min-[421px]:px-4 min-[421px]:text-sm ${focusRing} ${
                  on
                    ? "border-[rgba(74,111,197,.34)] bg-[rgba(74,111,197,.10)] text-lp-blue-ink"
                    : "border-transparent bg-transparent text-lp-ink-2 hover:text-lp-ink"
                }`}
              >
                <Icon name={t.icon} className="hidden min-[421px]:block" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div id="painel-perfil" role="tabpanel" aria-labelledby={`aba-${aud}`}>
        <div className={wrap}>
          <div
            key={aud}
            className="lp-swap mt-9 grid grid-cols-1 items-end gap-7 lp-md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lp-md:gap-14"
          >
            {isLoja ? (
              <>
                <h1 className={h1Class}>
                  Sua equipe de entrega no mapa e <span className="text-lp-blue-2">no controle.</span>
                </h1>
                <div className="flex flex-col gap-7 pb-2">
                  <p className={leadClass}>
                    Monte a escala, aprove quem entra na equipe e acompanhe cada entrega ao vivo pelo
                    painel web. Faltou gente, contrate motoboys por período e negocie o valor.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a href={PAINEL_URL} className={`${btnPrimary} group max-[420px]:flex-1`}>
                      Entrar no painel
                      <Icon name="arrow" className="transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transition-none" />
                    </a>
                    <a href="#baixar" className={`${btnSecondary} max-[420px]:flex-1`}>
                      Cadastrar minha loja
                    </a>
                  </div>
                  <Note>
                    O cadastro da loja é feito pelo app Motoka. Depois, você opera tudo pelo painel no
                    computador.
                  </Note>
                </div>
              </>
            ) : (
              <>
                <h1 className={h1Class}>
                  Escala fixa nas lojas e avulsas <span className="text-lp-blue-2">quando você quiser.</span>
                </h1>
                <div className="flex flex-col gap-7 pb-2">
                  <p className={leadClass}>
                    Entre na equipe das lojas pelo convite, veja seus turnos da semana e pegue serviços
                    avulsos. Não gostou do valor, faça sua contraproposta.
                  </p>
                  <StoreBadges />
                  <Note>O app é gratuito para baixar. O acerto do seu turno é pago pela loja no seu Pix.</Note>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-[72px] border-t border-[#1A1A1A] bg-[linear-gradient(#0C0F15,#0C0F15)] bg-[length:100%_72%] bg-top bg-no-repeat">
          <div className={wrap}>
            {isLoja ? (
              <div key="loja" className="lp-swap relative pt-8 lp-md:pt-14">
                <BrowserFrame
                  screen="aovivo"
                  priority
                  alt="Painel web do Motoka com o mapa ao vivo: motoboys da equipe no mapa, pedidos que pedem atenção e o status de cada entrega."
                  sizes="(min-width: 861px) min(84vw, 968px), 165vw"
                  className="w-[165%] lp-md:w-[84%]"
                />
                <PhoneFrame
                  screen="entrega"
                  priority
                  ring
                  alt="App do motoboy com uma entrega em andamento: rota no mapa, dados do cliente e botões para Google Maps e Waze."
                  sizes="(min-width: 861px) min(22.5vw, 260px), 40vw"
                  className="absolute right-0 bottom-[-28px] w-[40%] lp-md:right-[2%] lp-md:bottom-[-48px] lp-md:w-[22.5%]"
                />
              </div>
            ) : (
              <div
                key="moto"
                className="lp-swap ml-[-18%] grid w-[136%] grid-cols-[minmax(0,.85fr)_minmax(0,1.2fr)_minmax(0,.85fr)] items-start gap-[3%] pt-8 lp-md:mx-auto lp-md:w-auto lp-md:max-w-[900px] lp-md:grid-cols-3 lp-md:gap-[4%] lp-md:pt-14"
              >
                <PhoneFrame
                  screen="avulsas"
                  priority
                  alt="App do motoboy na lista de serviços avulsos, com local, horário e valor de cada período."
                  sizes="(min-width: 861px) 280px, 33vw"
                  className="mt-[14%]"
                />
                <PhoneFrame
                  screen="inicio"
                  priority
                  alt="Tela inicial do app do motoboy com o próximo turno, o resumo da semana e as equipes."
                  sizes="(min-width: 861px) 280px, 45vw"
                />
                <PhoneFrame
                  screen="escala"
                  priority
                  alt="Escala da semana no app do motoboy, com os turnos em cada loja."
                  sizes="(min-width: 861px) 280px, 33vw"
                  className="mt-[14%]"
                />
              </div>
            )}
            <p className="m-0 flex flex-col gap-1.5 pt-16 font-mono text-xs leading-[1.4] tracking-[.02em] text-lp-ink-3 lp-md:flex-row lp-md:justify-between lp-md:gap-4 lp-md:pt-[88px]">
              <span>
                {isLoja
                  ? "Painel web · mapa ao vivo  +  app do motoboy · entrega"
                  : "App do motoboy · avulsas, início e escala"}
              </span>
              <span>Telas reais do produto · dados de exemplo</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
