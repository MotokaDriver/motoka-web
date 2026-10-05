"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { useSession } from "@/features/session/useSession";
import { LogoutButton } from "@/features/shell/Shell";
import { useShortcutsEnabled } from "@/features/shell/ShortcutsProvider";
import {
  getThemePreference,
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
 * Conta mínima do WN-0 (`AccountPage` do WebCoreScreens.jsx): dados da loja só leitura,
 * Preferências (tema e atalhos) e "Sair". Edição, cartões e exclusão de conta são do WN-7.
 */
export function AccountScreen() {
  const session = useSession();
  const shortcuts = useShortcutsEnabled();
  const theme = useSyncExternalStore(subscribePrefs, getThemePreference, () => "dark" as const);
  if (session.status !== "authenticated") return null;
  const user = session.user;
  const address = fullAddress(user);

  return (
    <>
      <PageHead title="Conta" sub="Dados da loja, preferências e sessão" />
      <div className="grid items-start gap-4 px-5 pb-7 lg:grid-cols-2 lg:px-7">
        <div className="flex flex-col gap-4">
          <Section title="Cadastro" sub="Para alterar, use o app Motoka.">
            <dl className="flex flex-col gap-2.5">
              <KV k="Nome da loja" v={storeName(user)} />
              {user.document_number && <KV k="CPF/CNPJ" v={formatDocument(user.document_number)} />}
              {user.email && <KV k="E-mail" v={user.email} />}
              {user.phone && <KV k="Telefone" v={formatPhone(user.phone)} />}
              {address && <KV k="Endereço" v={address} />}
            </dl>
          </Section>
        </div>
        <div className="flex flex-col gap-4">
          <Section title="Preferências" sub="Valem só neste navegador.">
            <Segmented label="Tema" value={theme} options={THEME_OPTIONS} onValueChange={setThemePreference} />
            <Switch
              label="Atalhos de teclado"
              description="Teclas de uma letra para as ações das telas. Se você usa leitor de tela ou extensão de teclado, desligue."
              checked={shortcuts}
              onCheckedChange={setShortcutsEnabled}
            />
          </Section>
          <Section title="Sessão" danger>
            <p className="type-body-sm text-text-secondary">
              Sair encerra a sessão neste navegador, inclusive nas outras abas do painel.
            </p>
            <div>
              <LogoutButton />
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
