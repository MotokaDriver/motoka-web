"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { AddressEditor, CardsSection, PhoneEditor } from "./AccountEdit";
import { DeleteAccount, EmailEditor, PasswordEditor } from "./AccountSecurity";
import { playBeep } from "@/features/acceptance/alerts";
import { useSession } from "@/features/session/useSession";
import { LogoutButton } from "@/features/shell/Shell";
import { useShortcutsEnabled } from "@/features/shell/ShortcutsProvider";
import {
  getAcceptSound,
  getThemePreference,
  setAcceptSound,
  setShortcutsEnabled,
  setThemePreference,
  subscribePrefs,
  type ThemePreference,
} from "@/lib/prefs/prefs";
import { storeAddress, storeName, type PanelUser } from "@/lib/session/user";
import { Card } from "@/ui/Card";
import { cn } from "@/ui/cn";
import { PageHead } from "@/ui/PageHead";
import { Segmented } from "@/ui/Segmented";
import { Switch } from "@/ui/Switch";

const THEME_OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

/** CPF (11) ou CNPJ (14) com máscara; outro tamanho fica como veio. */
export function formatDocument(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return raw ?? "";
}

/** Celular/telefone BR com DDD; outro tamanho fica como veio. */
export function formatPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return raw ?? "";
}

function fullAddress(user: PanelUser): string | null {
  const line = storeAddress(user);
  if (!line) return null;
  const place = [user.address?.neighborhood, user.address?.city].filter(Boolean).join(", ");
  return place ? `${line} — ${place}` : line;
}

function Section({ title, sub, danger, children }: { title: string; sub?: string; danger?: boolean; children: ReactNode }) {
  return (
    <Card className={cn("flex flex-col gap-3.5 p-5", danger && "border-error/40")}>
      <div>
        <h2 className={cn("type-title-md font-bold", danger ? "text-error" : "text-text-primary")}>{title}</h2>
        {sub && <p className="type-body-sm text-text-tertiary">{sub}</p>}
      </div>
      {children}
    </Card>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="type-body-md flex justify-between gap-3">
      <dt className="text-text-secondary">{k}</dt>
      <dd className="text-right font-medium text-text-primary">{v}</dd>
    </div>
  );
}

/**
 * Conta (`AccountPage`): cadastro (só leitura), contato e endereço (editáveis), cartões salvos (listar e excluir),
 * preferências (tema e atalhos) e a zona de perigo (Sair; excluir a conta leva ao fluxo da landing).
 */
export function AccountScreen() {
  const session = useSession();
  const shortcuts = useShortcutsEnabled();
  const theme = useSyncExternalStore(subscribePrefs, getThemePreference, () => "dark" as const);
  const acceptSound = useSyncExternalStore(subscribePrefs, getAcceptSound, () => false);
  if (session.status !== "authenticated") return null;
  const user = session.user;
  const address = fullAddress(user);

  return (
    <>
      <PageHead title="Conta" sub="Dados da loja, preferências e sessão" />
      <div className="grid items-start gap-4 px-5 pb-7 lg:grid-cols-2 lg:px-7">
        <div className="flex flex-col gap-4">
          <Section title="Cadastro" sub="Nome e CPF/CNPJ não mudam por aqui.">
            <dl className="flex flex-col gap-2.5">
              <KV k="Nome da loja" v={storeName(user)} />
              {user.document_number && <KV k="CPF/CNPJ" v={formatDocument(user.document_number)} />}
              {user.phone && <KV k="Telefone" v={formatPhone(user.phone)} />}
              {address && <KV k="Endereço" v={address} />}
            </dl>
          </Section>
          <Section title="Contato" sub="O telefone que os motoboys e o Motoka usam para falar com a loja.">
            <PhoneEditor key={user.phone ?? ""} userId={user.id} current={user.phone ?? ""} />
          </Section>
          <Section title="E-mail" sub="Usado para entrar e receber os avisos do Motoka.">
            <EmailEditor key={user.email ?? ""} userId={user.id} current={user.email ?? ""} />
          </Section>
          <Section title="Endereço" sub="O endereço da loja, usado como ponto de partida dos serviços.">
            <AddressEditor userId={user.id} />
          </Section>
        </div>
        <div className="flex flex-col gap-4">
          <Section title="Senha" sub="Troque a senha de acesso ao painel e ao app.">
            <PasswordEditor userId={user.id} />
          </Section>
          <Section title="Formas de pagamento" sub="Cartões usados para pagar a taxa de serviço.">
            <CardsSection userId={user.id} />
          </Section>
          <Section title="Preferências" sub="Valem só neste navegador.">
            <Segmented label="Tema" value={theme} options={THEME_OPTIONS} onValueChange={setThemePreference} />
            <Switch
              label="Atalhos de teclado"
              description="Teclas de uma letra para as ações das telas. Se você usa leitor de tela ou extensão de teclado, desligue."
              checked={shortcuts}
              onCheckedChange={setShortcutsEnabled}
            />
            <Switch
              label="Som de pedido para aceitar"
              description="Toca um sinal quando chega um pedido do PDV esperando o seu aceite. Fica desligado até você ligar."
              checked={acceptSound}
              onCheckedChange={(next) => {
                setAcceptSound(next);
                if (next) playBeep();
              }}
            />
          </Section>
          <Section title="Sessão" danger>
            <p className="type-body-sm text-text-secondary">
              Sair encerra a sessão neste navegador, inclusive nas outras abas do painel.
            </p>
            <div className="flex flex-wrap gap-3">
              <LogoutButton />
              <DeleteAccount userId={user.id} />
            </div>
            <p className="type-caption text-text-tertiary">Excluir a conta remove seus dados de forma permanente e encerra a sessão.</p>
          </Section>
        </div>
      </div>
    </>
  );
}
