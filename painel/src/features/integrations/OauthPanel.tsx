"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { entityColor } from "@/features/team/model";
import { isApiError } from "@/lib/api/errors";
import { UNKNOWN_MESSAGE } from "@/lib/errors/messages";
import { savePendingOauth } from "@/lib/prefs/prefs";
import { APP_ENV } from "@/lib/env";
import { Avatar } from "@/ui/Avatar";
import { Btn } from "@/ui/Btn";
import { ConfirmDialog, type ConfirmRequest } from "@/ui/ConfirmDialog";
import { Icon } from "@/ui/Icon";
import { InlineError } from "@/ui/InlineError";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { deleteDriverLink, disconnectIntegration, fetchProviderDrivers, putDriverLink, retrySetup, startAuthorization, syncProvider, type TeamDriver } from "./api";
import { ShippingSettingsSection } from "./NuvemshopSettings";
import { integrationKeys, useDetail } from "./hooks";
import { TYPE_INFO } from "./logic";
import type { Card, IntegrationType } from "./model";

const errorText = (failure: unknown): string => (isApiError(failure) ? failure.text() : UNKNOWN_MESSAGE);

/** O portal do parceiro é https (e `http://localhost` só fora de produção, para o ambiente de teste). */
export function safePortalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const dev = APP_ENV !== "prod" && url.protocol === "http:" && url.hostname === "localhost";
    if (url.protocol !== "https:" && !dev) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Painel de uma integração por OAuth (Cardápio Web, WN-4c): conectar pelo portal do parceiro (PKCE; o `state` fica só na aba
 * até a volta e o `code_verifier` nem sai da API), vínculo motoboy ↔ entregador, sincronizar e desconectar.
 */
export function OauthPanel({ type, card }: { type: IntegrationType; card: Card | undefined }) {
  const info = TYPE_INFO[type];
  const queryClient = useQueryClient();
  const toast = useToast();
  const saved = card?.state != null;
  const detail = useDetail(type, saved);
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | "setup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  // Conectado = o parceiro autorizou. A Nuvemshop pode estar conectada e `incomplete` (o cadastro da entrega falhou);
  // o Cardápio Web `incomplete` não está conectado (faltou a loja).
  const connected = card?.state === "connected";
  const nuvemshop = type === "nuvemshop";
  const to = nuvemshop ? "à" : "ao";
  const broken = card?.state === "error";
  // `soon`: o ambiente não tem a configuração do parceiro (a loja não resolve). `incomplete`: a conexão desta loja ficou sem
  // a loja do parceiro (ela reconecta).
  const unconfigured = card?.status === "soon";
  const incomplete = card?.status === "incomplete";
  const refresh = () => queryClient.invalidateQueries({ queryKey: integrationKeys.all });

  const connect = async () => {
    setBusy("connect");
    setError(null);
    try {
      const { authorizeUrl } = await startAuthorization(type);
      const url = safePortalUrl(authorizeUrl);
      const state = url ? new URL(url).searchParams.get("state") : null;
      if (!url || !state) {
        setError("Não foi possível abrir a conexão com o parceiro. Tente de novo.");
        setBusy(null);
        return;
      }
      savePendingOauth({ type, state });
      window.location.assign(url);
    } catch (failure) {
      setError(errorText(failure));
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    setError(null);
    try {
      const queued = await syncProvider(type);
      toast({ title: queued > 0 ? `Sincronizado: ${queued} ${queued === 1 ? "pedido" : "pedidos"} na fila.` : "Sincronizado: nada novo." });
      await refresh();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(null);
    }
  };

  const setup = async () => {
    setBusy("setup");
    setError(null);
    try {
      const result = await retrySetup();
      if (result === "connected") toast({ title: "Cadastro refeito." });
      else setError("O cadastro ainda não terminou na Nuvemshop. Tente de novo em instantes.");
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
      toast({ title: "Integração desconectada." });
      await refresh();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(null);
    }
  };

  if (!info) return null;
  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <p className="type-label-md text-text-tertiary">{info.kind}</p>
        <h2 className="type-title-lg mt-1 font-bold text-text-primary">{info.name}</h2>
        <p className="type-body-sm mt-1.5 text-pretty text-text-secondary">{info.how}</p>
      </div>

      {unconfigured ? (
        <div role="status" className="rounded-md border border-warning/40 bg-warning/10 p-3">
          <p className="type-body-sm font-semibold text-text-primary">Indisponível neste ambiente</p>
          <p className="type-body-sm text-text-secondary">A conexão {nuvemshop ? "com a" : "com o"} {info.name} ainda não foi configurada neste ambiente. Assim que ela estiver pronta, o botão de conectar aparece aqui.</p>
        </div>
      ) : (
        <>
          {incomplete && (
            <p role="alert" className="type-body-sm rounded-md border border-warning/40 bg-warning/10 p-3 font-semibold text-text-primary">
              {nuvemshop
                ? "Configuração incompleta: o cadastro da entrega na Nuvemshop não terminou, e o checkout ainda não oferece o motoboy. Use \"Refazer cadastro\"."
                : `Configuração incompleta: o ${info.name} não informou a loja. Conecte de novo.`}
            </p>
          )}
          {broken && (
            <p role="alert" className="type-body-sm rounded-md border border-error/40 bg-error/10 p-3 font-semibold text-text-primary">
              {`Reconecte ${nuvemshop ? "a" : "o"} ${info.name}: a autorização caiu e os pedidos novos estão parados.`}
            </p>
          )}
          {connected && (
            <div className="flex flex-col gap-1.5">
              <span className="type-label-md text-text-secondary">Conta autorizada</span>
              <p className="type-body-sm flex items-center gap-2 rounded-md border border-border bg-surface-variant px-3 py-2.5 text-text-primary">
                <span className="text-success">
                  <Icon name="check" size={18} />
                </span>
                {detail.data?.externalMerchantId ? `Loja ${detail.data.externalMerchantId}` : "Autorizada no portal do parceiro"}
              </p>
              <p className="type-caption text-text-tertiary">{nuvemshop ? "Autorizado na Nuvemshop pela loja." : `Autorizado no ${info.name} pela loja. Renova sozinho.`}</p>
            </div>
          )}
          {connected && !nuvemshop && <DriverLinks type={type} />}
          {connected && nuvemshop && <ShippingSettingsSection />}
          {connected && (
            <p className="type-caption text-pretty text-text-tertiary">
              Problema na entrega: o Motoka avisa a loja e não cancela o pedido {nuvemshop ? "na" : "no"} {info.name}. Quem decide cancelar é a loja.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {connected ? (
              <>
                {nuvemshop ? (
                  incomplete && (
                    <Btn loading={busy === "setup"} disabled={busy !== null} onClick={() => void setup()}>
                      Refazer cadastro
                    </Btn>
                  )
                ) : (
                  <Btn kind="secondary" icon="sync" loading={busy === "sync"} disabled={busy !== null} onClick={() => void sync()}>
                    Sincronizar agora
                  </Btn>
                )}
                <Btn
                  kind="danger"
                  icon="link"
                  disabled={busy !== null}
                  onClick={() =>
                    setConfirm({
                      title: nuvemshop ? "Desconectar a Nuvemshop?" : "Desconectar o Cardápio Web?",
                      description: nuvemshop
                        ? "A entrega por motoboy some do checkout da loja virtual e o acesso do Motoka é encerrado. Reconectar pede uma nova autorização."
                        : "Os pedidos novos param de entrar e o acesso do Motoka é revogado no parceiro. Reconectar pede uma nova autorização.",
                      confirmLabel: "Desconectar",
                      danger: true,
                      onConfirm: () => void disconnect(),
                    })
                  }
                >
                  Desconectar
                </Btn>
              </>
            ) : (
              <Btn loading={busy === "connect"} disabled={busy !== null} onClick={() => void connect()}>
                {broken ? `Reconectar ${nuvemshop ? "a" : "o"} ${info.name}` : incomplete ? `Conectar de novo ${to} ${info.name}` : `Conectar ${to} ${info.name}`}
              </Btn>
            )}
          </div>
          {!connected && <p className="type-caption text-text-tertiary">Você será levado ao portal {nuvemshop ? "da" : "do"} {info.name} para autorizar e volta para cá em seguida.</p>}
        </>
      )}
      {detail.isError && saved && <InlineError message={errorText(detail.error)} onRetry={() => void detail.refetch()} />}
      {error && <InlineError message={error} />}
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

/** Motoboys ↔ entregadores do parceiro: cada motoboy da equipe com o entregador dele (ou "Vincular"). */
function DriverLinks({ type }: { type: IntegrationType }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: [...integrationKeys.all, "drivers", type], queryFn: ({ signal }) => fetchProviderDrivers(type, signal), retry: false });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const removeOrphan = async (driverId: string) => {
    setBusyId(driverId);
    setError(null);
    try {
      await deleteDriverLink(type, driverId);
      toast({ title: "Vínculo removido." });
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      await queryClient.invalidateQueries({ queryKey: [...integrationKeys.all, "drivers", type] });
      setBusyId(null);
    }
  };

  const change = async (driver: TeamDriver, externalId: string) => {
    setBusyId(driver.driverId);
    setError(null);
    try {
      if (externalId === "") await deleteDriverLink(type, driver.driverId);
      else await putDriverLink(type, driver.driverId, externalId);
      toast({ title: externalId === "" ? "Vínculo removido." : "Motoboy vinculado." });
      await queryClient.invalidateQueries({ queryKey: [...integrationKeys.all, "drivers", type] });
    } catch (failure) {
      setError(errorText(failure));
      await queryClient.invalidateQueries({ queryKey: [...integrationKeys.all, "drivers", type] });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section id="vinculos" tabIndex={-1} aria-label="Motoboys e entregadores" className="flex flex-col gap-2.5 outline-none">
      <div>
        <h3 className="type-label-md text-text-secondary">Motoboys ↔ entregadores</h3>
        <p className="type-caption text-pretty text-text-tertiary">O parceiro só aceita entregadores cadastrados nele. Sem vínculo, o pedido anda no Motoka, mas o painel do parceiro fica sem entregador.</p>
      </div>
      {query.isPending ? (
        <Spinner size={20} label="Carregando os entregadores" />
      ) : query.isError ? (
        <InlineError message={errorText(query.error)} onRetry={() => void query.refetch()} />
      ) : query.data.team.length === 0 ? (
        <p className="type-body-sm text-text-tertiary">Nenhum motoboy na equipe ainda. Convide motoboys em Minha equipe.</p>
      ) : (
        <ul aria-label="Vínculos" className="flex flex-col gap-2">
          {query.data.team.map((driver) => {
            const taken = new Set(query.data.team.filter((d) => d.driverId !== driver.driverId && d.externalDriverId).map((d) => d.externalDriverId));
            return (
              <li key={driver.driverId} className="flex items-center gap-2.5">
                <Avatar initials={driver.name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?"} color={entityColor(driver.driverId)} size={26} />
                <span className="type-body-sm min-w-0 flex-1 truncate text-text-primary">{driver.name || "Motoboy"}</span>
                <select
                  aria-label={`Entregador de ${driver.name || "motoboy"}`}
                  value={driver.externalDriverId ?? ""}
                  disabled={busyId === driver.driverId}
                  onChange={(event) => void change(driver, event.target.value)}
                  className={`type-body-sm min-h-10 w-40 rounded-md border border-border bg-surface-variant px-2 outline-none focus:border-[1.5px] focus:border-primary ${driver.externalDriverId ? "text-text-primary" : "text-warning"}`}
                >
                  <option value="">{driver.externalDriverId ? "Remover vínculo" : "Vincular"}</option>
                  {query.data.external.map((external) => (
                    <option key={external.id} value={external.id} disabled={taken.has(external.id)}>
                      {external.name || `Entregador ${external.id}`}
                    </option>
                  ))}
                  {driver.externalDriverId && !query.data.external.some((e) => e.id === driver.externalDriverId) && (
                    <option value={driver.externalDriverId}>{driver.externalDriverName ?? `Entregador ${driver.externalDriverId}`}</option>
                  )}
                </select>
              </li>
            );
          })}
        </ul>
      )}
      {query.data && query.data.orphans.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-divider pt-2.5">
          <h4 className="type-label-md text-text-secondary">Vínculos de quem saiu da equipe</h4>
          <ul aria-label="Vínculos de quem saiu" className="flex flex-col gap-1.5">
            {query.data.orphans.map((orphan) => (
              <li key={orphan.driverId} className="flex items-center gap-2.5">
                <span className="type-body-sm min-w-0 flex-1 truncate text-text-secondary">{orphan.externalDriverName ?? `Entregador ${orphan.externalDriverId}`}</span>
                <Btn kind="secondary" disabled={busyId === orphan.driverId} onClick={() => void removeOrphan(orphan.driverId)}>
                  Remover
                </Btn>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <InlineError message={error} />}
    </section>
  );
}
