import { APP_STORE_URL, PLAY_STORE_URL, focusRing } from "./links";

// Os mesmos selos da landing anterior (ícones Apple/Android e textos "Baixar na App Store" e
// "Disponível no Google Play"), no acabamento escuro do novo layout.
const badge = `inline-flex items-center gap-3 h-14 pl-3.5 pr-[18px] rounded-[10px] border border-lp-line-2 bg-[#111] text-lp-ink transition-colors duration-200 hover:border-lp-blue hover:bg-[#12161F] ${focusRing}`;

export default function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={badge}>
        <svg aria-hidden="true" className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.21-.93 3.69-.93.95 0 1.74.29 2.38.74-2.05 1.22-1.71 4.58.62 5.54-.52 1.56-1.27 3.1-2.09 4.23-.59.85-1.21 1.71-1.78 1.71H17.05zM12.95 5.13c-.66-1.04-.15-2.61.98-3.13 1.01-.46 2.45.18 2.45 1.8 0 1.35-.98 2.58-2.09 2.58-.35 0-.9-.07-1.34-1.25z" /></svg>
        <span className="text-left">
          <span className="block text-[11px] font-medium leading-[1.1] text-lp-ink-3">Baixar na</span>
          <span className="block text-[17px] font-semibold leading-[1.2] tracking-[-0.01em]">App Store</span>
        </span>
      </a>
      <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={badge}>
        <svg aria-hidden="true" className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-2.86-1.21-6.08-1.21-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.16-.37.52-.22.81L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z" /></svg>
        <span className="text-left">
          <span className="block text-[11px] font-medium leading-[1.1] text-lp-ink-3">Disponível no</span>
          <span className="block text-[17px] font-semibold leading-[1.2] tracking-[-0.01em]">Google Play</span>
        </span>
      </a>
    </div>
  );
}
