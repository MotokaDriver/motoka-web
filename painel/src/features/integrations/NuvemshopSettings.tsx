"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { currencyInput, currencyToDecimal } from "@/features/team/model";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Btn } from "@/ui/Btn";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { Field } from "@/ui/Field";
import { InlineError } from "@/ui/InlineError";
import { Spinner } from "@/ui/Spinner";
import { Switch } from "@/ui/Switch";
import { useToast } from "@/ui/Toast";
import { fetchShippingSettings, putShippingSettings, rotateRouteToken, type ShippingSettings } from "./api";
import { integrationKeys } from "./hooks";

const errorText = (failure: unknown): string => (isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE);

/** A Nuvemshop guarda a cotação por até 15 minutos (texto do Motoka, não do parceiro). */
export const CACHE_NOTICE = "A Nuvemshop guarda a cotação por até 15 minutos: mudanças de área e de preço podem levar esse tempo para aparecer no checkout.";

export const MAX_RANGES = 200;
export const MAX_CITIES = 200;

const digits = (value: string): string => value.replace(/\D/g, "").slice(0, 8);
export const maskCep = (value: string): string => {
  const d = digits(value);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export interface RangeRow {
  readonly from: string;
  readonly to: string;
}

export interface SettingsForm {
  readonly price: string;
  readonly eta: string;
  readonly ranges: readonly RangeRow[];
  /** Uma cidade por linha. */
  readonly cities: string;
  readonly active: boolean;
  readonly openFrom: string;
  readonly openUntil: string;
}

export function toForm(settings: ShippingSettings): SettingsForm {
  return {
    // Sempre com 2 casas antes da máscara: "15" é R$ 15,00, nunca R$ 0,15.
    price: Number(settings.price) > 0 ? currencyInput(Number(settings.price).toFixed(2).replace(".", "")) : "",
    eta: String(settings.etaMinutes),
    ranges: settings.cepRanges.map(([from, to]) => ({ from: maskCep(from), to: maskCep(to) })),
    cities: settings.cities.join("\n"),
    active: settings.active,
    openFrom: settings.openFrom ?? "",
    openUntil: settings.openUntil ?? "",
  };
}

export const parseCities = (text: string): string[] => text.split(/\r?\n/).map((c) => c.split(/\s+/).filter(Boolean).join(" ").slice(0, 120)).filter((c) => c !== "");

export type FormErrors = Partial<Record<"price" | "eta" | "ranges" | "cities" | "hours", string>>;

/** Mesmos limites da API (preço até 9.999,99, prazo de 1 a 600 min, faixas de CEP de 8 dígitos, até 200 de cada). */
export function validateSettings(form: SettingsForm): FormErrors {
  const errors: FormErrors = {};
  const price = currencyToDecimal(form.price) ?? "0.00";
  if (Number(price) > 9999.99) errors.price = "O valor máximo é R$ 9.999,99.";
  const eta = Number(form.eta);
  if (form.eta.trim() === "" || !Number.isInteger(eta) || eta < 1 || eta > 600) errors.eta = "Informe o prazo de 1 a 600 minutos.";
  if (form.ranges.length > MAX_RANGES) errors.ranges = `No máximo ${MAX_RANGES} faixas de CEP.`;
  else if (form.ranges.some((r) => digits(r.from).length !== 8 || digits(r.to).length !== 8)) errors.ranges = "Cada faixa precisa de dois CEPs com 8 dígitos.";
  else if (form.ranges.some((r) => digits(r.from) > digits(r.to))) errors.ranges = "Em cada faixa, o CEP inicial não pode ser maior que o final.";
  if (parseCities(form.cities).length > MAX_CITIES) errors.cities = `No máximo ${MAX_CITIES} cidades.`;
  if ((form.openFrom === "") !== (form.openUntil === "")) errors.hours = "Preencha o início e o fim do horário, ou deixe os dois em branco.";
  else if (form.openFrom !== "" && form.openFrom > form.openUntil) errors.hours = "O início do horário não pode ser depois do fim.";
  return errors;
}

export function toSettings(form: SettingsForm): ShippingSettings {
  return {
    price: currencyToDecimal(form.price) ?? "0.00",
    etaMinutes: Number(form.eta),
    cepRanges: form.ranges.map((r) => [digits(r.from), digits(r.to)] as const),
    cities: parseCities(form.cities),
    active: form.active,
    openFrom: form.openFrom || null,
    openUntil: form.openUntil || null,
  };
}

/**
 * Cotação de frete da Nuvemshop (WN-4d, WS-16 §8.2): preço, prazo, área (faixas de CEP e cidades), horário e "ativo", mais
 * "Gerar novo endereço de cotação". Fora da área, inativa ou fora do horário, a loja virtual simplesmente não oferece o
 * motoboy.
 */
export function ShippingSettingsSection() {
  const query = useQuery({ queryKey: [...integrationKeys.all, "shipping"], queryFn: ({ signal }) => fetchShippingSettings(signal), retry: false });
  return (
    <section aria-label="Cotação de frete" className="flex flex-col gap-3 border-t border-divider pt-3.5">
      <div>
        <h3 className="type-label-md text-text-secondary">Cotação de frete</h3>
        <p className="type-caption text-pretty text-text-tertiary">O que a loja virtual mostra no checkout quando o cliente escolhe a entrega por motoboy.</p>
      </div>
      {query.isPending ? (
        <Spinner size={20} label="Carregando a cotação" />
      ) : query.isError ? (
        <InlineError message={errorText(query.error)} onRetry={() => void query.refetch()} />
      ) : query.data === null ? (
        <p role="status" className="type-body-sm text-text-secondary">A configuração da cotação ainda não existe: o cadastro não terminou. Use &quot;Refazer cadastro&quot;.</p>
      ) : (
        <SettingsForm key={JSON.stringify(query.data)} initial={query.data} />
      )}
    </section>
  );
}

function SettingsForm({ initial }: { initial: ShippingSettings }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<SettingsForm>(() => toForm(initial));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<"save" | "rotate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const errors = validateSettings(form);
  const edit = (patch: Partial<SettingsForm>) => setForm((current) => ({ ...current, ...patch }));
  const covers = form.ranges.length > 0 || parseCities(form.cities).length > 0;

  const save = async () => {
    setTouched(true);
    if (Object.keys(errors).length > 0 || busy) return;
    setBusy("save");
    setError(null);
    try {
      const saved = await putShippingSettings(toSettings(form));
      queryClient.setQueryData([...integrationKeys.all, "shipping"], saved);
      toast({ title: "Cotação salva." });
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(null);
    }
  };

  const rotate = async () => {
    setBusy("rotate");
    setError(null);
    try {
      await rotateRouteToken();
      toast({ title: "Novo endereço de cotação gerado." });
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Field label="Preço do frete" inputMode="numeric" autoComplete="off" value={form.price} error={touched ? errors.price : undefined} hint="Deixe em branco para frete grátis." onChange={(e) => edit({ price: currencyInput(e.target.value) })} />
      <Field label="Prazo de entrega (minutos)" inputMode="numeric" autoComplete="off" value={form.eta} error={touched ? errors.eta : undefined} onChange={(e) => edit({ eta: e.target.value.replace(/\D/g, "").slice(0, 3) })} />

      <fieldset className="flex flex-col gap-2">
        <legend className="type-label-md mb-1 text-text-secondary">Faixas de CEP atendidas</legend>
        {form.ranges.map((range, index) => (
          <div key={index} className="flex items-end gap-2">
            <Field className="flex-1" label={`CEP inicial da faixa ${index + 1}`} inputMode="numeric" autoComplete="off" value={range.from} onChange={(e) => edit({ ranges: form.ranges.map((r, i) => (i === index ? { ...r, from: maskCep(e.target.value) } : r)) })} />
            <Field className="flex-1" label={`CEP final da faixa ${index + 1}`} inputMode="numeric" autoComplete="off" value={range.to} onChange={(e) => edit({ ranges: form.ranges.map((r, i) => (i === index ? { ...r, to: maskCep(e.target.value) } : r)) })} />
            <Btn kind="ghost" aria-label={`Remover a faixa ${index + 1}`} onClick={() => edit({ ranges: form.ranges.filter((_, i) => i !== index) })}>
              Remover
            </Btn>
          </div>
        ))}
        {touched && errors.ranges && <p role="alert" className="type-caption text-error">{errors.ranges}</p>}
        <div>
          <Btn kind="secondary" disabled={form.ranges.length >= MAX_RANGES} onClick={() => edit({ ranges: [...form.ranges, { from: "", to: "" }] })}>
            Adicionar faixa de CEP
          </Btn>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="nuvemshop-cities" className="type-label-md text-text-secondary">
          Cidades atendidas
        </label>
        <textarea
          id="nuvemshop-cities"
          rows={3}
          value={form.cities}
          onChange={(e) => edit({ cities: e.target.value })}
          className="type-body-sm w-full resize-y rounded-md border border-border bg-surface-variant p-2.5 text-text-primary outline-none focus:border-[1.5px] focus:border-primary"
        />
        <p className="type-caption text-text-tertiary">Uma cidade por linha. O CEP ou a cidade do cliente precisa bater para o checkout oferecer o motoboy.</p>
        {touched && errors.cities && <p role="alert" className="type-caption text-error">{errors.cities}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Atende a partir de" type="time" value={form.openFrom} onChange={(e) => edit({ openFrom: e.target.value })} />
        <Field label="Atende até" type="time" value={form.openUntil} onChange={(e) => edit({ openUntil: e.target.value })} />
      </div>
      {touched && errors.hours ? <p role="alert" className="type-caption text-error">{errors.hours}</p> : <p className="type-caption text-text-tertiary">Horário de São Paulo. Em branco, oferece o dia todo.</p>}

      <Switch label="Oferecer a entrega por motoboy" description="Desligado, o checkout não mostra esta opção." checked={form.active} onCheckedChange={(next) => edit({ active: next })} />
      {form.active && !covers && <p role="status" className="type-caption text-warning">Ligado, mas sem faixa de CEP nem cidade: nenhum cliente é atendido.</p>}
      <p className="type-caption text-pretty text-text-tertiary">{CACHE_NOTICE}</p>

      {error && <InlineError message={error} />}
      <div className="flex flex-wrap gap-2">
        <Btn loading={busy === "save"} disabled={busy !== null} onClick={() => void save()}>
          Salvar cotação
        </Btn>
        <Btn
          kind="secondary"
          loading={busy === "rotate"}
          disabled={busy !== null}
          onClick={() =>
            setConfirm({
              title: "Gerar novo endereço de cotação?",
              description: "O endereço antigo deixa de valer e a Nuvemshop é atualizada com o novo. Faça isso se suspeitar que o endereço vazou.",
              confirmLabel: "Gerar novo endereço",
              onConfirm: () => void rotate(),
            })
          }
        >
          Gerar novo endereço de cotação
        </Btn>
      </div>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
