import { APP_ENV } from "@/lib/env";
import type { Tone } from "@/ui/Chip";
import type { ActivityKind, Card, IntegrationType, TestResult } from "./model";

export interface TypeInfo {
  readonly name: string;
  readonly kind: string;
  /** Fala o Open Delivery (`/od/*`): as credenciais geradas aqui são coladas no sistema da loja. */
  readonly operator: boolean;
  readonly how: string;
}

export const TYPE_INFO: Partial<Record<IntegrationType, TypeInfo>> = {
  open_delivery: {
    name: "Open Delivery",
    kind: "Padrão aberto da Abrasel",
    operator: true,
    how: "Copie as credenciais abaixo para o seu sistema, na área de operador logístico. O Motoka aceita ou recusa cada entrega e devolve status e posição do motoboy.",
  },
  saipos: {
    name: "Saipos",
    kind: "PDV",
    operator: true,
    how: "A Saipos manda cada entrega para o Motoka. Na Saipos: Entregadores, + Entregadores, marque \"Usa serviço de entrega\", escolha o Motoka e copie o Merchant ID. Cole aqui, gere as credenciais e, na Saipos, clique em \"Validar integração\".",
  },
  nuvemshop: { name: "Nuvemshop", kind: "Loja virtual", operator: false, how: "" },
};

/** Cards que a tela mostra: Open Delivery sempre; Saipos só se a API a liberou; Nuvemshop como "Em breve". */
export function visibleCards(cards: readonly Card[]): readonly Card[] {
  return cards.filter((card) => card.type === "open_delivery" || card.type === "nuvemshop" || (card.type === "saipos" && card.status !== "soon"));
}

export const cardTone = (card: Card): { label: string; tone: Tone } =>
  card.status === "connected" ? { label: "Conectado", tone: "success" } : card.status === "soon" ? { label: "Em breve", tone: "neutral" } : { label: "Conectar", tone: "neutral" };

// --- Validação no cliente (a API decide) ---------------------------------------------------

export const OD_MERCHANT_MIN = 36;

export function validateMerchant(type: IntegrationType, value: string): string | null {
  const text = value.trim();
  if (text === "") return "Cole o Merchant ID que o seu sistema mostrou.";
  if (text.length > 100) return "O Merchant ID tem no máximo 100 caracteres.";
  if (type === "open_delivery" && text.length < OD_MERCHANT_MIN) return `O Merchant ID do Open Delivery tem pelo menos ${OD_MERCHANT_MIN} caracteres.`;
  return null;
}

/**
 * URL de eventos (webhook): https público, porta 443 ou 8443, sem usuário e senha. Fora de produção aceita
 * `http://localhost` para o ambiente de teste. Vazio é válido (a integração pode não receber eventos). Quem decide é a API.
 */
export function validateWebhook(value: string): string | null {
  const text = value.trim();
  if (text === "") return null;
  if (text.length > 2048) return "A URL é grande demais.";
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return "Use um endereço completo, começando com https://.";
  }
  const dev = APP_ENV !== "prod" && url.protocol === "http:" && url.hostname === "localhost";
  if (url.protocol !== "https:" && !dev) return "Use um endereço https.";
  if (url.username || url.password) return "A URL não pode ter usuário e senha.";
  if (!dev && url.port !== "" && url.port !== "443" && url.port !== "8443") return "Use a porta 443 ou 8443.";
  return null;
}

// --- Textos ---------------------------------------------------------------------------------

const TEST_ERROR: Record<string, string> = {
  no_target: "Cadastre a URL de eventos e salve antes de testar.",
  url: "A URL de eventos não é válida.",
  dns: "Não encontramos esse endereço. Confira o nome do site.",
  timeout: "O endereço não respondeu a tempo.",
  blocked_address: "Este endereço não é permitido (rede interna ou reservada).",
  tls: "O certificado de segurança (TLS) do endereço não é válido.",
  connect: "Não foi possível conectar nesse endereço.",
  read: "A conexão caiu antes de a resposta chegar.",
  response_too_large: "O endereço respondeu com dados demais.",
  bad_json: "O endereço respondeu algo que o Motoka não entendeu.",
};

/** Resultado do "Testar conexão" em texto fixo; o `detail` do servidor nunca vai para a tela. */
export function testSummary(result: TestResult): { ok: boolean; text: string } {
  if (result.ok) return { ok: true, text: `Conectou e o certificado é válido (resposta HTTP ${result.httpStatus ?? "ok"}).` };
  return { ok: false, text: (result.error && TEST_ERROR[result.error]) || "Não foi possível conectar nesse endereço." };
}

export interface ActivityLook {
  readonly text: (number: number | null, origin: string) => string;
  readonly tone: Tone;
}

const at = (n: number | null): string => (n === null ? "" : ` #${n}`);

export const ACTIVITY: Record<ActivityKind, ActivityLook> = {
  received: { text: (n) => `Pedido${at(n)} recebido`, tone: "success" },
  sent: { text: (n) => `Status${at(n)} enviado`, tone: "success" },
  error: { text: (n) => `Falha ao enviar o status${at(n)}`, tone: "warning" },
  dead_letter: { text: (n) => `Evento${at(n)} descartado depois de várias tentativas`, tone: "error" },
  credential_rotated: { text: () => "Secret novo gerado", tone: "warning" },
  connected: { text: () => "Integração conectada", tone: "success" },
  disconnected: { text: () => "Integração desconectada", tone: "neutral" },
  accepted: { text: (n) => `Pedido${at(n)} aceito`, tone: "success" },
  rejected: { text: (n) => `Pedido${at(n)} recusado`, tone: "neutral" },
  origin_unconfirmed: { text: (n, origin) => `O ${origin} não confirmou o aceite do pedido${at(n)}`, tone: "error" },
  driver_removed: { text: (n) => `Motoboy removido do pedido${at(n)}`, tone: "warning" },
  origin_discarded: { text: (n, origin) => `O ${origin} descartou o pedido${at(n)}`, tone: "error" },
  unknown: { text: () => "Atividade registrada", tone: "neutral" },
};
