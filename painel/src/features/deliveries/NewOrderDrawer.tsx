"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fetchOnShift } from "@/features/team/api";
import { teamKeys } from "@/features/team/hooks";
import { currencyInput, phoneInput } from "@/features/team/model";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Paths } from "@/lib/routing/routes";
import { Btn } from "@/ui/Btn";
import { cn } from "@/ui/cn";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { Dialog } from "@/ui/Dialog";
import { Field } from "@/ui/Field";
import { InlineError } from "@/ui/InlineError";
import { Label } from "@/ui/Label";
import { SelectField } from "@/ui/SelectField";
import { Switch } from "@/ui/Switch";
import { SHIFT_NOT_STARTED_NOTE } from "./logic";
import { createDelivery, lookupCustomer } from "./api";
import { CHANNEL_LABEL, type CustomerAddress, type DeliveryDetail } from "./model";
import {
  COLLECT_METHODS,
  applyCustomerAddress,
  edit,
  fieldsForError,
  hasPhone,
  initialForm,
  isDirty,
  phoneRequired,
  toInput,
  validate,
  type FieldKey,
  type NewOrderForm,
} from "./newOrder";
import { lookupZip, searchStreet, type StreetSuggestion } from "./viacep";

const CHANNELS = ["whatsapp", "phone", "counter"] as const;

function lastUsed(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : ` · último em ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Drawer "Novo pedido" (D-13): Canal, Celular, Cliente, Rua, Número, Complemento, Pagamento. Remonta por abertura. */
export function NewOrderDrawer({
  open,
  store,
  onClose,
  onCreated,
}: {
  open: boolean;
  store: { city: string; state: string };
  onClose: () => void;
  onCreated: (detail: DeliveryDetail) => void;
}) {
  return open ? <Body store={store} onClose={onClose} onCreated={onCreated} /> : null;
}

function Body({ store, onClose, onCreated }: { store: { city: string; state: string }; onClose: () => void; onCreated: (detail: DeliveryDetail) => void }) {
  // Um `client_request_id` por abertura: clique duplo ou timeout reenviam o mesmo, e a API devolve o pedido existente.
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState<NewOrderForm>(() => initialForm(store));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [apiFields, setApiFields] = useState<readonly FieldKey[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [editCity, setEditCity] = useState(store.city === "" || store.state === "");
  const [showZip, setShowZip] = useState(false);
  const [addresses, setAddresses] = useState<readonly CustomerAddress[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<readonly StreetSuggestion[]>([]);
  const [zipError, setZipError] = useState<string | null>(null);
  const skipSuggest = useRef(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  // Foco inicial no Celular (o drawer nasce para o balcão e o WhatsApp).
  useEffect(() => {
    const timer = setTimeout(() => phoneRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  const patch = (changes: Partial<NewOrderForm>) => {
    setForm((current) => edit(current, changes));
    setFieldErrors({});
    setApiFields([]);
    setSubmitError(null);
  };

  const onShift = useQuery({
    queryKey: teamKeys.onShift,
    queryFn: ({ signal }) => fetchOnShift(signal),
    enabled: form.driverMode === "manual",
    retry: false,
  });

  // Lookup do cliente (E16): 300 ms de debounce; só aplica se o telefone digitado ainda for o mesmo; erro em silêncio.
  const phoneDigitsNow = form.phone.replace(/\D/g, "");
  const phoneOk = hasPhone(form);
  useEffect(() => {
    if (!phoneOk) return;
    const controller = new AbortController();
    const typed = phoneDigitsNow;
    const timer = setTimeout(() => {
      lookupCustomer(typed, controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setAddresses(result.addresses.slice(0, 3));
          setPicked(null);
          if (result.name) setForm((current) => (current.name.trim() === "" ? { ...current, name: result.name ?? "" } : current));
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [phoneOk, phoneDigitsNow]);

  // Sugestões de rua (ViaCEP reverso): 400 ms, a partir de 3 letras.
  useEffect(() => {
    if (skipSuggest.current) {
      skipSuggest.current = false;
      return;
    }
    if (form.street.trim().length < 3) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchStreet(form.state, form.city, form.street, controller.signal)
        .then((found) => !controller.signal.aborted && setSuggestions(found))
        .catch(() => setSuggestions([]));
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.street, form.city, form.state]);

  const zipDigits = form.zip.replace(/\D/g, "");
  useEffect(() => {
    if (zipDigits.length !== 8) return;
    const controller = new AbortController();
    lookupZip(zipDigits, controller.signal)
      .then((found) => {
        if (controller.signal.aborted) return;
        if (!found) return setZipError("Não encontramos este CEP. Preencha o endereço.");
        setZipError(null);
        // Preenche sem apagar o que já foi digitado.
        setForm((c) => ({
          ...c,
          street: c.street || found.street,
          neighborhood: c.neighborhood || found.neighborhood,
          city: c.city || found.city,
          state: c.state || found.state,
        }));
      })
      .catch(() => setZipError("Não encontramos este CEP. Preencha o endereço."));
    return () => controller.abort();
  }, [zipDigits]);

  const dirty = isDirty(form, store);
  const requestClose = () => {
    if (submitting) return;
    if (dirty) setDiscarding(true);
    else onClose();
  };

  const errorOf = (key: FieldKey): string | undefined => fieldErrors[key] ?? (apiFields.includes(key) ? " " : undefined);

  const submit = async () => {
    if (submitting) return;
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Repetir com o mesmo `client_request_id` devolve 200 com o pedido existente: conta como sucesso.
      onCreated(await createDelivery(toInput(form, clientRequestId)));
    } catch (failure) {
      if (isApiError(failure)) {
        setApiFields(fieldsForError(failure.code));
        if (fieldsForError(failure.code).includes("city") || fieldsForError(failure.code).includes("state")) setEditCity(true);
        setSubmitError(failure.text());
      } else {
        setSubmitError(UNKNOWN_MESSAGE);
      }
      setSubmitting(false);
    }
  };

  const counterNoPhone = !phoneOk;

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && requestClose()} variant="right" size="lg" title="Novo pedido">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
            <p className="type-body-sm text-text-tertiary">Para pedidos de WhatsApp, telefone ou balcão.</p>
            <p className="type-body-sm rounded-md border border-border bg-surface p-3 text-text-secondary">
              Pedidos do iFood, Saipos e Cardápio Web entram sozinhos.{" "}
              <Link href={Paths.integrations} className="font-semibold text-primary-text hover:underline">
                Ver integrações
              </Link>
            </p>

            <fieldset className="flex flex-col gap-2">
              <legend className="type-label-sm mb-2 font-semibold uppercase tracking-[0.8px] text-text-tertiary">Canal</legend>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    aria-pressed={form.channel === channel}
                    onClick={() => patch({ channel })}
                    className={cn(
                      "type-label-md min-h-11 cursor-pointer rounded-md border px-2 font-semibold",
                      form.channel === channel ? "border-primary bg-primary-tint text-primary-text" : "border-border text-text-secondary",
                    )}
                  >
                    {CHANNEL_LABEL[channel]}
                  </button>
                ))}
              </div>
            </fieldset>

            <Field
              label="Celular"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              ref={phoneRef}
              value={form.phone}
              error={errorOf("phone")?.trim() ? errorOf("phone") : undefined}
              hint={!phoneRequired(form.channel) ? "Sem celular, não dá para mandar o link de rastreio." : undefined}
              onChange={(event) => patch({ phone: phoneInput(event.target.value) })}
            />
            {apiFields.includes("phone") && submitError && <InlineError message={submitError} />}

            {phoneOk && addresses.length > 0 && (
              <fieldset className="flex flex-col gap-2">
                <legend className="type-body-sm mb-1 text-text-secondary">Endereços deste cliente</legend>
                {addresses.map((a, index) => {
                  const line = [[a.street, a.number].filter(Boolean).join(", "), a.neighborhood].filter(Boolean).join(" · ");
                  return (
                    <label key={`${a.street}-${a.number}-${index}`} className="type-body-sm flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 text-text-primary has-[:checked]:border-primary has-[:checked]:bg-primary-tint">
                      <input
                        type="radio"
                        name="customer-address"
                        checked={picked === index}
                        onChange={() => {
                          setPicked(index);
                          skipSuggest.current = true;
                          setForm((c) => applyCustomerAddress(c, a));
                        }}
                      />
                      {line}
                      {lastUsed(a.lastUsedAt)}
                    </label>
                  );
                })}
                <label className="type-body-sm flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 text-text-secondary has-[:checked]:border-primary">
                  <input type="radio" name="customer-address" checked={picked === null} onChange={() => setPicked(null)} />
                  Outro endereço
                </label>
              </fieldset>
            )}

            <Field
              label="Cliente"
              maxLength={120}
              autoComplete="off"
              value={form.name}
              error={fieldErrors.name}
              onChange={(event) => patch({ name: event.target.value })}
            />

            <div className="flex flex-col gap-2">
              {editCity ? (
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <Field label="Cidade" value={form.city} error={errorOf("city")?.trim() ? errorOf("city") : undefined} onChange={(event) => patch({ city: event.target.value })} />
                  <Field label="UF" maxLength={2} value={form.state} error={errorOf("state")?.trim() ? errorOf("state") : undefined} onChange={(event) => patch({ state: event.target.value.toUpperCase() })} />
                </div>
              ) : (
                <p className="type-body-sm text-text-tertiary">
                  {form.city} · {form.state} ·{" "}
                  <button type="button" onClick={() => setEditCity(true)} className="cursor-pointer font-semibold text-primary-text hover:underline">
                    alterar
                  </button>
                </p>
              )}
              <Field
                label="Rua"
                autoComplete="off"
                value={form.street}
                error={errorOf("street")?.trim() ? errorOf("street") : undefined}
                onChange={(event) => patch({ street: event.target.value })}
              />
              {form.street.trim().length >= 3 && suggestions.length > 0 && (
                <ul role="listbox" aria-label="Sugestões de rua" className="flex flex-col overflow-hidden rounded-md border border-border bg-surface">
                  {suggestions.map((s) => (
                    <li key={`${s.street}-${s.zip}`} role="option" aria-selected={false}>
                      <button
                        type="button"
                        onClick={() => {
                          skipSuggest.current = true;
                          setSuggestions([]);
                          patch({ street: s.street, neighborhood: s.neighborhood, zip: s.zip });
                        }}
                        className="type-body-sm min-h-10 w-full cursor-pointer px-3 text-left text-text-primary hover:bg-surface-variant"
                      >
                        {s.street} · {s.neighborhood} · {s.zip}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <Field label="Número" autoComplete="off" value={form.number} error={errorOf("number")?.trim() ? errorOf("number") : undefined} onChange={(event) => patch({ number: event.target.value })} />
                <Field label="Bairro" autoComplete="off" value={form.neighborhood} error={errorOf("neighborhood")?.trim() ? errorOf("neighborhood") : undefined} onChange={(event) => patch({ neighborhood: event.target.value })} />
              </div>
              {apiFields.some((k) => ["street", "number", "neighborhood", "city", "state"].includes(k)) && submitError && <InlineError message={submitError} />}
              <Field label="Complemento, referência" autoComplete="off" value={form.complementText} onChange={(event) => patch({ complementText: event.target.value })} />
              {showZip ? (
                <Field
                  label="CEP"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.zip}
                  error={zipError ?? undefined}
                  onChange={(event) => {
                    setZipError(null);
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 8);
                    patch({ zip: digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits });
                  }}
                />
              ) : (
                <button type="button" onClick={() => setShowZip(true)} className="type-caption cursor-pointer self-start font-semibold text-primary-text hover:underline">
                  Tenho o CEP
                </button>
              )}
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="type-label-sm mb-2 font-semibold uppercase tracking-[0.8px] text-text-tertiary">Pagamento</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { paid: true, label: "Já pago" },
                  { paid: false, label: "Cobrar na entrega" },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={form.paid === option.paid}
                    onClick={() => patch({ paid: option.paid })}
                    className={cn(
                      "type-label-md min-h-11 cursor-pointer rounded-md border px-2 font-semibold",
                      form.paid === option.paid ? "border-primary bg-primary-tint text-primary-text" : "border-border text-text-secondary",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {!form.paid && (
                <div className="mt-1 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label="Valor a cobrar"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.amount}
                      error={fieldErrors.amount}
                      onChange={(event) => patch({ amount: currencyInput(event.target.value) })}
                    />
                    <SelectField label="Forma" value={form.method} onChange={(event) => patch({ method: event.target.value as NewOrderForm["method"] })}>
                      {COLLECT_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </SelectField>
                  </div>
                  {form.method === "cash" && (
                    <Field
                      label="Troco para"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.changeFor}
                      error={fieldErrors.changeFor}
                      onChange={(event) => patch({ changeFor: currencyInput(event.target.value) })}
                    />
                  )}
                </div>
              )}
              {apiFields.includes("payment") && submitError && <InlineError message={submitError} />}
            </fieldset>

            <Field
              label="Taxa de entrega cobrada do cliente"
              inputMode="numeric"
              autoComplete="off"
              value={form.fee}
              onChange={(event) => patch({ fee: currencyInput(event.target.value) })}
            />

            <div className="flex flex-col gap-3">
              <Label as="h3">Motoboy</Label>
              <Switch
                label="Atribuir automaticamente"
                description="Quem está em turno e fica livre primeiro"
                checked={form.driverMode === "auto"}
                onCheckedChange={(on) => patch({ driverMode: on ? "auto" : "none", driverId: null })}
              />
              {form.driverMode !== "auto" && (
                <SelectField
                  label="Motoboy em turno"
                  hint={(onShift.data ?? []).some((o) => !o.sessionStarted) ? SHIFT_NOT_STARTED_NOTE : undefined}
                  value={form.driverMode === "manual" ? (form.driverId ?? "") : ""}
                  onFocus={() => form.driverMode === "none" && patch({ driverMode: "manual" })}
                  onChange={(event) => patch(event.target.value === "" ? { driverMode: "none", driverId: null } : { driverMode: "manual", driverId: event.target.value })}
                >
                  <option value="">Sem motoboy por enquanto</option>
                  {(onShift.data ?? []).map((o) => (
                    <option key={o.membershipId} value={o.driver.id} disabled={!o.sessionStarted}>
                      {o.driver.shortName}
                      {o.sessionStarted ? "" : " · turno não iniciado"}
                    </option>
                  ))}
                </SelectField>
              )}
              {fieldErrors.driver && <p className="type-caption text-error">{fieldErrors.driver}</p>}
              {apiFields.includes("driver") && submitError && <InlineError message={submitError} />}
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <Switch
                label="Mandar link de rastreio quando sair"
                description={counterNoPhone ? "Sem celular, não dá para mandar o link." : "Abre o WhatsApp com a mensagem pronta para o cliente"}
                checked={form.sendTracking && !counterNoPhone}
                disabled={counterNoPhone}
                onCheckedChange={(sendTracking) => patch({ sendTracking })}
              />
            </div>

            {submitError && apiFields.length === 0 && <InlineError message={submitError} />}
          </div>
          <div className="flex gap-2.5 border-t border-divider p-5">
            <Btn kind="secondary" className="flex-1" disabled={submitting} onClick={requestClose}>
              Cancelar
            </Btn>
            <Btn type="submit" className="flex-[2]" loading={submitting}>
              Criar pedido
            </Btn>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        request={
          discarding
            ? {
                title: "Descartar o pedido?",
                description: "O pedido que você está preenchendo ainda não foi criado.",
                confirmLabel: "Descartar",
                cancelLabel: "Continuar editando",
                danger: true,
                onConfirm: onClose,
              }
            : null
        }
        onClose={() => setDiscarding(false)}
      />
    </>
  );
}

