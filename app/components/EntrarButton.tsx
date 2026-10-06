import { ENTRAR_LABEL, PAINEL_URL } from "../lib/painel";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export default function EntrarButton() {
  return (
    <a
      href={PAINEL_URL}
      aria-label={ENTRAR_LABEL}
      title={`${ENTRAR_LABEL} (motoboy: o acesso é pelo app)`}
      className={`inline-flex items-center justify-center min-h-11 px-5 rounded-full border border-primary text-primary font-medium text-sm hover:bg-primary hover:text-white transition-colors ${focus}`}
    >
      Entrar
    </a>
  );
}
