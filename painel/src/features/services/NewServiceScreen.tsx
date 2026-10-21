"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "@/features/session/useSession";
import { currencyInput, formatMoney } from "@/features/team/model";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Paths } from "@/lib/routing/routes";
import { Btn } from "@/ui/Btn";
import { Card } from "@/ui/Card";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { Field } from "@/ui/Field";
import { InlineError } from "@/ui/InlineError";
import { PageHead } from "@/ui/PageHead";
import { SelectField } from "@/ui/SelectField";
import { createOrder, reviewOrder } from "./api";
import { serviceKeys } from "./hooks";
import { CANCEL_NOTICE, TYPE_LABEL, formatDateTime } from "./logic";
import { emptyForm, fieldForError, maxDay, minDay, toInput, usesPerDelivery, usesValue, validate, type FormKey, type ServiceForm } from "./newService";
import type { Order, OrderType } from "./model";
import { PayPanel } from "./PayPanel";

const TYPES: readonly OrderType[] = ["fixed_value", "per_delivery", "fixed_plus_per_delivery"];

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="type-body-sm text-text-secondary">{label}</dt>
      <dd className={strong ? "type-title-md font-bold text-text-primary" : "type-body-md font-semibold text-text-primary"}>{value}</dd>
    </div>
  );
}

/** "Solicitar serviço" (`/servicos/novo/`): formulário, resumo com a prévia da API e o pagamento da taxa. */
export function NewServiceScreen() {
  const session = useSession();
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiField, setApiField] = useState<{ key: FormKey; message: string } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [created, setCreated] = useState<Order | null>(null);
  const [paid, setPaid] = useState(false);

  const userId = session.status === "authenticated" ? session.user.id : "";
  const errors = validate(form, now);
  const input = toInput(form, userId, now);
  const edit = (patch: Partial<ServiceForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setApiField(null);
    setError(null);
  };
  const fieldError = (key: FormKey): string | undefined => (touched ? errors[key] : undefined) ?? (apiField?.key === key ? apiField.message : undefined);

  // Prévia da API: a taxa e o total vêm do servidor, nada é calculado aqui.
  const review = useQuery({
    queryKey: ["services", "review", input?.type, input?.requestedDrivers, input?.value, input?.pricePerDelivery],
    queryFn: ({ signal }) => reviewOrder(input as NonNullable<typeof input>, signal),
    enabled: input !== null && created === null,
    retry: false,
    staleTime: 30_000,
  });

  const submit = async () => {
    if (!input || busy) return;
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder(input);
      setCreated(order);
      await queryClient.invalidateQueries({ queryKey: serviceKeys.all });
    } catch (failure) {
      if (isApiError(failure)) {
        const key = fieldForError(failure.code);
        if (key) setApiField({ key, message: failure.text() });
        else setError(failure.text());
      } else {
        setError(UNKNOWN_MESSAGE);
      }
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    const exempt = Number(created.internalFee) === 0;
    return (
      <>
        <PageHead title="Solicitar serviço" sub="Confirme a taxa de serviço para publicar o pedido" />
        <div className="mx-5 flex max-w-[520px] flex-col gap-4 pb-7 lg:mx-7">
          {exempt || paid ? (
            <Card className="flex flex-col gap-2 p-5">
              <h2 role="status" className="type-title-lg font-bold text-text-primary">Serviço solicitado com sucesso!</h2>
              <p className="type-body-md text-text-secondary">Agora só aguardar até um motoboy aceitar sua proposta.</p>
            </Card>
          ) : (
            <>
              <p className="type-body-md text-text-secondary">O pedido foi criado e só aparece para os motoboys depois do pagamento da taxa.</p>
              <PayPanel orderId={created.id} userId={userId} fee={created.internalFee} startDate={created.startDate} onPaid={() => setPaid(true)} />
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href={`${Paths.services}?pedido=${created.id}`} className="type-label-lg inline-flex min-h-11 items-center rounded-md border border-primary bg-primary px-4 py-2.5 text-on-primary hover:bg-primary-dark">
              Ver o serviço
            </Link>
            <Link href={Paths.services} className="type-label-lg inline-flex min-h-11 items-center rounded-md border border-border px-4 py-2.5 text-text-primary hover:bg-surface-variant">
              Voltar para os serviços
            </Link>
          </div>
        </div>
      </>
    );
  }

  const summary = review.data;
  const startShown = input ? formatDateTime(input.startDate) : "";
  const endShown = input ? formatDateTime(input.endDate) : "";

  return (
    <>
      <PageHead title="Solicitar serviço" sub="Contrate motoboys avulsos por um período" />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!input) return;
          setConfirm({
            title: "Confirmar solicitação",
            description: `${CANCEL_NOTICE}`,
            confirmLabel: "Confirmar solicitação",
            cancelLabel: "Voltar",
            onConfirm: () => void submit(),
          });
        }}
        className="grid items-start gap-5 px-5 pb-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-7"
      >
        <Card className="flex flex-col gap-4 p-5">
          <h2 className="type-title-md font-bold text-text-primary">Período do serviço</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data de início" type="date" min={minDay(now)} max={maxDay(now)} value={form.startDay} error={fieldError("startDay")} onChange={(e) => edit({ startDay: e.target.value, endDay: form.endDay === "" || form.endDay < e.target.value ? e.target.value : form.endDay })} />
            <Field label="Horário de início" type="time" value={form.startTime} error={fieldError("startTime")} onChange={(e) => edit({ startTime: e.target.value })} />
            <Field label="Data de fim" type="date" min={form.startDay || minDay(now)} max={maxDay(now)} value={form.endDay} error={fieldError("endDay")} onChange={(e) => edit({ endDay: e.target.value })} />
            <Field label="Horário de fim" type="time" value={form.endTime} error={fieldError("endTime")} onChange={(e) => edit({ endTime: e.target.value })} />
          </div>
          <Field
            label="Quantidade de motoboys"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ex: 3"
            value={form.drivers}
            error={fieldError("drivers")}
            onChange={(e) => edit({ drivers: e.target.value.replace(/\D/g, "").slice(0, 3) })}
          />
          <SelectField label="Tipo de serviço" value={form.type} onChange={(e) => edit({ type: e.target.value as OrderType | "", value: "", perDelivery: "" })}>
            <option value="">Selecione</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}
              </option>
            ))}
          </SelectField>
          {fieldError("type") && <p role="alert" className="type-caption -mt-2 text-error">{fieldError("type")}</p>}
          {usesValue(form.type) && (
            <Field label="Valor por motoboy" inputMode="numeric" autoComplete="off" value={form.value} error={fieldError("value")} onChange={(e) => edit({ value: currencyInput(e.target.value) })} />
          )}
          {usesPerDelivery(form.type) && (
            <Field label={form.type === "per_delivery" ? "Valor por entrega" : "Bônus por entrega"} inputMode="numeric" autoComplete="off" value={form.perDelivery} error={fieldError("perDelivery")} onChange={(e) => edit({ perDelivery: currencyInput(e.target.value) })} />
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-5 lg:sticky lg:top-4">
          <h2 className="type-title-md font-bold text-text-primary">Resumo do pedido</h2>
          {input ? (
            <dl className="flex flex-col gap-2">
              <Line label="Início" value={startShown} />
              <Line label="Fim" value={endShown} />
              <Line label="Quantidade de motoboys" value={String(input.requestedDrivers)} />
              {input.value && <Line label="Valor por motoboy" value={formatMoney(input.value) ?? ""} />}
              {input.pricePerDelivery && <Line label="Valor por entrega" value={formatMoney(input.pricePerDelivery) ?? ""} />}
              {summary && input.type !== "per_delivery" && <Line label={input.type === "fixed_value" ? "Total a pagar aos motoboys" : "Total do valor fixo"} value={formatMoney(summary.totalValue) ?? ""} />}
              {summary ? (
                <Line label="Taxa de serviço" value={Number(summary.amountToPay) === 0 ? "Isento" : (formatMoney(summary.amountToPay) ?? "")} strong />
              ) : review.isError ? (
                <InlineError message={isApiError(review.error) ? review.error.text() : UNKNOWN_MESSAGE} onRetry={() => void review.refetch()} />
              ) : (
                <p className="type-caption text-text-tertiary">Calculando a taxa de serviço...</p>
              )}
            </dl>
          ) : (
            <p className="type-body-sm text-text-tertiary">Preencha o período, a quantidade e o valor para ver o resumo.</p>
          )}
          <p className="type-caption text-text-secondary">
            A única cobrança do Motoka é a taxa de serviço. Os valores dos motoboys você paga a eles, fora do app. A forma de pagamento da taxa (PIX ou cartão salvo) é escolhida logo depois de solicitar.
          </p>
          {error && <InlineError message={error} />}
          <Btn type="submit" loading={busy} full>
            Solicitar
          </Btn>
        </Card>
      </form>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

