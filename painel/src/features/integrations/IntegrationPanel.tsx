"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { relativeTime } from "@/features/notices/logic";
import { currencyInput, currencyToDecimal, formatMoney } from "@/features/team/model";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { Btn } from "@/ui/Btn";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { Field } from "@/ui/Field";
import { InlineError } from "@/ui/InlineError";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { disconnectIntegration, issueCredentials, saveIntegration, testConnection } from "./api";
import { CopyField } from "./CopyField";
import { integrationKeys, useDetail } from "./hooks";
import { TYPE_INFO, testSummary, validateMerchant, validateWebhook } from "./logic";
import type { Detail, IntegrationType, Issued, TestResult } from "./model";

const errorText = (failure: unknown): string => (isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE);

/** Campo da API que o erro aponta, para mostrar o texto fixo junto do campo. */
function fieldOf(code: string | null): "merchant" | "webhook" | null {
  if (code === "INTEGRATION_MERCHANT_ID_TAKEN" || code === "INTEGRATION_MERCHANT_ID_INVALID") return "merchant";
  if (code === "INTEGRATION_WEBHOOK_URL_INVALID") return "webhook";
  return null;
}

/**
 * Painel de uma integração "operador" (Open Delivery e Saipos): Merchant ID, URL de eventos e preço, credenciais, teste,
 * saúde e desconexão. O secret recém-gerado fica no estado deste componente (e some quando ele sai da tela); nunca vai
 * para o cache de queries, storage, log, toast ou URL.
 */
export function IntegrationPanel({ type, saved }: { type: IntegrationType; saved: boolean }) {
  const info = TYPE_INFO[type];
  // Sem nada salvo (o card diz `state: null`), não há o que buscar: o formulário nasce vazio, sem um 404 à toa.
  const query = useDetail(type, saved);
  const [issued, setIssued] = useState<Issued | null>(null);

  if (!info) return null;
  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <p className="type-label-md text-text-tertiary">{info.kind}</p>
        <h2 className="type-title-lg mt-1 font-bold text-text-primary">{info.name}</h2>
        <p className="type-body-sm mt-1.5 text-pretty text-text-secondary">{info.how}</p>
      </div>
      {saved && query.isPending ? (
        <div className="grid place-items-center py-10 text-primary-text">
          <Spinner size={24} label="Carregando a integração" />
        </div>
      ) : query.isError && saved ? (
        <InlineError message={errorText(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <Body type={type} detail={query.data ?? null} issued={issued} onIssued={setIssued} />
      )}
    </div>
  );
}

function Body({ type, detail, issued, onIssued }: { type: IntegrationType; detail: Detail | null; issued: Issued | null; onIssued: (issued: Issued | null) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [busy, setBusy] = useState<"issue" | "test" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const operator = TYPE_INFO[type]?.operator === true;
  const connected = detail?.status === "connected";
  const refresh = () => queryClient.invalidateQueries({ queryKey: integrationKeys.all });

  const issue = async () => {
    setBusy("issue");
    setError(null);
    try {
      // Fora do TanStack Query de propósito: uma mutação guarda o resultado no cache em memória.
      onIssued(await issueCredentials(type));
      await refresh();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(null);
    }
  };

  const runTest = async () => {
    setBusy("test");
    setError(null);
    setTest(null);
    try {
      setTest(await testConnection(type));
      await refresh();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setError(null);
    try {
      await disconnectIntegration(type);
      onIssued(null);
      setTest(null);
      toast({ title: "Integração desconectada." });
      await refresh();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ConfigForm key={`${type}:${detail?.externalMerchantId ?? ""}:${detail?.webhookUrl ?? ""}:${detail?.deliveryPrice ?? ""}`} type={type} detail={detail} />

      {detail && operator && (
        <div className="flex flex-col gap-3.5">
          <CopyField label="URL do operador logístico" value={detail.operatorBaseUrl} />
          <CopyField label="URL do token" value={detail.tokenUrl} />
          {detail.clientId && <CopyField label="Client ID" value={issued?.clientId ?? detail.clientId} />}
          {issued ? (
            <div role="alert" className="flex flex-col gap-2.5 rounded-lg border border-warning/50 bg-warning/10 p-3.5">
              <p className="type-body-sm font-semibold text-text-primary">Copie o secret agora: ele não aparece de novo. Se perder, gere outro.</p>
              <CopyField label="Client secret" value={issued.clientSecret} secret />
              <div>
                <Btn kind="secondary" onClick={() => onIssued(null)}>
                  Já copiei, esconder
                </Btn>
              </div>
            </div>
          ) : (
            connected && detail.secretHint && (
              <div className="flex flex-col gap-1.5">
                <span className="type-label-md text-text-secondary">Client secret</span>
                <p className="type-body-sm rounded-md border border-border bg-surface-variant px-3 py-2.5 font-mono text-text-secondary">{`••••••••••••${detail.secretHint}`}</p>
                <p className="type-caption text-text-tertiary">O secret só aparece uma vez, quando é gerado.</p>
              </div>
            )
          )}
          <p className="type-caption text-pretty text-text-tertiary">
            As credenciais são só desta loja. Gerar um secret novo derruba a conexão até você colar o novo no seu sistema.
          </p>
          <div className="flex flex-wrap gap-2">
            {connected ? (
              <Btn
                kind="secondary"
                icon="sync"
                loading={busy === "issue"}
                disabled={busy !== null}
                onClick={() =>
                  setConfirm({
                    title: "Gerar novo secret?",
                    description: "A conexão atual para de funcionar até você colar o novo secret no seu sistema.",
                    confirmLabel: "Gerar novo secret",
                    onConfirm: () => void issue(),
                  })
                }
              >
                Gerar novo secret
              </Btn>
            ) : (
              <Btn loading={busy === "issue"} disabled={busy !== null} onClick={() => void issue()}>
                Gerar credenciais
              </Btn>
            )}
            {operator && type === "open_delivery" && (
              <Btn kind="secondary" icon="check" loading={busy === "test"} disabled={busy !== null} onClick={() => void runTest()}>
                Testar conexão
              </Btn>
            )}
            {connected && (
              <Btn
                kind="danger"
                icon="link"
                disabled={busy !== null}
                onClick={() =>
                  setConfirm({
                    title: "Desconectar a integração?",
                    description: "O secret é apagado, os tokens emitidos caem na hora e os eventos pendentes são descartados. Reconectar gera um secret novo.",
                    confirmLabel: "Desconectar",
                    danger: true,
                    onConfirm: () => void disconnect(),
                  })
                }
              >
                Desconectar
              </Btn>
            )}
          </div>
        </div>
      )}
      {!detail && operator && <p className="type-caption text-text-tertiary">Salve o Merchant ID para gerar as credenciais.</p>}
      {test && <TestBlock result={test} />}
      {error && <InlineError message={error} />}
      {detail && <HealthBlock detail={detail} />}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}

function TestBlock({ result }: { result: TestResult }) {
  const summary = testSummary(result);
  return (
    <div role="status" className={`rounded-md border p-3 ${summary.ok ? "border-success/40 bg-success/10" : "border-error/40 bg-error/10"}`}>
      <p className="type-body-sm font-semibold text-text-primary">{summary.ok ? "Conexão ok" : "Não conectou"}</p>
      <p className="type-body-sm text-text-secondary">{summary.text}</p>
      <p className="type-caption mt-1 text-text-tertiary">
        {`Último token: ${result.lastTokenAt ? relativeTime(result.lastTokenAt, new Date()) : "nunca"} · último envio aceito: ${result.lastOutboundOkAt ? relativeTime(result.lastOutboundOkAt, new Date()) : "nunca"}`}
      </p>
    </div>
  );
}

function HealthBlock({ detail }: { detail: Detail }) {
  const now = new Date();
  const when = (iso: string | null) => (iso ? relativeTime(iso, now) : "nunca");
  const rows: Array<[string, string]> = [
    ["Último token pedido", when(detail.health.lastTokenAt)],
    ["Último pedido recebido", when(detail.health.lastInboundAt)],
    ["Último envio aceito", when(detail.health.lastOutboundOkAt)],
    ["Eventos na fila", String(detail.health.pendingEvents)],
    ["Falhas nas últimas 24 h", String(detail.health.deadEvents24h)],
  ];
  return (
    <section aria-label="Saúde da integração" className="flex flex-col gap-1.5 border-t border-divider pt-3">
      <h3 className="type-label-md text-text-secondary">Saúde</h3>
      <dl className="flex flex-col gap-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="type-body-sm text-text-secondary">{label}</dt>
            <dd className="type-body-sm font-semibold text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      {detail.health.deadEvents24h > 0 && (
        <p role="alert" className="type-caption text-error">Alguns eventos não chegaram ao seu sistema. Confira a URL de eventos e o teste de conexão.</p>
      )}
    </section>
  );
}

/** Merchant ID, URL de eventos e preço. Só manda o que a loja preencheu; quem decide se vale é a API. */
function ConfigForm({ type, detail }: { type: IntegrationType; detail: Detail | null }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const od = type === "open_delivery";
  const [merchant, setMerchant] = useState(detail?.externalMerchantId ?? "");
  const [webhook, setWebhook] = useState(detail?.webhookUrl ?? "");
  const [price, setPrice] = useState(() => (detail && Number(detail.deliveryPrice) > 0 ? currencyInput(detail.deliveryPrice.replace(".", "")) : ""));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: "merchant" | "webhook" | null; message: string } | null>(null);

  const merchantError = validateMerchant(type, merchant);
  const webhookError = od ? validateWebhook(webhook) : null;
  const priceDecimal = od ? (currencyToDecimal(price) ?? "0.00") : "0.00";
  const priceError = od && Number(priceDecimal) > 9999.99 ? "O valor máximo é R$ 9.999,99." : null;

  const save = async () => {
    setTouched(true);
    if (merchantError || webhookError || priceError || busy) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveIntegration(type, { merchantId: merchant.trim(), webhookUrl: od && webhook.trim() ? webhook.trim() : null, deliveryPrice: priceDecimal });
      queryClient.setQueryData(integrationKeys.detail(type), saved);
      toast({ title: "Integração salva." });
      await queryClient.invalidateQueries({ queryKey: integrationKeys.all });
    } catch (failure) {
      setError({ field: isApiError(failure) ? fieldOf(failure.code) : null, message: errorText(failure) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <Field
        label={type === "saipos" ? "Merchant ID que a Saipos mostrou" : "Merchant ID que o seu sistema mostrou"}
        hint="É assim que cada entrega chega na loja certa."
        autoComplete="off"
        spellCheck={false}
        value={merchant}
        error={(touched ? (merchantError ?? undefined) : undefined) ?? (error?.field === "merchant" ? error.message : undefined)}
        onChange={(event) => setMerchant(event.target.value)}
      />
      {od ? (
        <>
          <Field
            label="URL de eventos (webhook)"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://"
            hint="Para onde o Motoka manda cada status e a posição do motoboy. Só https, na porta 443 ou 8443."
            value={webhook}
            error={(touched ? (webhookError ?? undefined) : undefined) ?? (error?.field === "webhook" ? error.message : undefined)}
            onChange={(event) => setWebhook(event.target.value)}
          />
          <Field
            label="Preço da entrega informado ao sistema"
            inputMode="numeric"
            autoComplete="off"
            hint={`Equipe própria: o Motoka não cobra por entrega, então o padrão é ${formatMoney("0.00")}. É o valor que o sistema mostra como custo da logística.`}
            value={price}
            error={touched ? (priceError ?? undefined) : undefined}
            onChange={(event) => setPrice(currencyInput(event.target.value))}
          />
        </>
      ) : (
        <p className="type-caption text-pretty text-text-tertiary">A Saipos usa a taxa de entrega e a URL de eventos configuradas no Motoka e nela; aqui só vai o Merchant ID.</p>
      )}
      {error && error.field === null && <InlineError message={error.message} />}
      <div>
        <Btn kind="secondary" loading={busy} onClick={() => void save()}>
          Salvar
        </Btn>
      </div>
    </div>
  );
}
