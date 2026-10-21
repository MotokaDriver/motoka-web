import { EXTRA_FILLED_ICONS, EXTRA_ICONS } from "@/icons/extra";
import { registerExtraIcons } from "@/icons/store";

// Efeito colateral do import: os ícones da tela entram só nos chunks de `/equipe/`, `/pedidos/` e `/ao-vivo/`.
registerExtraIcons(EXTRA_ICONS, EXTRA_FILLED_ICONS);
