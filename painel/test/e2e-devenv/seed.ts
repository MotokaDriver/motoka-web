import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Preparo do dev-env real por API (nunca pelo painel): o motoboy do seed na equipe da loja e em turno
 * com sessão aberta. O telefone do seed precisa estar verificado para aceitar convite nominal
 * (`UPDATE users SET phone_verified_at = now() WHERE document_number = '52998224725'` no `motoka_pg`).
 */
export const API = "http://localhost:8000";
export const STORE = { doc: "11222333000181", password: "NovaSenha@1" };
export const DRIVER = { doc: "52998224725", password: "Teste@123" };

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
  const members = await json<{ items: Array<{ driver: { id: string }; status: string }> }>(
    await request.get(`${API}/v1/teams/me/members`, { headers: { Authorization: store.bearer } }),
  );
  if (members.items.some((m) => m.driver.id === driver.sub && ["active", "paused"].includes(m.status))) return true;

  if (linkUrl) {
    const viaLink = await request.post(`${API}/v1/teams/invites/${linkUrl.split("/").pop()}/accept`, { headers: { Authorization: driver.bearer } });
    if (viaLink.ok()) return true;
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
    const end = new Date(now.getTime() + 100 * 60_000);
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
