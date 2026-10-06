import { phoneDigits } from "@/lib/links/links";
import { currencyToDecimal, isPositive } from "@/features/team/model";
import type { CreateDeliveryInput } from "./api";
import type { Channel, CustomerAddress, PaymentMethod } from "./model";

/** Regras puras do drawer "Novo pedido" (D-13, WS-05 §5.4). */

export type DriverMode = "auto" | "manual" | "none";

export interface NewOrderForm {
  readonly channel: Channel;
  readonly phone: string;
  readonly name: string;
  readonly street: string;
  readonly number: string;
  readonly neighborhood: string;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
  /** Texto do campo único "Complemento, referência". */
  readonly complementText: string;
  /** De um endereço do cliente recorrente: os dois seguem separados enquanto o texto não for editado. */
  readonly split: { readonly complement: string | null; readonly reference: string | null; readonly text: string } | null;
  /** Coordenadas de um endereço do cliente recorrente; editar o endereço as descarta. */
  readonly lat: number | null;
  readonly lng: number | null;
  readonly paid: boolean;
  /** Texto do campo de dinheiro ("R$ 58,00"). */
  readonly amount: string;
  readonly method: PaymentMethod;
  readonly changeFor: string;
  readonly fee: string;
  readonly driverMode: DriverMode;
  readonly driverId: string | null;
  readonly sendTracking: boolean;
}

export const COLLECT_METHODS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: "credit_card", label: "Cartão na maquininha" },
  { value: "debit_card", label: "Débito na maquininha" },
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "meal_voucher", label: "Vale-refeição" },
];

export function initialForm(store: { city: string; state: string }): NewOrderForm {
  return {
    channel: "whatsapp",
    phone: "",
    name: "",
    street: "",
    number: "",
    neighborhood: "",
    city: store.city,
    state: store.state,
    zip: "",
    complementText: "",
    split: null,
    lat: null,
    lng: null,
    paid: false,
    amount: "",
    method: "credit_card",
    changeFor: "",
    fee: "",
    driverMode: "auto",
    driverId: null,
    sendTracking: true,
  };
}

const ADDRESS_FIELDS = ["street", "number", "neighborhood", "city", "state", "zip"] as const;

/** Editar qualquer campo do endereço depois de escolher um endereço do cliente descarta lat/lng. */
export function edit(form: NewOrderForm, patch: Partial<NewOrderForm>): NewOrderForm {
  let next = { ...form, ...patch };
  if (ADDRESS_FIELDS.some((key) => key in patch && patch[key] !== form[key])) next = { ...next, lat: null, lng: null };
  if ("complementText" in patch && next.split && patch.complementText !== next.split.text) next = { ...next, split: null, lat: null, lng: null };
  // Sem celular não há link de rastreio para mandar (R2-3).
  if (!hasPhone(next)) next = { ...next, sendTracking: false };
  return next;
}

export const hasPhone = (form: Pick<NewOrderForm, "phone">): boolean => phoneDigits(form.phone) !== null;
export const phoneRequired = (channel: Channel): boolean => channel !== "counter";

/** Preenche o formulário com um endereço do cliente recorrente (inclui as coordenadas). */
export function applyCustomerAddress(form: NewOrderForm, a: CustomerAddress): NewOrderForm {
  const parts = [a.complement, a.reference].filter(Boolean) as string[];
  const text = parts.join(" · ");
  return {
    ...form,
    street: a.street ?? "",
    number: a.number ?? "",
    neighborhood: a.neighborhood ?? "",
    city: a.city ?? form.city,
    state: a.state ?? form.state,
    zip: a.zipCode ?? "",
    complementText: text,
    split: parts.length > 0 ? { complement: a.complement, reference: a.reference, text } : null,
    lat: a.lat,
    lng: a.lng,
  };
}

export type FieldKey = "phone" | "name" | "street" | "number" | "neighborhood" | "city" | "state" | "amount" | "changeFor" | "driver" | "payment";

/** Erros de preenchimento por campo, antes de chamar a API. */
export function validate(form: NewOrderForm): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  const digits = form.phone.replace(/\D/g, "");
  if (phoneRequired(form.channel) && digits === "") errors.phone = "Informe o celular do cliente.";
  else if (digits !== "" && !hasPhone(form)) errors.phone = "Informe o celular do cliente com DDD.";
  if (form.name.trim() === "") errors.name = "Informe o nome do cliente.";
  if (form.street.trim() === "") errors.street = "Informe a rua.";
  if (form.number.trim() === "") errors.number = "O número é obrigatório para o mapa.";
  if (form.neighborhood.trim() === "") errors.neighborhood = "Informe o bairro.";
  if (form.city.trim() === "") errors.city = "Informe a cidade.";
  if (!/^[A-Za-z]{2}$/.test(form.state.trim())) errors.state = "Informe a UF com 2 letras.";
  if (!form.paid) {
    if (!isPositive(currencyToDecimal(form.amount))) errors.amount = "Informe o valor a cobrar.";
    const change = currencyToDecimal(form.changeFor);
    const amount = currencyToDecimal(form.amount);
    if (form.method === "cash" && change !== null && amount !== null && Number(change) < Number(amount)) {
      errors.changeFor = "O troco precisa ser maior ou igual ao valor a cobrar.";
    }
  }
  if (form.driverMode === "manual" && form.driverId === null) errors.driver = "Escolha o motoboy.";
  return errors;
}

export function toInput(form: NewOrderForm, clientRequestId: string): CreateDeliveryInput {
  // A API recebe DDD + número (sem o 55): a normalização do país é dela.
  const phone = phoneDigits(form.phone)?.slice(2) ?? null;
  const split = form.split;
  return {
    clientRequestId,
    channel: form.channel,
    customerName: form.name,
    customerPhone: phone,
    address: {
      street: form.street,
      number: form.number,
      neighborhood: form.neighborhood.trim() || null,
      city: form.city,
      state: form.state,
      zipCode: form.zip.replace(/\D/g, "") || null,
      complement: split ? split.complement : form.complementText.trim() || null,
      reference: split ? split.reference : null,
      lat: form.lat,
      lng: form.lng,
    },
    payment: form.paid
      ? { type: "online", method: null, amountToCollect: null, changeFor: null }
      : {
          type: "offline",
          method: form.method,
          amountToCollect: currencyToDecimal(form.amount),
          changeFor: form.method === "cash" ? currencyToDecimal(form.changeFor) : null,
        },
    deliveryFee: currencyToDecimal(form.fee),
    driver: { mode: form.driverMode, driverId: form.driverMode === "manual" ? form.driverId : null },
    sendTrackingLink: form.sendTracking && phone !== null,
  };
}

/** Código de erro da API → campo destacado (os demais caem no rodapé). */
export function fieldsForError(code: string | null): readonly FieldKey[] {
  switch (code) {
    case "DELIVERY_ADDRESS_INVALID":
      return ["street", "number", "neighborhood", "city", "state"];
    case "DELIVERY_CUSTOMER_PHONE_INVALID":
    case "DELIVERY_CUSTOMER_PHONE_REQUIRED":
      return ["phone"];
    case "DELIVERY_PAYMENT_INVALID":
      return ["payment"];
    case "DELIVERY_DRIVER_NOT_ON_SHIFT":
    case "DELIVERY_DRIVER_NOT_IN_TEAM":
      return ["driver"];
    default:
      return [];
  }
}

export const isDirty = (form: NewOrderForm, store: { city: string; state: string }): boolean => {
  const base = initialForm(store);
  return (
    form.phone !== "" || form.name !== "" || form.street !== "" || form.number !== "" || form.neighborhood !== "" ||
    form.zip !== "" || form.complementText !== "" || form.amount !== "" || form.fee !== "" ||
    form.city !== base.city || form.state !== base.state
  );
};
