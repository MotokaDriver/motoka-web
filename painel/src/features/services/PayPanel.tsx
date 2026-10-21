"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { formatMoney } from "@/features/team/model";
import { Btn } from "@/ui/Btn";
import { InlineError } from "@/ui/InlineError";
import { RadioRow } from "@/ui/RadioRow";
import { Spinner } from "@/ui/Spinner";
import { AppLinks } from "@/features/shell/AppLinks";
import { useToast } from "@/ui/Toast";
import { payOrder, type PayWith } from "./api";
import { serviceKeys, useCards, usePayment } from "./hooks";
import { CARD_APP_NOTE, CARD_TYPE_LABEL, PAYMENT_TERMINAL_FAILURE, countdown, formatDateTime, paymentFailure } from "./logic";
import type { Payment } from "./model";

/**
 * Pagamento da taxa de serviço (DN-25): PIX, ou cartão **já salvo pelo app** (`bank_card_id`). Cartão novo só no app:
 * aqui não existe campo de número de cartão. O PIX só vira "pago" com o status `paid` da API (polling), nunca pelo
 * clique em "Já fiz o pagamento". O valor cobrado é só a taxa do Motoka; o motoboy se paga fora do app.
 */
export function PayPanel({
  orderId,
  userId,
  fee,
  startDate,
  onPaid,
}: {
  orderId: string;
  userId: string;
  /** Taxa do app (`internal_fee`), texto decimal. */
  fee: string;
  startDate: string;
  onPaid?: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const cards = useCards(userId);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [cardId, setCardId] = useState<string | null>(null);
  const [created, setCreated] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const polled = usePayment(orderId, created !== null);
  const payment = polled.data ?? created;
  const [openedAt] = useState(() => Date.now());
  const started = Date.parse(startDate) <= openedAt;
  const savedCards = cards.data ?? [];
  const chosenCard = cardId ?? savedCards[0]?.id ?? null;

  const paid = payment?.status === "paid";
  useEffect(() => {
    if (!paid) return;
    toast({ title: "Pagamento confirmado." });
    void queryClient.invalidateQueries({ queryKey: serviceKeys.all });
    onPaid?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paid]);

  const start = async () => {
    if (busy) return;
    const how: PayWith | null = method === "pix" ? { method: "pix" } : chosenCard ? { method: "credit_card", bankCardId: chosenCard } : null;
    if (how === null) return;
    setBusy(true);
    setError(null);
    try {
      setCreated(await payOrder(orderId, how));
    } catch (failure) {
      setError(isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  if (started && !payment) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <h3 className="type-title-md font-bold text-text-primary">Horário do serviço já passou</h3>
        <p className="type-body-sm text-text-secondary">O horário de início deste serviço já passou, então ele não pode mais ser confirmado. Não pague: crie um novo pedido com um horário futuro.</p>
      </div>
    );
  }

  if (payment && paid) {
    return (
      <div role="status" className="flex flex-col gap-1 rounded-lg border border-success/40 bg-success/10 p-4">
        <h3 className="type-title-md font-bold text-text-primary">Pagamento confirmado</h3>
        <p className="type-body-sm text-text-secondary">Agora é só aguardar um motoboy aceitar o serviço.</p>
      </div>
    );
  }

  if (payment) {
    if (PAYMENT_TERMINAL_FAILURE.has(payment.status)) {
      return (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h3 className="type-title-md font-bold text-text-primary">{payment.status === "expired" ? "Código expirado" : "Pagamento não concluído"}</h3>
          <p role="alert" className="type-body-sm text-text-secondary">{paymentFailure(payment)}</p>
          <div>
            <Btn
              kind="secondary"
              onClick={() => {
                setCreated(null);
                void queryClient.removeQueries({ queryKey: serviceKeys.payment(orderId) });
              }}
            >
              Pagar novamente
            </Btn>
          </div>
        </div>
      );
    }
    return payment.method === "pix" ? <PixView payment={payment} onCheck={() => void polled.refetch()} checking={polled.isFetching} /> : <CardWaiting payment={payment} onCheck={() => void polled.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-lg border border-border p-4">
      <div>
        <h3 className="type-title-md font-bold text-text-primary">Pagar a taxa de serviço</h3>
        <p className="type-body-sm text-text-tertiary">
          {`Cobramos ${formatMoney(fee)} para confirmar o pedido. Os motoboys são pagos por você, fora do app.`}
        </p>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Forma de pagamento</legend>
        <RadioRow name="pay-method" checked={method === "pix"} onChange={() => setMethod("pix")} label="PIX" hint="Pagamento instantâneo via QR Code" />
        <RadioRow name="pay-method" checked={method === "card"} onChange={() => setMethod("card")} label="Cartão de crédito salvo" hint="Use um cartão já cadastrado no app" />
      </fieldset>
      {method === "card" && (
        <div className="flex flex-col gap-2">
          {cards.isPending ? (
            <Spinner size={20} label="Carregando os cartões" />
          ) : cards.isError ? (
            <InlineError message="Não foi possível carregar os cartões. Tente novamente." onRetry={() => void cards.refetch()} />
          ) : savedCards.length > 0 ? (
            <ul aria-label="Cartões salvos" className="flex flex-col gap-1.5">
              {savedCards.map((card) => (
                <li key={card.id}>
                  <div className="rounded-md border border-border px-3 py-2">
                    <RadioRow name="pay-card" checked={chosenCard === card.id} onChange={() => setCardId(card.id)} label={`${CARD_TYPE_LABEL(card.type)} · ${card.mask}`} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-body-sm text-text-secondary">Nenhum cartão salvo.</p>
          )}
          <p className="type-caption text-text-tertiary">{CARD_APP_NOTE}</p>
          <AppLinks />
        </div>
      )}
      {error && <InlineError message={error} />}
      <div>
        <Btn loading={busy} disabled={method === "card" && chosenCard === null} onClick={() => void start()}>
          {`Pagar ${formatMoney(fee) ?? ""}`.trim()}
        </Btn>
      </div>
    </div>
  );
}

function CardWaiting({ payment, onCheck }: { payment: Payment; onCheck: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4" role="status" aria-live="polite">
      <h3 className="type-title-md font-bold text-text-primary">Processando pagamento</h3>
      <p className="type-body-sm text-text-secondary">{`Aguarde até o pagamento de ${formatMoney(payment.amount) ?? ""} ser processado. A confirmação pode demorar um pouco; você pode acompanhar na lista de serviços.`}</p>
      <div>
        <Btn kind="secondary" onClick={onCheck}>
          Verificar novamente
        </Btn>
      </div>
    </div>
  );
}

function PixView({ payment, onCheck, checking }: { payment: Payment; onCheck: () => void; checking: boolean }) {
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const left = countdown(payment.expiresAt, now);
  const expired = payment.expiresAt !== null && left === null;
  const minutes = left ? Number(left.slice(0, 2)) + (left.slice(3) === "00" ? 0 : 1) : 0;

  const copy = async () => {
    if (!payment.copyPaste) return;
    try {
      await navigator.clipboard.writeText(payment.copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
      toast({ title: "Código PIX copiado." });
    } catch {
      toast({ title: "Não foi possível copiar. Selecione o código e copie." });
    }
  };

  if (!payment.copyPaste && !payment.qrImage) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <h3 className="type-title-md font-bold text-text-primary">Código indisponível</h3>
        <p role="alert" className="type-body-sm text-text-secondary">Não foi possível gerar o código PIX. Tente novamente.</p>
      </div>
    );
  }
  if (expired) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
        <h3 className="type-title-md font-bold text-text-primary">Código expirado</h3>
        <p role="alert" className="type-body-sm text-text-secondary">Este código PIX expirou. Acompanhe o pedido na lista de serviços ou gere um novo.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="type-title-md font-bold text-text-primary">Pagamento via PIX</h3>
        <p className="type-body-sm text-text-tertiary">{`Valor a pagar: ${formatMoney(payment.amount) ?? ""}`}</p>
      </div>
      {payment.qrImage && (
        // Fundo branco fixo: o leitor de QR precisa de contraste, em qualquer tema.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={payment.qrImage} alt="QR Code do PIX" width={220} height={220} className="mx-auto rounded-md bg-white p-2" />
      )}
      {payment.copyPaste && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pix-copy" className="type-label-md text-text-secondary">PIX copia e cola</label>
          <textarea id="pix-copy" readOnly rows={3} value={payment.copyPaste} className="type-caption w-full resize-none rounded-md border border-border bg-surface-variant p-2 font-mono text-text-primary" />
          <div>
            <Btn kind="secondary" icon={copied ? "check" : "content_copy"} onClick={() => void copy()}>
              {copied ? "Copiado" : "Copiar código PIX"}
            </Btn>
          </div>
        </div>
      )}
      {left && (
        <>
          <p aria-hidden className="type-body-sm text-text-secondary">{`Este código expira em ${left}`}</p>
          <p className="sr-only" role="status" aria-live="polite">{`O código expira em cerca de ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`}</p>
        </>
      )}
      {payment.expiresAt && <p className="type-caption text-text-tertiary">{`Válido até ${formatDateTime(payment.expiresAt)}.`}</p>}
      <p role="status" className="type-body-sm flex items-center gap-2 text-text-secondary">
        <Spinner size={16} />
        Aguardando confirmação do pagamento...
      </p>
      <div>
        <Btn kind="ghost" loading={checking} onClick={onCheck}>
          Já fiz o pagamento
        </Btn>
      </div>
      <p className="type-caption text-text-tertiary">O pedido só é confirmado quando o banco avisa o pagamento: este botão apenas confere de novo.</p>
    </div>
  );
}
