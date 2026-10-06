import { Paths } from "@/lib/routing/routes";
import { addDays, spDay, spTime } from "@/lib/time/saoPaulo";
import type { Tone } from "@/ui/Chip";
import type { IconName } from "@/ui/Icon";
import type { Notice } from "./model";

const shortDay = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** "Agora", "5 min atrás", "2 horas atrás", "Ontem, 18:40" ou "03/10, 09:12" (fuso de São Paulo). */
export function relativeTime(iso: string, now: Date): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const minutes = Math.floor((now.getTime() - at) / 60_000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `${minutes} min atrás`;
  const date = new Date(at);
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && spDay(date) === spDay(now)) return `${hours} ${hours === 1 ? "hora" : "horas"} atrás`;
  if (spDay(date) === addDays(spDay(now), -1)) return `Ontem, ${spTime(date)}`;
  return `${shortDay.format(date)}, ${spTime(date)}`;
}

interface Look {
  readonly icon: IconName;
  readonly tone: Tone;
}

const ERROR: Look = { icon: "report", tone: "error" };
const WARN: Look = { icon: "priority_high", tone: "warning" };
const INFO: Look = { icon: "info", tone: "info" };
const OK: Look = { icon: "check", tone: "success" };
const GRAY: Look = { icon: "info", tone: "neutral" };

/** Ícone e cor por tipo; tipo desconhecido nunca quebra a lista. */
export function lookOf(type: string): Look {
  switch (type) {
    case "order_cancelled":
      return { icon: "event_busy", tone: "error" };
    case "order_expired_no_drivers":
      return { icon: "person_off", tone: "error" };
    case "negotiation_rejected":
    case "settlement_disputed":
      return ERROR;
    case "negotiation_started":
    case "service_starting_soon":
    case "settlement_driver_confirmed":
    case "delivery_awaiting_acceptance":
      return INFO;
    case "negotiation_new_offer":
      return { icon: "swap_horiz", tone: "warning" };
    case "negotiation_accepted":
    case "order_paid":
    case "service_finished":
    case "settlement_confirmed":
    case "settlement_paid":
    case "delivery_delivered_on_return":
      return OK;
    case "negotiation_cancelled":
    case "negotiation_timeout":
    case "team_member_left":
      return GRAY;
    case "driver_assigned":
      return { icon: "two_wheeler", tone: "primary" };
    case "service_started":
      return { icon: "play_circle", tone: "primary" };
    case "team_member_joined":
      return { icon: "person_add", tone: "success" };
    case "team_member_new_device":
      return { icon: "mobile", tone: "warning" };
    default:
      if (type.startsWith("delivery_")) return ["delivery_problem", "delivery_cancelled", "delivery_cancelled_by_origin"].includes(type) ? ERROR : WARN;
      return INFO;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Para onde o aviso leva no painel (`null`: só marca como lido). Só caminhos do próprio painel, com ids em UUID. */
export function targetOf(notice: Notice): string | null {
  const { refs, type } = notice;
  const ok = (id: string | undefined): id is string => id !== undefined && UUID.test(id);
  if (type.startsWith("settlement_")) return ok(refs.settlement_id) ? `${Paths.settlements}?acerto=${refs.settlement_id}` : null;
  if (type.startsWith("delivery_")) return ok(refs.delivery_id) ? `${Paths.deliveries}?pedido=${refs.delivery_id}` : null;
  if (type.startsWith("team_member_")) return Paths.team;
  if (ok(refs.order_id)) {
    const proposal = ok(refs.negotiation_id) ? `&proposta=${refs.negotiation_id}` : "";
    return `${Paths.services}?pedido=${refs.order_id}${proposal}`;
  }
  return null;
}
