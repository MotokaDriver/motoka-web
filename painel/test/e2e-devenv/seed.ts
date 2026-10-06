import { execFileSync } from "node:child_process";
import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Preparo do dev-env real por API (nunca pelo painel): um motoboy do painel na equipe da loja e em turno com sessão
 * aberta. **O E2E nunca altera o motoboy do seed do app (52998224725):** quem entra e fica na equipe é o motoboy do painel
 * (cadastrado pela API, doc abaixo, nunca removido pelos testes), e o que precisa ser removido (`team.spec`) é um
 * motoboy descartável criado no próprio teste (`createDisposableDriver`).
 */
export const API = "http://localhost:8000";
export const STORE = { doc: "11222333000181", password: "NovaSenha@1" };
/** O motoboy do painel: cadastrado pela API e fixo na equipe (registrado em dev-env-contas.md). */
// `PAINEL_E2E_DRIVER_DOC` troca de motoboy quando o turno do atual ainda ocupa a janela (um turno encerrado só libera no horário de fim).
export const DRIVER = { doc: process.env.PAINEL_E2E_DRIVER_DOC ?? "12345678909", password: "Teste@123" };
export const DRIVER_NAME = process.env.PAINEL_E2E_DRIVER_NAME ?? "Bruno Painel Teste";

export interface Who {
  readonly bearer: string;
  readonly sub: string;
}

export async function login(request: APIRequestContext, who: { doc: string; password: string }): Promise<Who> {
  const response = await request.post(`${API}/token`, { form: { username: who.doc, password: who.password } });
  expect(response.ok(), `login de ${who.doc}`).toBe(true);
  const access = ((await response.json()) as { access_token: string }).access_token;
  const sub = JSON.parse(Buffer.from(access.split(".")[1] ?? "", "base64url").toString()).sub as string;
  return { bearer: `Bearer ${access}`, sub };
}

const json = async <T>(response: { json: () => Promise<unknown> }) => (await response.json()) as T;

/** O motoboy entra na equipe (pelo link ou por convite nominal, que exige o telefone verificado). */
export async function ensureDriverInTeam(request: APIRequestContext, linkUrl: string | null): Promise<boolean> {
  const store = await login(request, STORE);
  const driver = await login(request, DRIVER);
  const members = await json<{ items: Array<{ id: string; driver: { id: string }; status: string }> }>(
    await request.get(`${API}/v1/teams/me/members`, { headers: { Authorization: store.bearer } }),
  );
  const present = members.items.find((m) => m.driver.id === driver.sub && ["active", "paused"].includes(m.status));
  if (present) {
    // Combinado completo: sem ele o acerto nasce com "valor a definir" e a loja não consegue confirmar (correto, mas não é o que se testa aqui).
    await request.patch(`${API}/v1/teams/me/members/${present.id}`, { headers: { Authorization: store.bearer }, data: { deal: { pay_type: "fixed_plus_per_delivery", daily_rate: "90.00", per_delivery_rate: "6.00", rain_bonus_percent: 10 } } });
    return true;
  }

  if (linkUrl) {
    const viaLink = await request.post(`${API}/v1/teams/invites/${linkUrl.split("/").pop()}/accept`, { headers: { Authorization: driver.bearer } });
    if (viaLink.ok()) return true;
  }
  // Sem o link da rodada (a `team.spec` remove o motoboy no fim): o link fixo da loja também serve e não exige telefone verificado.
  const link = await request.get(`${API}/v1/teams/me/invite-link`, { headers: { Authorization: store.bearer } });
  if (link.ok()) {
    const token = (await json<{ token?: string }>(link)).token;
    if (token) {
      const joined = await request.post(`${API}/v1/teams/invites/${token}/accept`, { headers: { Authorization: driver.bearer } });
      if (joined.ok()) return true;
    }
  }
  const profile = await json<{ phone: string }>(await request.get(`${API}/v1/users/${driver.sub}`, { headers: { Authorization: driver.bearer } }));
  const created = await request.post(`${API}/v1/teams/me/invites`, {
    headers: { Authorization: store.bearer },
    data: { invitee_name: "Motoboy Teste", invitee_phone: profile.phone },
  });
  if (!created.ok()) return false;
  const id = (await json<{ id: string }>(created)).id;
  const accepted = await request.post(`${API}/v1/teams/mine/invites/${id}/accept`, { headers: { Authorization: driver.bearer } });
  return accepted.ok();
}

/** O motoboy em turno agora, com sessão aberta. Cria um turno que começa em 1 min (a API deixa abrir 30 min antes; sem SQL: se houver sobreposição, devolve false e o teste se pula). */
export async function ensureDriverOnShift(request: APIRequestContext): Promise<boolean> {
  const store = await login(request, STORE);
  const driver = await login(request, DRIVER);
  // A conta nova do motoboy ainda não aceitou o uso da localização, e sem isso a API recusa abrir o turno (T2).
  const consent = await json<{ current_version: string; accepted: boolean }>(await request.get(`${API}/v1/tracking/consent`, { headers: { Authorization: driver.bearer } }));
  if (!consent.accepted) await request.post(`${API}/v1/tracking/consent`, { headers: { Authorization: driver.bearer }, data: { version: consent.current_version } });
  const listOnShift = async () =>
    json<{ items: Array<{ shift_id: string; occurrence_date: string; session_started: boolean; driver: { id: string } }> }>(
      await request.get(`${API}/v1/teams/me/on-shift`, { headers: { Authorization: store.bearer } }),
    );
  let entry = (await listOnShift()).items.find((i) => i.driver.id === driver.sub);

  if (!entry) {
    // Um turno de uma rodada anterior que já cabe na janela de abertura (30 min antes): reaproveita.
    const schedule = await json<{ occurrences: Array<{ shift_id: string; driver_id: string; date: string; starts_at: string; ends_at: string; session: unknown }> }>(
      await request.get(`${API}/v1/teams/me/schedule`, { headers: { Authorization: store.bearer } }),
    );
    const now = Date.now();
    const usable = schedule.occurrences.find((o) => o.driver_id === driver.sub && Date.parse(o.starts_at) <= now + 25 * 60_000 && Date.parse(o.ends_at) > now + 5 * 60_000);
    if (usable) {
      const started = await request.post(`${API}/v1/teams/mine/shifts/${usable.shift_id}/start`, { headers: { Authorization: driver.bearer }, data: { occurrence_date: usable.date } });
      if (started.ok()) {
        entry = (await listOnShift()).items.find((i) => i.driver.id === driver.sub);
        if (entry?.session_started) return true;
      }
    }
  }
  if (!entry) {
    const members = await json<{ items: Array<{ id: string; driver: { id: string } }> }>(
      await request.get(`${API}/v1/teams/me/members`, { headers: { Authorization: store.bearer } }),
    );
    const member = members.items.find((m) => m.driver.id === driver.sub);
    if (!member) return false;
    const now = new Date();
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
    const hm = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    const start = new Date(now.getTime() + 1 * 60_000);
    const end = new Date(now.getTime() + 25 * 60_000);
    if (hm(end) < hm(start)) return false; // perto da meia-noite: o turno cruzaria o dia
    const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
    const monday = new Date(Date.parse(`${day}T00:00:00Z`) - weekday * 86_400_000).toISOString().slice(0, 10);
    const created = await request.post(`${API}/v1/teams/me/shifts`, {
      headers: { Authorization: store.bearer },
      data: { membership_id: member.id, weekdays: [weekday], start_time: hm(start), end_time: hm(end), week_start: monday, repeat_weekly: false, remind_location: false },
    });
    if (!created.ok()) return false;
    const shiftId = (await json<{ items: Array<{ id: string }> }>(created)).items[0]?.id;
    const started = await request.post(`${API}/v1/teams/mine/shifts/${shiftId}/start`, { headers: { Authorization: driver.bearer }, data: { occurrence_date: day } });
    if (!started.ok()) return false;
    entry = (await listOnShift()).items.find((i) => i.driver.id === driver.sub);
    return entry?.session_started === true;
  }
  if (entry.session_started) return true;
  const started = await request.post(`${API}/v1/teams/mine/shifts/${entry.shift_id}/start`, {
    headers: { Authorization: driver.bearer },
    data: { occurrence_date: entry.occurrence_date },
  });
  return started.ok();
}

/** O motoboy do seed manda um ponto (T1). O consentimento do seed já está aceito (T2); aceita se faltar. */
export async function reportPosition(request: APIRequestContext, lat: number, lng: number): Promise<boolean> {
  const driver = await login(request, DRIVER);
  const headers = { Authorization: driver.bearer };
  const consent = await json<{ current_version: string; accepted: boolean }>(await request.get(`${API}/v1/tracking/consent`, { headers }));
  if (!consent.accepted) await request.post(`${API}/v1/tracking/consent`, { headers, data: { version: consent.current_version } });
  const now = new Date();
  const sent = await request.post(`${API}/v1/tracking/positions`, {
    headers,
    data: {
      sent_at: now.toISOString(),
      points: [{ recorded_at: now.toISOString(), lat, lng, accuracy_m: 8, speed_mps: 5, heading: 90, is_mocked: false }],
    },
  });
  return sent.ok();
}

/** Cria um pedido manual na loja (sem motoboy) e devolve o id, o número e o link do cliente. */
export async function createManualDelivery(request: APIRequestContext, name: string): Promise<{ id: string; number: number; trackingUrl: string | null; bearer: string }> {
  const store = await login(request, STORE);
  const response = await request.post(`${API}/v1/deliveries`, {
    headers: { Authorization: store.bearer },
    data: {
      client_request_id: `e2e-${Date.now()}`,
      channel: "whatsapp",
      customer: { name, phone: "41999990077" },
      address: { street: "Rua Chile", number: "1880", neighborhood: "Rebouças", city: "Curitiba", state: "PR" },
      payment: { type: "online" },
      driver: { mode: "none" },
      send_tracking_link: true,
    },
  });
  expect(response.ok(), "criar pedido").toBe(true);
  const body = await json<{ id: string; number: number; tracking_url: string | null }>(response);
  return { id: body.id, number: body.number, trackingUrl: body.tracking_url, bearer: store.bearer };
}

export async function cancelDeliveryApi(request: APIRequestContext, bearer: string, id: string): Promise<void> {
  await request.post(`${API}/v1/deliveries/${id}/cancel`, { headers: { Authorization: bearer }, data: { action_id: crypto.randomUUID(), reason: "Teste E2E" } });
}

/**
 * Prepara, só por API, um acerto aguardando a loja: turno curto (começa em 1 min, 8 min de duração) →
 * o motoboy abre a sessão, encerra (M8 `end`: o acerto nasce na mesma transação) e confirma o valor.
 * Reaproveita um `pending_store` que já exista. Devolve `null` se a janela estiver ocupada (turno de
 * outra rodada ainda em curso ou perto da meia-noite) para o teste se pular dizendo por quê.
 */
export async function ensurePendingStoreSettlement(request: APIRequestContext): Promise<string | null> {
  const store = await login(request, STORE);
  const driver = await login(request, DRIVER);
  const existing = await json<{ items: Array<{ id: string; deal_incomplete?: boolean }> }>(
    await request.get(`${API}/v1/teams/me/settlements?status=pending_store`, { headers: { Authorization: store.bearer } }),
  );
  // Só reaproveita acerto com o combinado completo: o de "valor a definir" não dá para confirmar.
  const usable = existing.items.find((i) => !i.deal_incomplete);
  if (usable) return usable.id;

  // Turno do motoboy do painel já aberto (as outras specs o deixam em turno): encerra a sessão pelo caminho do app (M8 `end`),
  // que cria o acerto na mesma transação, e o motoboy confirma o valor. Sem janela nova, sem sobreposição.
  const schedule = await json<{ occurrences: Array<{ driver_id: string; session: { id: string; ended_at: string | null } | null }> }>(
    await request.get(`${API}/v1/teams/me/schedule`, { headers: { Authorization: store.bearer } }),
  );
  const open = schedule.occurrences.find((o) => o.driver_id === driver.sub && o.session && !o.session.ended_at);
  if (open?.session) {
    const ended = await request.post(`${API}/v1/teams/mine/sessions/${open.session.id}/end`, { headers: { Authorization: driver.bearer } });
    if (ended.ok()) {
      const id = (await json<{ settlement: { id: string } | null }>(ended)).settlement?.id;
      if (id) {
        const mine = await json<{ version: number; total: string | null }>(await request.get(`${API}/v1/teams/mine/settlements/${id}`, { headers: { Authorization: driver.bearer } }));
        const confirmed = await request.post(`${API}/v1/teams/mine/settlements/${id}/confirm`, { headers: { Authorization: driver.bearer }, data: { version: mine.version, expected_total: mine.total } });
        if (confirmed.ok()) return id;
      }
    }
  }

  const members = await json<{ items: Array<{ id: string; driver: { id: string } }> }>(await request.get(`${API}/v1/teams/me/members`, { headers: { Authorization: store.bearer } }));
  const member = members.items.find((m) => m.driver.id === driver.sub);
  if (!member) return null;
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const hm = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  const start = new Date(now.getTime() + 60_000);
  const end = new Date(now.getTime() + 9 * 60_000);
  if (hm(end) < hm(start)) return null;
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = new Date(Date.parse(`${day}T00:00:00Z`) - weekday * 86_400_000).toISOString().slice(0, 10);
  const created = await request.post(`${API}/v1/teams/me/shifts`, {
    headers: { Authorization: store.bearer },
    data: { membership_id: member.id, weekdays: [weekday], start_time: hm(start), end_time: hm(end), week_start: monday, repeat_weekly: false, remind_location: false },
  });
  if (!created.ok()) return null;
  const shiftId = (await json<{ items: Array<{ id: string }> }>(created)).items[0]?.id;
  const headers = { Authorization: driver.bearer };
  const started = await request.post(`${API}/v1/teams/mine/shifts/${shiftId}/start`, { headers, data: { occurrence_date: day } });
  if (!started.ok()) return null;
  const sessionId = (await json<{ id: string }>(started)).id;
  const ended = await request.post(`${API}/v1/teams/mine/sessions/${sessionId}/end`, { headers });
  if (!ended.ok()) return null;
  const settlementId = (await json<{ settlement: { id: string } | null }>(ended)).settlement?.id;
  if (!settlementId) return null;
  const mine = await json<{ version: number; total: string | null }>(await request.get(`${API}/v1/teams/mine/settlements/${settlementId}`, { headers }));
  const confirmed = await request.post(`${API}/v1/teams/mine/settlements/${settlementId}/confirm`, { headers, data: { version: mine.version, expected_total: mine.total } });
  return confirmed.ok() ? settlementId : null;
}

function randomCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  if (new Set(base).size === 1) base[0] = (base[0] ?? 0) === 9 ? 1 : (base[0] ?? 0) + 1;
  const digit = (numbers: number[]) => {
    const sum = numbers.reduce((total, n, i) => total + n * (numbers.length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const first = digit(base);
  const second = digit([...base, first]);
  return [...base, first, second].join("");
}

export interface DisposableDriver {
  readonly doc: string;
  readonly password: string;
  readonly name: string;
  /** Como o painel mostra: nome e inicial do sobrenome ("Tag12345 S."). */
  readonly short: string;
  readonly id: string;
}

/**
 * Motoboy descartável, cadastrado pelo caminho normal da API (e-mail verificado, termo de uso, cadastro). O código de
 * verificação do e-mail só existe no banco: a leitura (`select`) usa o `docker exec` do dev-env, como o `seed.sh`.
 * Quem usa apaga a conta no fim (`deleteDisposableDriver`).
 */
export async function createDisposableDriver(request: APIRequestContext, tag: string): Promise<DisposableDriver> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `descartavel-${stamp}@motoka.com`;
  await request.post(`${API}/v1/users/email-code`, { data: { email } });
  const code = execFileSync("docker", ["exec", "motoka_pg", "psql", "-U", "postgres", "-d", "motoka_db", "-tAc", `select code from emailconfirmation where email='${email}' order by created_at desc limit 1`], { encoding: "utf8" }).trim();
  expect(code, "código de verificação do e-mail").toMatch(/^\d{6}$/);
  const confirmed = await request.post(`${API}/v1/users/confirm-email-code`, { data: { email, code } });
  expect(confirmed.ok(), "confirmar o e-mail").toBe(true);
  const doc = randomCpf();
  const first = `${tag}${stamp.slice(-5)}`;
  const name = `${first} Silva`;
  const created = await request.post(`${API}/v1/users`, {
    data: {
      type: "driver",
      document_number: doc,
      email,
      full_name: name,
      password: "Teste@123",
      term_of_use: 1,
      phone: `119${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`,
      search_radius: 10,
      address: { postal_code: "80010000", city: "Curitiba", state: "PR", street: "Rua XV de Novembro", neighborhood: "Centro", number: 100 },
    },
  });
  expect(created.ok(), "cadastrar o motoboy descartável").toBe(true);
  const id = (await json<{ id: string }>(created)).id;
  return { doc, password: "Teste@123", name, short: `${first} S.`, id };
}

/** Apaga a conta do descartável (ele é nosso; o motoboy do seed e o do painel nunca passam por aqui). */
export async function deleteDisposableDriver(request: APIRequestContext, driver: DisposableDriver): Promise<void> {
  const who = await login(request, driver);
  await request.delete(`${API}/v1/users/${driver.id}`, { headers: { Authorization: who.bearer } });
}

/** O descartável entra pelo link de convite da loja (a conta nova nunca foi removida, então o link vale). */
export async function joinByLink(request: APIRequestContext, driver: DisposableDriver, linkUrl: string): Promise<boolean> {
  const who = await login(request, driver);
  const joined = await request.post(`${API}/v1/teams/invites/${linkUrl.split("/").pop()}/accept`, { headers: { Authorization: who.bearer } });
  return joined.ok();
}
