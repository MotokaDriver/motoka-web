"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { APP_ENV } from "@/lib/env";
import { trustedUrl, whatsappLink } from "@/lib/links/links";
import { spDay } from "@/lib/time/saoPaulo";
import { addDays } from "@/lib/time/saoPaulo";
import { Avatar } from "@/ui/Avatar";
import { Btn } from "@/ui/Btn";
import { Chip, type Tone } from "@/ui/Chip";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { Dialog } from "@/ui/Dialog";
import { Field } from "@/ui/Field";
import { Icon } from "@/ui/Icon";
import { InlineError } from "@/ui/InlineError";
import { Label } from "@/ui/Label";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { createNominalInvite, fetchInviteLink, fetchInvites, resendInvite, revokeInvite, rotateInviteLink } from "./api";
import {
  INVITE_STATUS_LABEL,
  formatPhone,
  inviteCanResend,
  inviteDisplayName,
  inviteIsActive,
  phoneInput,
  type Invite,
  type InviteCreated,
  type InviteStatus,
} from "./model";
import { QrCode } from "./QrCode";

export const CREATED_VISIBLE_MS = 60_000;
export const COPIED_VISIBLE_MS = 2_000;

export const LINK_UNAVAILABLE = "Não foi possível gerar o link agora.";

/**
 * O link do convite vem da API e vira texto, QR, área de transferência e mensagem de WhatsApp: só vale
 * se for https (ou http://localhost fora de prod) e do host do próprio painel, que serve /convite/ (§6.2).
 * Inválido vira `""`, e a tela mostra que o link não está disponível.
 */
export function checkedInviteUrl(url: string): string {
  return trustedUrl(url, window.location.host, { allowLocalhost: APP_ENV !== "prod" }) ?? "";
}

const withoutScheme = (url: string) => url.replace(/^https?:\/\//, "");
const errorOf = (error: unknown) => (isApiError(error) ? error.text() : UNKNOWN_MESSAGE);

const TONE: Partial<Record<InviteStatus, Tone>> = { opened: "info", accepted: "success", declined: "error" };

/** "hoje", "ontem" ou "dd/MM", pelo dia de São Paulo. */
function ago(createdAt: string | null, now: Date): string {
  if (!createdAt) return "";
  const created = new Date(createdAt);
  const day = spDay(created);
  const today = spDay(now);
  if (day === today) return "hoje";
  if (day === addDays(today, -1)) return "ontem";
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

/** Modal "Convidar motoboy": link da loja, QR, convite pelo nome e lista de enviados. */
export function InviteModal({
  open,
  storeName,
  resend,
  onClose,
}: {
  open: boolean;
  storeName: string;
  /** Convite a reenviar assim que o modal abrir (vem do "Reenviar convite" da grade). */
  resend: Invite | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      size="lg"
      title="Convidar motoboy"
      description="Quem entrar por este link vai direto para a sua equipe"
    >
      {open && <InviteBody storeName={storeName} resend={resend} />}
    </Dialog>
  );
}

function InviteBody({ storeName, resend }: { storeName: string; resend: Invite | null }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const link = useQuery({ queryKey: ["team", "invite-link"], queryFn: ({ signal }) => fetchInviteLink(signal), gcTime: 0, retry: false, select: (data) => ({ ...data, url: checkedInviteUrl(data.url) }) });
  const invites = useQuery({ queryKey: ["team", "invites"], queryFn: ({ signal }) => fetchInvites(signal), gcTime: 0, retry: false });

  const [created, setCreated] = useState<InviteCreated | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => new Date());

  // O token de um convite nominal fica na tela por 1 minuto e é esquecido.
  useEffect(() => {
    if (!created) return;
    const timer = setTimeout(() => setCreated(null), CREATED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [created]);

  // "Copiado" volta a "Copiar" em 2 s.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const reloadInvites = () => queryClient.invalidateQueries({ queryKey: ["team", "invites"] });

  const rotate = useMutation({
    mutationFn: rotateInviteLink,
    onSuccess: (next) => queryClient.setQueryData(["team", "invite-link"], next),
    onError: (error) => setActionError(errorOf(error)),
  });

  const invite = useMutation({
    mutationFn: (input: { name: string; phone: string }) => createNominalInvite(input.name, input.phone),
    onSuccess: (next) => {
      setCreated({ ...next, url: checkedInviteUrl(next.url) });
      toast({ title: "Convite criado." });
      void reloadInvites();
    },
    onError: (error) => setActionError(errorOf(error)),
  });

  const runOnInvite = async (id: string, action: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(id);
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(errorOf(error));
    } finally {
      setBusyId(null);
      void reloadInvites();
    }
  };

  const doResend = (target: Invite) =>
    runOnInvite(target.id, async () => {
      const next = await resendInvite(target.id);
      setCreated({ ...next, url: checkedInviteUrl(next.url) });
    });

  const doRevoke = (target: Invite) =>
    runOnInvite(target.id, async () => {
      await revokeInvite(target.id);
      // O link de um convite cancelado não pode continuar sendo oferecido.
      setCreated((current) => (current?.id === target.id ? null : current));
    });

  const resendOnce = useRef(false);
  useEffect(() => {
    if (!resend || resendOnce.current) return;
    resendOnce.current = true;
    void doResend(resend);
    // Uma vez por abertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resend]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copiado." });
    } catch {
      toast({ title: "Não foi possível copiar. Selecione o link e copie." });
    }
  };

  const linkData = link.data;
  const linkOk = linkData !== undefined && linkData.url !== "";
  const linkWhatsapp = linkOk
    ? whatsappLink(`Oi! Entre na equipe de entregas da ${storeName} pelo Motoka: ${linkData.url}`)
    : null;

  return (
    <div className="-mx-7 mt-5 border-t border-divider">
      <div className="grid gap-6 p-6 min-[560px]:grid-cols-[minmax(0,1fr)_168px]">
        <div className="flex min-w-0 flex-col gap-4">
          {link.isPending ? (
            <div className="grid h-12 place-items-center text-primary-text">
              <Spinner size={24} label="Carregando o link" />
            </div>
          ) : link.isError ? (
            <InlineError message="Não foi possível gerar o link de convite. Tente novamente." onRetry={() => void link.refetch()} />
          ) : !linkOk ? (
            <InlineError message={LINK_UNAVAILABLE} onRetry={() => void link.refetch()} />
          ) : (
            <div className="flex flex-col gap-2">
              <span className="type-body-sm text-text-secondary">Link de convite</span>
              <div className="flex gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface-variant px-3">
                  <span className="text-primary-text">
                    <Icon name="link" size={18} />
                  </span>
                  <span
                    title={linkData?.url}
                    className="type-body-md min-w-0 flex-1 select-all truncate font-mono"
                    data-testid="invite-link"
                  >
                    {withoutScheme(linkData?.url ?? "")}
                  </span>
                </div>
                <Btn kind="secondary" icon={copied ? "check" : "content_copy"} onClick={() => linkData && void copy(linkData.url)}>
                  {copied ? "Copiado" : "Copiar"}
                </Btn>
              </div>
            </div>
          )}
          <a
            href={linkWhatsapp ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!linkWhatsapp}
            className="type-label-lg inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-success px-4 py-2.5 font-semibold text-black aria-disabled:pointer-events-none aria-disabled:opacity-60"
          >
            <Icon name="chat" size={18} />
            Enviar pelo WhatsApp
          </a>
          <div className="flex items-center gap-3">
            <Btn
              kind="ghost"
              disabled={!linkData || rotate.isPending}
              onClick={() =>
                setConfirm({
                  title: "Gerar um novo link?",
                  description: "O link atual para de funcionar. Quem já entrou continua na equipe.",
                  confirmLabel: "Gerar novo link",
                  onConfirm: () => {
                    setActionError(null);
                    rotate.mutate();
                  },
                })
              }
            >
              Gerar novo link
            </Btn>
            {linkData && linkData.joinsLast24h > 0 && (
              <span className="type-caption text-text-tertiary">
                {linkData.joinsLast24h === 1 ? "1 entrada nas últimas 24 h" : `${linkData.joinsLast24h} entradas nas últimas 24 h`}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3.5">
            <Rule icon="group" tone="text-info" strong="Entregas da sua loja:">
              entra só com nome e telefone. Sem verificação de documentos.
            </Rule>
            <Rule icon="verified_user" tone="text-warning" strong="Entregas avulsas de outras lojas:">
              ele precisa passar pelo KYC no app.
            </Rule>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div role="img" aria-label="QR code do link de convite" className="grid size-[168px] place-items-center rounded-lg bg-white p-2">
            {linkOk && <QrCode value={linkData.url} />}
          </div>
          <p className="type-caption text-center text-text-tertiary">Para imprimir e colar no balcão</p>
        </div>
      </div>

      <NominalSection
        sending={invite.isPending}
        created={created}
        storeName={storeName}
        error={actionError}
        onSubmit={(name, phone) => {
          setActionError(null);
          invite.mutate({ name, phone });
        }}
      />

      <div className="border-t border-divider px-6 pb-5 pt-4">
        <Label as="h3">Convites enviados</Label>
        <div className="mt-3">
          {invites.isPending ? (
            <div className="grid place-items-center py-2 text-primary-text">
              <Spinner size={24} label="Carregando os convites" />
            </div>
          ) : invites.isError ? (
            <InlineError message="Não foi possível carregar os convites. Tente novamente." onRetry={() => void invites.refetch()} />
          ) : invites.data.length === 0 ? (
            <p className="type-body-md text-text-tertiary">Nenhum convite enviado ainda.</p>
          ) : (
            <ul className="flex flex-col">
              {invites.data.map((item) => (
                <InviteTile
                  key={item.id}
                  invite={item}
                  now={now}
                  busy={busyId === item.id}
                  onResend={() => void doResend(item)}
                  onRevoke={() =>
                    setConfirm({
                      title: "Cancelar o convite?",
                      description: `O link enviado para ${inviteDisplayName(item)} para de funcionar.`,
                      confirmLabel: "Cancelar convite",
                      cancelLabel: "Voltar",
                      danger: true,
                      onConfirm: () => void doRevoke(item),
                    })
                  }
                />
              ))}
            </ul>
          )}
        </div>
      </div>
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

function Rule({ icon, tone, strong, children }: { icon: "group" | "verified_user"; tone: string; strong: string; children: string }) {
  return (
    <p className="type-body-sm flex gap-2.5 text-text-secondary">
      <span className={tone}>
        <Icon name={icon} size={20} />
      </span>
      <span>
        <b className="font-bold text-text-primary">{strong}</b> {children}
      </span>
    </p>
  );
}

function NominalSection({
  sending,
  created,
  storeName,
  error,
  onSubmit,
}: {
  sending: boolean;
  created: InviteCreated | null;
  storeName: string;
  error: string | null;
  onSubmit: (name: string, phone: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const valid = name.trim() !== "" && phone.replace(/\D/g, "").length >= 10;
  const firstName = created?.inviteeName.trim().split(/\s+/)[0] ?? "";
  const whatsapp = created && created.url !== ""
    ? whatsappLink(`Oi, ${firstName}! A ${storeName} te convidou para a equipe de entregas no Motoka: ${created.url}`, created.inviteePhone)
    : null;

  // Limpa os campos quando o convite é criado.
  const lastCreated = useRef<string | null>(null);
  useEffect(() => {
    if (created && created.id !== lastCreated.current) {
      lastCreated.current = created.id;
      setName("");
      setPhone("");
    }
  }, [created]);

  return (
    <form
      className="flex flex-col gap-3 border-t border-divider px-6 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid && !sending) onSubmit(name, phone);
      }}
    >
      <Label as="h3">Convidar pelo nome</Label>
      <div className="grid items-start gap-2 min-[560px]:grid-cols-[1fr_1fr_auto]">
        <Field label="Nome" maxLength={256} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
        <Field
          label="Celular"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(event) => setPhone(phoneInput(event.target.value))}
        />
        <Btn type="submit" icon="person_add" loading={sending} disabled={!valid} className="min-[560px]:mt-7">
          Convidar
        </Btn>
      </div>
      {error && <InlineError message={error} />}
      {created && (
        <div className="flex items-center gap-3 rounded-md border border-success/40 bg-success/10 p-3">
          <div className="min-w-0 flex-1">
            <p className="type-title-sm font-semibold">Convite criado para {created.inviteeName}</p>
            <p className="type-caption select-all break-all font-mono text-text-secondary">{created.url === "" ? LINK_UNAVAILABLE : withoutScheme(created.url)}</p>
            {created.url !== "" && <p className="type-caption text-text-tertiary">O link fica visível só por 1 minuto.</p>}
          </div>
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="type-label-md inline-flex min-h-10 items-center gap-1.5 rounded-md bg-success px-3 font-semibold text-black"
            >
              <Icon name="chat" size={16} />
              WhatsApp
            </a>
          )}
        </div>
      )}
      <p className="type-caption text-text-tertiary">O convite vale para a equipe. O motoboy entra só com nome e celular.</p>
    </form>
  );
}

function InviteTile({
  invite,
  now,
  busy,
  onResend,
  onRevoke,
}: {
  invite: Invite;
  now: Date;
  busy: boolean;
  onResend: () => void;
  onRevoke: () => void;
}) {
  const name = inviteDisplayName(invite);
  const details = [formatPhone(invite.inviteePhone), ago(invite.createdAt, now)].filter(Boolean).join(" · ");
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <Avatar initials={invite.initials} color="#8E8E93" size={30} />
      <div className="min-w-0 flex-1">
        <div className="type-body-md truncate">{name}</div>
        {details && <div className="type-caption truncate whitespace-nowrap text-text-tertiary">{details}</div>}
      </div>
      <Chip tone={TONE[invite.status] ?? "neutral"}>{INVITE_STATUS_LABEL[invite.status]}</Chip>
      {busy ? (
        <span className="grid size-10 place-items-center text-primary-text">
          <Spinner size={16} label="Em andamento" />
        </span>
      ) : (
        <>
          {inviteCanResend(invite.status) && (
            <IconAction label={`Reenviar convite para ${name}`} icon="refresh" onClick={onResend} />
          )}
          {inviteIsActive(invite.status) && <IconAction label={`Cancelar convite de ${name}`} icon="close" onClick={onRevoke} />}
        </>
      )}
    </li>
  );
}

function IconAction({ label, icon, onClick }: { label: string; icon: "refresh" | "close"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-10 cursor-pointer place-items-center rounded-md text-text-secondary hover:bg-surface-variant"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
