// Links externos da landing. O painel vem de build (next.config.ts valida o host).
export { PAINEL_URL } from "../../lib/painel";

export const APP_STORE_URL = "https://apps.apple.com/br/app/motoka-driver/id6759629174";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.app.motoka_app";
export const WHATSAPP_URL = "https://wa.me/5541997536991";
export const CONTACT_EMAIL = "contatomotokadriver@gmail.com";

// Classes compartilhadas (botões e foco visível no fundo escuro).
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lp-blue-ink";

const btnBase = `inline-flex items-center justify-center gap-2 rounded-lg border font-semibold whitespace-nowrap tracking-[-0.005em] transition-colors duration-200 ${focusRing}`;

export const btnPrimary = `${btnBase} h-12 px-5 text-[15px] bg-lp-blue border-lp-blue text-white hover:bg-lp-blue-hover hover:border-lp-blue-hover`;
export const btnSecondary = `${btnBase} h-12 px-5 text-[15px] bg-transparent border-lp-line-2 text-lp-ink hover:border-[#5A5A5A] hover:bg-[#121212]`;
export const btnSmall = "!h-[38px] !px-3.5 !text-sm";
