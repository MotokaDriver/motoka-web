"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppLinks } from "@/features/shell/AppLinks";
import { deleteCard } from "@/features/services/api";
import { serviceKeys, useCards } from "@/features/services/hooks";
import { CARD_APP_NOTE, CARD_TYPE_LABEL } from "@/features/services/logic";
import { lookupZip } from "@/features/deliveries/viacep";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Btn } from "@/ui/Btn";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { Field } from "@/ui/Field";
import { InlineError } from "@/ui/InlineError";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { fetchAddress, updateAddress, updatePhone, type Address } from "./api";

/** Celular com DDD e 9 dígitos, como no app. */
export const PHONE_PATTERN = /^\(?\d{2}\)?\s?9\d{4}-?\d{4}$/;

export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export const maskZip = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

export function validateAddress(a: Address): Partial<Record<keyof Address, string>> {
  const errors: Partial<Record<keyof Address, string>> = {};
  if (a.postalCode.replace(/\D/g, "").length !== 8) errors.postalCode = "Insira um CEP válido";
  if (a.city.trim() === "") errors.city = "Informe a cidade";
  if (!/^[A-Za-z]{2}$/.test(a.state.trim())) errors.state = "Informe a UF";
  if (a.street.trim() === "") errors.street = "Informe o endereço";
  if (a.neighborhood.trim() === "") errors.neighborhood = "Informe o bairro";
  if (a.number.trim() === "") errors.number = "Informe o número";
  else if (!/^\d+$/.test(a.number.trim())) errors.number = "Informe apenas números";
  return errors;
}

/** Telefone: o único contato editável por aqui (o e-mail muda por código de confirmação, no app). */
export function PhoneEditor({ userId, current }: { userId: string; current: string }) {
  const toast = useToast();
  const [value, setValue] = useState(() => maskPhone(current));
  const [saved, setSaved] = useState(() => maskPhone(current));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalid = value.trim() === "" ? "Por favor, insira um telefone" : PHONE_PATTERN.test(value) ? null : "Informe um celular com DDD e 9 dígitos.";

  const save = async () => {
    setTouched(true);
    if (invalid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updatePhone(userId, value.replace(/\D/g, ""));
      setSaved(value);
      toast({ title: "Telefone alterado com sucesso!" });
    } catch (failure) {
      setError(isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label="Telefone" type="tel" inputMode="tel" autoComplete="tel-national" value={value} error={touched ? (invalid ?? undefined) : undefined} onChange={(event) => setValue(maskPhone(event.target.value))} />
      {error && <InlineError message={error} />}
      <div>
        <Btn kind="secondary" loading={busy} disabled={value === saved} onClick={() => void save()}>
          Salvar telefone
        </Btn>
      </div>
    </div>
  );
}

/** Endereço do estabelecimento (`PUT /users/{id}/address`), com busca de CEP no ViaCEP. */
export function AddressEditor({ userId }: { userId: string }) {
  const saved = useQuery({ queryKey: ["account", "address", userId], queryFn: ({ signal }) => fetchAddress(userId, signal), retry: false });
  if (saved.isPending) return <Spinner size={20} label="Carregando o endereço" />;
  if (saved.isError) return <InlineError message="Não foi possível carregar o endereço. Tente novamente." onRetry={() => void saved.refetch()} />;
  return <AddressForm userId={userId} initial={{ ...saved.data, postalCode: maskZip(saved.data.postalCode) }} />;
}

function AddressForm({ userId, initial }: { userId: string; initial: Address }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Address>(initial);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zipNote, setZipNote] = useState<string | null>(null);

  const edit = (patch: Partial<Address>) => setForm((current) => ({ ...current, ...patch }));
  const errors = validateAddress(form);
  const err = (key: keyof Address) => (touched ? errors[key] : undefined);

  const onZip = async (raw: string) => {
    const masked = maskZip(raw);
    edit({ postalCode: masked });
    setZipNote(null);
    if (masked.length !== 9) return;
    try {
      const found = await lookupZip(masked);
      if (found) edit({ street: found.street || form.street, neighborhood: found.neighborhood, city: found.city, state: found.state, complement: "" });
      else setZipNote("CEP não encontrado. Confira o CEP ou preencha o endereço.");
    } catch {
      setZipNote("Não foi possível buscar o CEP agora. Preencha o endereço.");
    }
  };

  const save = async () => {
    setTouched(true);
    if (Object.keys(errors).length > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateAddress(userId, form);
      await queryClient.invalidateQueries({ queryKey: ["account", "address", userId] });
      toast({ title: "Endereço alterado com sucesso!" });
    } catch (failure) {
      setError(isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Field label="CEP" inputMode="numeric" autoComplete="postal-code" value={form.postalCode} error={err("postalCode")} hint={zipNote ?? undefined} onChange={(event) => void onZip(event.target.value)} />
      <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
        <Field label="Cidade" autoComplete="address-level2" value={form.city} error={err("city")} onChange={(event) => edit({ city: event.target.value })} />
        <Field label="UF" maxLength={2} autoComplete="address-level1" value={form.state} error={err("state")} onChange={(event) => edit({ state: event.target.value.toUpperCase() })} />
      </div>
      <Field label="Endereço" autoComplete="address-line1" value={form.street} error={err("street")} onChange={(event) => edit({ street: event.target.value })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Bairro" value={form.neighborhood} error={err("neighborhood")} onChange={(event) => edit({ neighborhood: event.target.value })} />
        <Field label="Número" inputMode="numeric" value={form.number} error={err("number")} onChange={(event) => edit({ number: event.target.value })} />
      </div>
      <Field label="Complemento (opcional)" maxLength={50} value={form.complement} onChange={(event) => edit({ complement: event.target.value })} />
      {error && <InlineError message={error} />}
      <div>
        <Btn kind="secondary" loading={busy} onClick={() => void save()}>
          Salvar endereço
        </Btn>
      </div>
    </div>
  );
}

/** Cartões salvos: só listar e excluir. Cadastrar cartão novo é do app (DN-25: nenhum campo de cartão no painel). */
export function CardsSection({ userId }: { userId: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const cards = useCards(userId);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (id: string) => {
    setError(null);
    try {
      await deleteCard(userId, id);
      toast({ title: "Cartão excluído." });
      await queryClient.invalidateQueries({ queryKey: serviceKeys.cards(userId) });
    } catch (failure) {
      setError(isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE);
    }
  };

  return (
    <>
      {cards.isPending ? (
        <Spinner size={20} label="Carregando os cartões" />
      ) : cards.isError ? (
        <InlineError message="Ocorreu um erro ao trazer os cartões. Tente novamente mais tarde." onRetry={() => void cards.refetch()} />
      ) : cards.data.length === 0 ? (
        <p className="type-body-sm text-text-secondary">Nenhum cartão cadastrado.</p>
      ) : (
        <ul aria-label="Cartões salvos" className="flex flex-col gap-2">
          {cards.data.map((card) => (
            <li key={card.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span className="type-body-md text-text-primary">{`${CARD_TYPE_LABEL(card.type)} · ${card.mask}`}</span>
              <Btn
                kind="danger"
                onClick={() =>
                  setConfirm({
                    title: "Excluir cartão",
                    description: "Tem certeza que deseja excluir este cartão? Essa ação não pode ser desfeita.",
                    confirmLabel: "Excluir",
                    danger: true,
                    onConfirm: () => void remove(card.id),
                  })
                }
              >
                Excluir
              </Btn>
            </li>
          ))}
        </ul>
      )}
      {error && <InlineError message={error} />}
      <p className="type-caption text-text-tertiary">{CARD_APP_NOTE}</p>
      <AppLinks />
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
