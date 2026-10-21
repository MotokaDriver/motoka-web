/* eslint-disable @next/next/no-img-element -- export estático com imagens sem otimização: o
   <img> com srcSet/sizes escolhe a resolução certa, o que o next/image unoptimized não faz. */

// Telas do produto exportadas do design (dados de exemplo) em public/landing/telas.
// Web: 1280 e 2560 de largura. App: 390 e 780.
export type WebScreen = "aovivo" | "equipe" | "pedidos" | "novoServico" | "integracoes" | "novoPedido";
export type AppScreen = "entrega" | "avulsas" | "inicio" | "escala" | "oferta" | "fimTurno" | "turno";

const WEB_PATH: Record<WebScreen, string> = {
  aovivo: "ao-vivo",
  equipe: "equipe",
  pedidos: "pedidos",
  novoServico: "servicos/novo",
  integracoes: "integracoes",
  novoPedido: "pedidos",
};

type Loading = { priority?: boolean };

function loadingProps({ priority }: Loading) {
  return priority
    ? ({ loading: "eager", fetchPriority: "high" } as const)
    : ({ loading: "lazy", decoding: "async" } as const);
}

// As medidas da moldura estão em cqw (largura do wrapper @container), então a moldura escala junto
// com a tela: no design a tela web tem 1280 de largura e a do celular 410 (com a borda).

/** Moldura de navegador em CSS. */
export function BrowserFrame({
  screen,
  alt,
  sizes,
  priority,
  className = "",
}: { screen: WebScreen; alt: string; sizes: string; className?: string } & Loading) {
  const base = `/landing/telas/web-${screen}`;
  return (
    <div className={`@container ${className}`}>
      <div className="overflow-hidden rounded-[1.1cqw] border border-white/12 bg-[#15181E]">
        <div
          aria-hidden="true"
          className="flex h-[3.125cqw] items-center gap-[0.625cqw] border-b border-white/6 px-[1.25cqw]"
        >
          <span className="size-[0.86cqw] rounded-full bg-[#3A3F47]" />
          <span className="size-[0.86cqw] rounded-full bg-[#3A3F47]" />
          <span className="size-[0.86cqw] rounded-full bg-[#3A3F47]" />
          <span className="ml-[1.4cqw] flex h-[2cqw] max-w-[36cqw] flex-1 items-center rounded-[0.55cqw] bg-white/6 px-[0.94cqw] text-[1.02cqw] text-[#A1A1A1]">
            painel.motokadriver.com/{WEB_PATH[screen]}
          </span>
        </div>
        <img
          src={`${base}-1280.webp`}
          srcSet={`${base}-1280.webp 1280w, ${base}-2560.webp 2560w`}
          sizes={sizes}
          width={1280}
          height={799}
          alt={alt}
          className="block h-auto w-full"
          {...loadingProps({ priority })}
        />
      </div>
    </div>
  );
}

/** Moldura de celular em CSS. */
export function PhoneFrame({
  screen,
  alt,
  sizes,
  priority,
  ring,
  className = "",
}: { screen: AppScreen; alt: string; sizes: string; ring?: boolean; className?: string } & Loading) {
  const base = `/landing/telas/app-${screen}`;
  return (
    <div className={`@container ${className}`}>
      <div
        className={`rounded-[11.7cqw] border border-white/14 bg-[#1B1F26] p-[2.44cqw] ${
          ring ? "shadow-[0_0_0_3.4cqw_#0C0F15]" : ""
        }`}
      >
        <img
          src={`${base}-390.webp`}
          srcSet={`${base}-390.webp 390w, ${base}-780.webp 780w`}
          sizes={sizes}
          width={390}
          height={844}
          alt={alt}
          className="block h-auto w-full rounded-[9.3cqw]"
          {...loadingProps({ priority })}
        />
      </div>
    </div>
  );
}
