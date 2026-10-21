/* eslint-disable @next/next/no-img-element -- ícones PNG pequenos; export estático sem otimização. */
import { BrowserFrame, PhoneFrame, type AppScreen } from "./Frames";
import Icon, { type IconName } from "./Icon";
import SectionHead, { Eyebrow, h2Class, section, wrap } from "./SectionHead";
import StoreBadges from "./StoreBadges";
import { PAINEL_URL, WHATSAPP_URL, btnPrimary, btnSecondary, focusRing } from "./links";

const h3Class = "m-0 text-[22px] font-semibold leading-[1.25] tracking-[-0.015em]";
const smallClass = "m-0 text-sm leading-normal text-lp-ink-3";

/* ---------------------------------------------------------------- Motoboys */

const PHONES: { screen: AppScreen; title: string; desc: string; alt: string }[] = [
  {
    screen: "avulsas",
    title: "Serviços avulsos",
    desc: "Períodos abertos nas lojas, com local, horário e valor.",
    alt: "Lista de serviços avulsos no app, com loja, endereço, horário e valor.",
  },
  {
    screen: "oferta",
    title: "Negocie o valor",
    desc: "Aceite como está ou envie sua contraproposta.",
    alt: "Detalhe de um serviço avulso no app, com os botões Aceitar proposta e Fazer contraproposta.",
  },
  {
    screen: "escala",
    title: "Equipes e escala",
    desc: "Seus turnos da semana em todas as lojas da sua equipe.",
    alt: "Escala da semana no app, com os turnos em cada loja.",
  },
  {
    screen: "entrega",
    title: "Entrega guiada",
    desc: "Rota no Maps ou Waze e código do cliente para concluir.",
    alt: "Entrega em andamento no app, com a rota no mapa e atalhos para Google Maps e Waze.",
  },
  {
    screen: "fimTurno",
    title: "Acerto no Pix",
    desc: "Confira o acerto do turno. A loja paga na sua chave Pix.",
    alt: "Resumo do turno encerrado no app, com entregas feitas e o acerto a receber.",
  },
];

export function Motoboys() {
  return (
    <section
      id="motoboys"
      aria-labelledby="motoboys-titulo"
      className={`${section} border-y border-[#161616] bg-lp-bg-2`}
    >
      <div className={wrap}>
        <SectionHead
          id="motoboys-titulo"
          eyebrow="Para motoboys · app"
          title="Seu trabalho organizado, do convite ao Pix."
          lead="Turnos com as lojas onde você é da equipe, avulsas para completar a semana e o acerto de cada turno conferido por você antes de a loja pagar."
        />
        <div
          role="region"
          aria-label="Telas do app do motoboy"
          tabIndex={0}
          className={`lp-noscrollbar -mx-4 overflow-x-auto px-4 pb-3 [scroll-snap-type:x_mandatory] lp-md:-mx-8 lp-md:px-8 lp-lg:mx-0 lp-lg:overflow-visible lp-lg:px-0 lp-lg:pb-0 ${focusRing}`}
        >
          <ul className="m-0 grid list-none grid-cols-[repeat(5,minmax(220px,1fr))] gap-6 p-0 lp-md:grid-cols-[repeat(5,minmax(200px,1fr))] lp-lg:grid-cols-5">
            {PHONES.map((p, i) => (
              <li key={p.screen} className="flex snap-start flex-col gap-[18px]">
                <PhoneFrame screen={p.screen} alt={p.alt} sizes="(min-width: 1081px) 211px, 240px" />
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 flex items-baseline gap-2.5 text-[17px] font-semibold tracking-[-0.01em]">
                    <span className="font-mono text-xs font-medium text-lp-blue-2">0{i + 1}</span>
                    {p.title}
                  </h3>
                  <p className="m-0 text-sm leading-normal text-lp-ink-3 text-pretty">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div
          id="baixar"
          data-reveal=""
          className="mt-[72px] flex scroll-mt-24 flex-wrap items-center justify-between gap-x-12 gap-y-6 border-t border-lp-line pt-10"
        >
          <div className="flex max-w-[520px] flex-col gap-2">
            <h3 className={h3Class}>Baixe o Motoka e crie sua conta.</h3>
            <p className={smallClass}>
              O mesmo app serve motoboys e estabelecimentos. Disponível para iPhone e Android.
            </p>
          </div>
          <StoreBadges />
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- Como funciona */

const STEPS_LOJA = [
  ["Cadastre a loja pelo app", "Baixe o Motoka, escolha estabelecimento e preencha os dados da loja."],
  ["Entre no painel web", "Acesse painel.motokadriver.com com a mesma conta."],
  ["Monte sua equipe", "Envie o link ou o QR code de convite, aprove quem pedir para entrar e monte a escala da semana."],
  ["Acompanhe e feche o acerto", "Veja as entregas ao vivo e confirme o acerto de cada motoboy no fim da semana."],
];
const STEPS_MOTO = [
  ["Baixe o app e crie sua conta", "Disponível na App Store e no Google Play."],
  ["Entre numa equipe ou pegue avulsas", "Abra o convite que a loja enviou ou procure serviços avulsos e negocie o valor."],
  ["Faça o turno", "Ative a localização, siga a fila de entregas e confirme cada uma com o código do cliente."],
  ["Receba no Pix", "Confira o acerto do turno. A loja paga na chave Pix que você cadastrou."],
];

function HowCol({ icon, title, sub, steps }: { icon: string; title: string; sub: string; steps: string[][] }) {
  return (
    <div className="flex flex-col gap-7 rounded-2xl border border-lp-line bg-[#0D0D0D] p-6 lp-md:p-9">
      <div className="flex items-center gap-3.5">
        <img
          src={icon}
          alt=""
          width={48}
          height={48}
          className="size-12 rounded-xl border border-[#1F2633] bg-[#151A24] object-contain p-1.5"
        />
        <div>
          <h3 className={h3Class}>{title}</h3>
          <p className={smallClass}>{sub}</p>
        </div>
      </div>
      <ol className="m-0 flex list-none flex-col p-0">
        {steps.map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[40px_minmax(0,1fr)] gap-4 border-t border-[#1D1D1D] py-[18px]">
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-lg border border-lp-line-2 font-mono text-[13px] font-semibold text-lp-ink-2"
            >
              0{i + 1}
            </span>
            <div>
              <p className="mt-1 mb-1 text-base font-semibold tracking-[-0.01em]">{t}</p>
              <p className="m-0 text-sm leading-[1.55] text-lp-ink-3 text-pretty">{d}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-titulo" className={section}>
      <div className={wrap}>
        <SectionHead
          id="como-titulo"
          eyebrow="Como funciona"
          title="Quatro passos de cada lado."
          lead="A loja organiza no painel. O motoboy executa no app. Os dois veem a mesma informação."
        />
        <div data-reveal="" className="grid grid-cols-1 gap-6 lp-md:grid-cols-2">
          <HowCol icon="/landing/icone-loja.png" title="Para a loja" sub="Painel web e app" steps={STEPS_LOJA} />
          <HowCol icon="/landing/icone-motoboy.png" title="Para o motoboy" sub="App Motoka" steps={STEPS_MOTO} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- Web e app juntos */

const FACTS: { icon: IconName; tag: string; title: string; desc: string }[] = [
  { icon: "receipt", tag: "painel → app", title: "Pedido na fila", desc: "O pedido atribuído no painel entra na fila de entregas do motoboy em turno." },
  { icon: "navigate", tag: "app → painel", title: "Status e posição", desc: "Retirado, a caminho, entregue: a loja vê cada mudança e onde o motoboy está." },
  { icon: "payments", tag: "nos dois lados", title: "Acerto conferido", desc: "O motoboy confere o acerto, a loja confirma e marca como pago." },
];

export function Together() {
  return (
    <section aria-labelledby="juntos-titulo" className={`${section} border-y border-[#182030] bg-lp-panel`}>
      <div className={wrap}>
        <SectionHead
          id="juntos-titulo"
          eyebrow="Web e app juntos"
          title="O pedido sai do painel e chega no celular do motoboy."
          lead="Sem ligação, sem mensagem perdida. Cada passo que o motoboy marca no app aparece no painel da loja."
        />
        <div
          data-reveal=""
          className="grid grid-cols-1 items-center gap-7 lp-md:grid-cols-[minmax(0,1fr)_72px_250px] lp-md:gap-0"
        >
          <BrowserFrame
            screen="novoPedido"
            alt="Painel web criando um novo pedido de WhatsApp, telefone ou balcão, com cliente, endereço e forma de pagamento."
            sizes="(min-width: 861px) 830px, 100vw"
          />
          <div aria-hidden="true" className="hidden items-center px-1.5 lp-md:flex">
            <span className="h-0 flex-1 border-t border-dashed border-[#3A4B70]" />
            <span className="grid size-9 place-items-center rounded-full border border-[rgba(74,111,197,.34)] bg-[#121A2A] text-lp-blue-2">
              <Icon name="sync" size={18} />
            </span>
            <span className="h-0 flex-1 border-t border-dashed border-[#3A4B70]" />
          </div>
          <PhoneFrame
            screen="turno"
            alt="App do motoboy em turno, com a fila de entregas atribuídas pela loja."
            sizes="(min-width: 861px) 250px, 58vw"
            className="mx-auto w-[58%] lp-md:w-full"
          />
        </div>
        <ul data-reveal="" className="m-0 mt-10 grid list-none grid-cols-1 border-t border-[#1E2738] p-0 lp-md:mt-16 lp-md:grid-cols-3">
          {FACTS.map((f, i) => (
            <li
              key={f.title}
              className={`flex flex-col gap-2.5 pt-[22px] lp-md:pt-7 lp-md:pr-7 ${
                i > 0
                  ? "mt-[22px] border-t border-[#1E2738] lp-md:mt-0 lp-md:border-t-0 lp-md:border-l lp-md:pl-7"
                  : ""
              }`}
            >
              <p className="m-0 flex items-center gap-2 font-mono text-xs leading-none text-lp-blue-ink">
                <Icon name={f.icon} size={16} />
                {f.tag}
              </p>
              <h3 className="m-0 text-lg font-semibold tracking-[-0.01em]">{f.title}</h3>
              <p className={smallClass}>{f.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------- FAQ */

const FAQS = [
  {
    q: "Quanto custa para a loja?",
    a: "O cadastro é gratuito. Quando você contrata motoboys avulsos, paga uma taxa da plataforma por serviço, no Pix ou no cartão de crédito, e vê o valor antes de confirmar. O valor combinado com o motoboy é pago direto a ele.",
  },
  {
    q: "Como o motoboy recebe?",
    a: "Direto da loja. Nas equipes, o acerto do turno é conferido pelo motoboy, confirmado pela loja e pago na chave Pix que ele cadastrou no app. O Motoka não retém o valor do motoboy.",
  },
  {
    q: "O pagamento é seguro?",
    a: "A taxa da plataforma é paga por Pix ou cartão de crédito, processados por gateways de pagamento parceiros. Você vê o valor da taxa antes de confirmar o serviço.",
  },
  {
    q: "Como cadastro minha loja?",
    a: "Pelo app Motoka, no iPhone ou no Android. Com a conta criada, entre no painel em painel.motokadriver.com com o mesmo acesso.",
  },
  {
    q: "Como entro na equipe de uma loja?",
    a: "Peça o link ou o QR code de convite para a loja e abra no celular com o app instalado. Você entra assim que a loja aprovar. Se a loja te convidou pelo nome, a entrada é direta.",
  },
  {
    q: "O motoboy precisa enviar documentos?",
    a: "Para serviços avulsos, o Motoka pode pedir a verificação de identidade: uma foto da CNH aberta e uma selfie, conferidas pela nossa equipe.",
  },
  {
    q: "O Motoka integra com o meu PDV?",
    a: "Ainda não. As integrações com Saipos, Cardápio Web, Nuvemshop e Open Delivery estão em preparação. Por enquanto, você cria os pedidos direto no painel.",
  },
];

export function Faq() {
  return (
    <section id="duvidas" aria-labelledby="duvidas-titulo" className={section}>
      <div className={`${wrap} grid grid-cols-1 items-start gap-7 lp-md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lp-md:gap-16`}>
        <div data-reveal="">
          <Eyebrow className="mb-5">Dúvidas</Eyebrow>
          <h2 id="duvidas-titulo" className={h2Class}>
            Perguntas frequentes.
          </h2>
          <p className="mt-5 mb-0 text-base leading-[1.6] text-lp-ink-2">
            Não achou sua resposta? Fale com a gente no{" "}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded text-lp-blue-2 underline-offset-2 hover:text-lp-blue-ink hover:underline ${focusRing}`}
            >
              WhatsApp
            </a>
            .
          </p>
        </div>
        <div className="border-t border-lp-line">
          {FAQS.map((f) => (
            <details key={f.q} className="lp-faq group border-b border-lp-line">
              <summary
                className={`flex cursor-pointer list-none items-center gap-4 rounded py-6 text-lg font-semibold tracking-[-0.01em] text-lp-ink hover:text-lp-blue-ink ${focusRing}`}
              >
                {f.q}
                <Icon
                  name="plus"
                  size={20}
                  className="ml-auto text-lp-ink-3 transition-transform duration-200 group-open:rotate-45 group-open:text-lp-blue-2 motion-reduce:transition-none"
                />
              </summary>
              <p className="m-0 pb-[26px] text-base leading-[1.65] text-lp-ink-2 text-pretty lp-md:pr-12">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- CTA final */

export function FinalCta() {
  const cardTitle = "m-0 text-[clamp(28px,3.2vw,40px)] font-bold leading-[1.05] tracking-[-0.035em] text-balance";
  return (
    <section aria-label="Comece agora" className={`${section} !pt-0`}>
      <div data-reveal="" className={`${wrap} grid grid-cols-1 gap-6 lp-md:grid-cols-2`}>
        <div className="flex flex-col gap-5 rounded-2xl border border-[#22304F] bg-[#0F1524] p-7 transition-colors duration-200 hover:border-[#34487A] lp-md:min-h-[340px] lp-md:p-10">
          <img src="/landing/icone-loja.png" alt="" width={56} height={56} className="size-14 object-contain" />
          <Eyebrow>Tenho um estabelecimento</Eyebrow>
          <h2 className={cardTitle}>Coloque sua equipe de entrega no mapa.</h2>
          <div className="mt-auto flex flex-wrap gap-3">
            <a href={PAINEL_URL} className={`${btnPrimary} group max-[420px]:flex-1`}>
              Entrar no painel
              <Icon name="arrow" className="transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transition-none" />
            </a>
            <a href="#baixar" className={`${btnSecondary} max-[420px]:flex-1`}>
              Cadastrar pelo app
            </a>
          </div>
        </div>
        <div className="flex flex-col gap-5 rounded-2xl border border-lp-line p-7 transition-colors duration-200 hover:border-[#3B3B3B] lp-md:min-h-[340px] lp-md:p-10">
          <img src="/landing/icone-motoboy.png" alt="" width={56} height={56} className="size-14 object-contain" />
          <Eyebrow>Sou motoboy</Eyebrow>
          <h2 className={cardTitle}>Baixe o app e comece pela sua primeira equipe.</h2>
          <StoreBadges className="mt-auto" />
        </div>
      </div>
    </section>
  );
}
