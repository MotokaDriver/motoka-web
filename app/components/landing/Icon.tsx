// Ícones de traço (24x24) usados na landing. Decorativos: o texto ao lado dá o significado.
const PATHS = {
  store: ["M3 10V20h18V10", "M2.5 9.5 4.5 4h15l2 5.5", "M2.5 9.5a3.2 3.2 0 0 0 6.3 0 3.2 3.2 0 0 0 6.4 0 3.2 3.2 0 0 0 6.3 0", "M9.5 20v-5h5v5"],
  bike: ["M5.5 13.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z", "M18.5 13.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z", "M5.5 17 9 10h6l3.5 7", "M15 10l-1.5-4H11"],
  arrow: ["M5 12h14", "m12 5 7 7-7 7"],
  info: ["M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z", "M12 16v-4", "M12 8h.01"],
  check: ["M20 6 9 17l-5-5"],
  monitor: ["M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", "M8 21h8", "M12 17v4"],
  plus: ["M12 5v14", "M5 12h14"],
  receipt: ["M5 2v20l2-1.5L9 22l2-1.5 2 1.5 2-1.5 2 1.5 2-1.5V2l-2 1.5L15 2l-2 1.5L11 2 9 3.5 7 2z", "M9 8h6", "M9 12h6", "M9 16h4"],
  navigate: ["M3 11 21 3l-8 18-2-8z"],
  payments: ["M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z", "M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z", "M6 12h.01", "M18 12h.01"],
  sync: ["m17 2 4 4-4 4", "M3 11v-1a4 4 0 0 1 4-4h14", "m7 22-4-4 4-4", "M21 13v1a4 4 0 0 1-4 4H3"],
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
