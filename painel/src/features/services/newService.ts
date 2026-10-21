import { addDays, spDay } from "@/lib/time/saoPaulo";
import { currencyToDecimal } from "@/features/team/model";
import { spInstant } from "./logic";
import type { OrderInput } from "./api";
import type { OrderType } from "./model";

/** Formulário de "Solicitar serviço" (`establishment_create_order_page`). Datas e horas no fuso de São Paulo. */
export interface ServiceForm {
  readonly startDay: string;
  readonly startTime: string;
  readonly endDay: string;
  readonly endTime: string;
  readonly drivers: string;
  readonly type: OrderType | "";
  /** Texto do campo ("R$ 50,00"). */
  readonly value: string;
  readonly perDelivery: string;
}

export const MAX_DAYS_AHEAD = 30;

export const emptyForm = (): ServiceForm => ({ startDay: "", startTime: "", endDay: "", endTime: "", drivers: "", type: "", value: "", perDelivery: "" });

export type FormKey = keyof ServiceForm;

export const usesValue = (type: OrderType | ""): boolean => type === "fixed_value" || type === "fixed_plus_per_delivery";
export const usesPerDelivery = (type: OrderType | ""): boolean => type === "per_delivery" || type === "fixed_plus_per_delivery";

export const minDay = (now: Date): string => spDay(now);
export const maxDay = (now: Date): string => addDays(spDay(now), MAX_DAYS_AHEAD);

/** Erros de campo (vazios = válido). A API é a palavra final; isto evita a ida e volta. */
export function validate(form: ServiceForm, now: Date): Partial<Record<FormKey, string>> {
  const errors: Partial<Record<FormKey, string>> = {};
  if (form.startDay === "") errors.startDay = "Obrigatório";
  if (form.startTime === "") errors.startTime = "Obrigatório";
  if (form.endDay === "") errors.endDay = "Obrigatório";
  if (form.endTime === "") errors.endTime = "Obrigatório";
  if (form.startDay !== "" && (form.startDay < minDay(now) || form.startDay > maxDay(now))) errors.startDay = "Escolha uma data nos próximos 30 dias.";
  if (form.endDay !== "" && form.startDay !== "" && form.endDay < form.startDay) errors.endDay = "A data final não pode ser antes da inicial.";

  const start = form.startDay && form.startTime ? spInstant(form.startDay, form.startTime) : null;
  const end = form.endDay && form.endTime ? spInstant(form.endDay, form.endTime) : null;
  if (form.startDay && form.startTime && start === null) errors.startTime = "Horário inválido";
  if (form.endDay && form.endTime && end === null) errors.endTime = "Horário inválido";
  if (start !== null && !errors.startDay && Date.parse(start) <= now.getTime()) errors.startTime = "O horário de início deve ser no futuro";
  if (start !== null && end !== null && !errors.endTime && Date.parse(end) <= Date.parse(start)) errors.endTime = "A data/hora final deve ser posterior à inicial";

  const drivers = Number(form.drivers);
  if (form.drivers.trim() === "") errors.drivers = "Obrigatório";
  else if (!Number.isInteger(drivers) || drivers < 1) errors.drivers = "Informe a quantidade de motoboys.";

  if (form.type === "") errors.type = "Escolha o tipo de serviço";
  if (usesValue(form.type)) {
    const value = currencyToDecimal(form.value);
    if (value === null) errors.value = "Informe o valor por motoboy";
    else if (Number(value) <= 0) errors.value = "O valor deve ser maior que zero";
  }
  if (usesPerDelivery(form.type)) {
    const each = currencyToDecimal(form.perDelivery);
    if (each === null) errors.perDelivery = "Informe o valor por entrega";
    else if (Number(each) <= 0) errors.perDelivery = "O valor deve ser maior que zero";
  }
  return errors;
}

/** O corpo do pedido, ou `null` se o formulário ainda não está válido. */
export function toInput(form: ServiceForm, establishmentId: string, now: Date): OrderInput | null {
  if (Object.keys(validate(form, now)).length > 0 || form.type === "") return null;
  const start = spInstant(form.startDay, form.startTime);
  const end = spInstant(form.endDay, form.endTime);
  if (start === null || end === null) return null;
  return {
    establishmentId,
    requestedDrivers: Number(form.drivers),
    startDate: start,
    endDate: end,
    type: form.type,
    value: usesValue(form.type) ? currencyToDecimal(form.value) : null,
    pricePerDelivery: usesPerDelivery(form.type) ? currencyToDecimal(form.perDelivery) : null,
  };
}

/** Campo da API que o erro aponta, para mostrar a mensagem junto do campo. */
export function fieldForError(code: string | null): FormKey | null {
  switch (code) {
    case "ORDER_START_DATE_INVALID":
    case "ORDER_START_DATE_EXPIRED":
      return "startTime";
    case "ORDER_END_DATE_INVALID":
      return "endTime";
    case "ORDER_VALUE_NOT_POSITIVE":
    case "ORDER_VALUE_REQUIRED":
      return "value";
    case "ORDER_PRICE_PER_DELIVERY_REQUIRED":
      return "perDelivery";
    default:
      return null;
  }
}
