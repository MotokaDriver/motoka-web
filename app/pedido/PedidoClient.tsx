"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  openInApp,
  type OrderAction,
} from "../lib/appRedirect";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type OrderType = "fixed_value" | "per_delivery" | "fixed_plus_per_delivery";

interface PublicOrder {
  id: string;
  status: string;
  type: OrderType;
  start_date: string;
  end_date: string;
  requested_drivers: number;
  assigned_drivers: number;
  value: string | number | null;
  price_per_delivery: string | number | null;
  establishment: {
    corporate_description: string;
    rating: number | null;
    photo: string | null;
    address: { city: string; neighborhood: string; state: string } | null;
  } | null;
}

const TZ = "America/Sao_Paulo";

const money = (v: string | number | null): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

function isSameDay(a: Date, b: Date): boolean {
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(a) === fmt.format(b);
}

function formatDate(iso: string): { label: string; today: boolean } {
  const d = new Date(iso);
  const label = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "numeric", month: "long" }).format(d);
  return { label, today: isSameDay(d, new Date()) };
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} ${h === 1 ? "hora" : "horas"}`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/** Envolve o conteúdo do pedido com a navegação padrão do site (header + footer),
 *  para o motoboy conseguir navegar para as demais telas. Mantém o fundo slate
 *  característico da página de pedido. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </div>
  );
}

export default function PedidoClient() {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStores, setShowStores] = useState(false);

  // O id vem da query string, lida só no cliente (`window`). Ler aqui — em vez
  // de `useSearchParams` — evita o BAILOUT_TO_CLIENT_SIDE_RENDERING que o
  // `output: 'export'` impõe a quem usa `useSearchParams`: assim o servidor
  // pré-renderiza o skeleton estável e a primeira render do cliente bate com
  // ele (sem erro de hidratação). `loading` começa `true`, então ambos os lados
  // renderizam `<LoadingState/>` no primeiro paint.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lê query string só no cliente (export estático); ver comentário acima
      setLoading(false);
      setError("Link inválido: pedido não informado.");
      return;
    }

    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/orders/${encodeURIComponent(id)}/public`);
        if (!active) return;
        if (res.status === 404) {
          setError("Pedido não encontrado ou não está mais disponível.");
          return;
        }
        if (!res.ok) {
          setError("Não foi possível carregar os detalhes. Tente novamente.");
          return;
        }
        setOrder((await res.json()) as PublicOrder);
      } catch {
        if (active) setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LoadingState />;
  if (error || !order) return <ErrorState message={error ?? "Pedido indisponível."} />;

  const est = order.establishment;
  const date = formatDate(order.start_date);
  const duration = formatDuration(order.start_date, order.end_date);
  const showPeriodValue = order.type === "fixed_value" || order.type === "fixed_plus_per_delivery";
  const showPerDelivery = order.type === "per_delivery" || order.type === "fixed_plus_per_delivery";
  const isOpen = order.status === "waiting_for_drivers" && order.assigned_drivers < order.requested_drivers;
  const openSlots = Math.max(0, order.requested_drivers - order.assigned_drivers);

  const handleAction = (action: OrderAction) => openInApp(order.id, action, () => setShowStores(true));

  return (
    <Shell>
      <div className="font-sans text-gray-900 px-4 py-8 sm:py-12">
        <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-300 bg-orange-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-orange-600">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            Nova oportunidade
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
            Você recebeu uma <br className="hidden sm:block" />
            solicitação de serviço
          </h1>
          <p className="mt-3 text-gray-500 text-base">
            Confira os detalhes da oportunidade e escolha como deseja responder.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-gray-100 bg-white p-5 sm:p-8 shadow-xl shadow-gray-200/60">
          {/* Establishment */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-gray-100 bg-slate-100">
                {est?.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={est.photo} alt={est.corporate_description} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-400">
                    {est?.corporate_description?.charAt(0) ?? "?"}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-bold text-gray-900">
                  {est?.corporate_description ?? "Estabelecimento"}
                </h2>
                {est?.address && (
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                    <PinIcon />
                    <span className="truncate">
                      {est.address.neighborhood} – {est.address.city}/{est.address.state}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {est?.rating != null && (
              <div className="shrink-0 rounded-2xl bg-slate-50 px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1 text-lg font-bold text-gray-900">
                  <StarIcon />
                  {est.rating.toFixed(1).replace(".", ",")}
                </div>
                <p className="mt-0.5 text-[11px] leading-tight text-gray-400">Avaliação</p>
              </div>
            )}
          </div>

          {/* Info tiles */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <InfoTile icon={<CalendarIcon />} label="Data" value={date.label} sub={date.today ? "Hoje" : undefined} />
            <InfoTile
              icon={<ClockIcon />}
              label="Horário"
              value={`${formatTime(order.start_date)} às ${formatTime(order.end_date)}`}
            />
            <InfoTile icon={<TimerIcon />} label="Duração" value={duration} />
          </div>

          {/* Values */}
          <h3 className="mt-8 mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Valores a combinar</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {showPeriodValue && (
              <ValueCard title="Valor pelo período" value={money(order.value)} sub={`pelas ${duration}`} />
            )}
            {showPerDelivery && (
              <ValueCard title="Valor por entrega" value={money(order.price_per_delivery)} sub="por entrega realizada" />
            )}
          </div>

          <p className="mt-4 text-sm text-gray-500">
            {openSlots > 0
              ? `${openSlots} ${openSlots === 1 ? "vaga disponível" : "vagas disponíveis"} nesta solicitação.`
              : "As vagas desta solicitação já foram preenchidas."}
          </p>

          {/* Actions */}
          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleAction("counter")}
              disabled={!isOpen}
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-[#3756A9] px-6 py-4 font-bold text-[#3756A9] transition-all hover:bg-[#3756A9]/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Fazer contraproposta</span>
              <span className="text-xs font-medium text-[#3756A9]/70">Negocie valores e condições</span>
            </button>
            <button
              type="button"
              onClick={() => handleAction("accept")}
              disabled={!isOpen}
              className="flex flex-col items-center justify-center rounded-2xl bg-orange-500 px-6 py-4 font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              <span className="flex items-center gap-2">
                <CheckCircleIcon />
                Aceitar
              </span>
              <span className="text-xs font-medium text-white/80">Aceitar esta solicitação</span>
            </button>
          </div>

          {!isOpen && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-700">
              Esta oportunidade não está mais disponível para resposta.
            </p>
          )}

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
            <InfoIcon />
            Para aceitar ou negociar, você será direcionado para o app Motoka Driver.
          </p>

          {showStores && <StoreLinks />}
        </div>

        {/* Trust badges */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Badge icon={<ShieldIcon />} title="Seguro" text="Você não paga nada para usar o app." />
          <Badge icon={<UsersIcon />} title="Direto" text="O pagamento é feito diretamente por eles." />
          <Badge icon={<BoltIcon />} title="Rápido" text="Mais oportunidades, mais entregas, mais ganhos." />
        </div>
        </div>
      </div>
    </Shell>
  );
}

/* ---------- Sub-components ---------- */

function InfoTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-slate-50/70 p-3 text-center">
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#3756A9] shadow-sm">
        {icon}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[11px] font-medium text-[#3756A9]">{sub}</p>}
    </div>
  );
}

function ValueCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-green-100 bg-green-50/60 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
          <DollarIcon />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">{title}</p>
          <p className="text-xl font-extrabold text-gray-900">{value}</p>
          <p className="text-xs text-gray-400">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function Badge({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-[#3756A9]/10 text-[#3756A9]">
        {icon}
      </div>
      <h4 className="text-sm font-bold text-gray-900">{title}</h4>
      <p className="mt-1 text-xs text-gray-500">{text}</p>
    </div>
  );
}

function StoreLinks() {
  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      <p className="mb-3 text-center text-sm font-medium text-gray-600">
        Abra pelo celular ou baixe o app para continuar:
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-black"
        >
          Google Play
        </a>
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-900 transition-colors hover:border-gray-300"
        >
          App Store
        </a>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <Shell>
      <div className="px-4 py-12">
        <div className="mx-auto w-full max-w-2xl animate-pulse">
        <div className="mx-auto h-6 w-40 rounded-full bg-gray-200" />
        <div className="mx-auto mt-5 h-9 w-3/4 rounded-lg bg-gray-200" />
        <div className="mt-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-2/3 rounded bg-gray-200" />
              <div className="h-4 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="h-20 rounded-2xl bg-gray-100" />
            <div className="h-20 rounded-2xl bg-gray-100" />
            <div className="h-20 rounded-2xl bg-gray-100" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="h-20 rounded-2xl bg-gray-100" />
            <div className="h-20 rounded-2xl bg-gray-100" />
          </div>
        </div>
        </div>
      </div>
    </Shell>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Shell>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Ops!</h1>
        <p className="mt-2 text-gray-500">{message}</p>
        <a
          href="https://motokadriver.com"
          className="mt-6 inline-block rounded-xl bg-[#3756A9] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#2c4585]"
        >
          Conhecer o Motoka Driver
        </a>
        </div>
      </div>
    </Shell>
  );
}

/* ---------- Icons ---------- */

function PinIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 12v-2" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
