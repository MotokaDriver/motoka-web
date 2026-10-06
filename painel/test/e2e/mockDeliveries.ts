import { TEAM_IDS } from "./mockTeam";

/** Estado de /v1/deliveries/* do mock: o bastante para o fluxo do WN-2 (E1, E2, E4, E5, E6, E12, E16...). */
interface MockDelivery {
  id: string;
  number: number;
  origin: string;
  channel: string;
  status: string;
  name: string;
  phone: string | null;
  address: Record<string, string | null>;
  payment: Record<string, unknown>;
  fee: string | null;
  driver: boolean;
  trackingSent: boolean;
  cancellation: Record<string, unknown> | null;
  createdAt: string;
  clientRequestId: string | null;
  events: Array<{ seq: number; type: string; to_status: string | null; actor: string; recorded_at: string }>;
  deliveredAfterCancel: boolean;
  afterCancel: Record<string, unknown> | null;
  needsAttention: boolean;
  geocode: string;
}

const DRIVER = { id: TEAM_IDS.driverDiego, short_name: "Diego R.", initials: "DR" };

export class MockDeliveries {
  items: MockDelivery[] = [];
  counter = 0;
  calls: string[] = [];
  createBodies: Array<Record<string, unknown>> = [];
  lookup: { name: string | null; addresses: Array<Record<string, unknown>> } = { name: null, addresses: [] };
  lookupStatus = 200;

  private uuid(): string {
    this.counter += 1;
    return `e${String(this.counter).padStart(7, "0")}-0000-4000-8000-000000000000`;
  }

  seed(partial: Partial<MockDelivery> & { number: number; status: string }): MockDelivery {
    const item: MockDelivery = {
      id: this.uuid(),
      origin: "manual",
      channel: "whatsapp",
      name: "Cliente Seed",
      phone: "5541999990077",
      address: { street: "Rua Chile", number: "1880", neighborhood: "Rebouças", city: "Curitiba", state: "PR", zip_code: null, complement: null, reference: null },
      payment: { type: "online", method: null, amount_to_collect: null, change_for: null },
      fee: null,
      driver: false,
      trackingSent: false,
      cancellation: null,
      createdAt: new Date().toISOString(),
      clientRequestId: null,
      events: [],
      deliveredAfterCancel: false,
      afterCancel: null,
      needsAttention: false,
      geocode: "not_configured",
      ...partial,
    };
    if (item.events.length === 0) item.events.push({ seq: 1, type: "created", to_status: item.status, actor: "establishment", recorded_at: item.createdAt });
    this.items.push(item);
    return item;
  }

  private tracking(d: MockDelivery) {
    return { mode: d.origin === "ifood" ? "none" : "motoka", sent_at: d.trackingSent ? new Date().toISOString() : null, opened_count: 0, expired: false };
  }

  item(d: MockDelivery) {
    return {
      id: d.id,
      number: d.number,
      origin: d.origin,
      channel: d.origin === "manual" ? d.channel : null,
      external_display_id: null,
      status: d.status,
      outcome: "pending",
      customer: { name: d.name, address_line: `${d.address.street}, ${d.address.number}`, neighborhood: d.address.neighborhood },
      destination: null,
      driver: d.driver ? DRIVER : null,
      previewed_driver: null,
      suggested_driver: { id: TEAM_IDS.driverDiego, short_name: "Diego R." },
      tracking: this.tracking(d),
      cancellation: d.cancellation,
      problem: null,
      code_locked: false,
      geocode_status: d.geocode,
      needs_attention: d.needsAttention,
      created_at: d.createdAt,
      estimated_ready_at: null,
      ready_at: d.status === "ready" ? new Date().toISOString() : null,
      accept_deadline_at: null,
    };
  }

  detail(d: MockDelivery) {
    return {
      ...this.item(d),
      customer: { name: d.name, phone: d.phone, phone_localizer: null, address: d.address, location: null },
      payment: d.payment,
      delivery_fee: d.fee,
      notes: null,
      code: { mode: d.origin === "ifood" ? "origin" : "motoka", value: d.origin === "ifood" ? null : "4821", failed_attempts: 0, locked: false },
      tracking_url: d.phone ? `http://localhost:8787/r/#tok-${d.number}` : null,
      send_tracking_link: true,
      flags: { delivered_after_cancel: d.deliveredAfterCancel, late_pickup: false },
      after_cancel: d.afterCancel,
      return: { confirmed_by: null, received_by_establishment_at: null },
      events: d.events,
    };
  }

  private push(d: MockDelivery, type: string, to: string | null) {
    d.events.push({ seq: d.events.length + 1, type, to_status: to, actor: "establishment", recorded_at: new Date().toISOString() });
    if (to) d.status = to;
  }

  /** `[status, body]`; `null` se a rota não existe. */
  route(rest: string, method: string, query: URLSearchParams, json: Record<string, unknown>): [number, unknown] | null {
    this.calls.push(`${method} ${rest}`);
    if (rest === "" && method === "GET") {
      const scope = query.get("scope") ?? "open";
      const terminal = new Set(["delivered", "cancelled", "returned", "rejected"]);
      const open = this.items.filter((d) => !terminal.has(d.status));
      const pool = scope === "open" ? open : this.items;
      const offset = Number(query.get("offset") ?? 0);
      const limit = Number(query.get("limit") ?? 50);
      const sorted = [...pool].sort((a, b) => b.number - a.number);
      return [200, { count: Math.min(limit, Math.max(0, sorted.length - offset)), total: sorted.length, items: sorted.slice(offset, offset + limit).map((d) => this.item(d)), counts: { open: open.length, all: this.items.length } }];
    }
    if (rest === "/summary") return [200, { open: 0, awaiting_acceptance: 0, unassigned: 0, problem: 0, returning_cancelled: 0, code_locked: 0, stale: 0, needs_attention: this.items.filter((d) => d.needsAttention).length, after_cancel_pending: 0, done_today: { deliveries: 0, returns: 0 } }];
    if (rest === "/customers/lookup" && method === "POST") {
      if (this.lookupStatus !== 200) return [this.lookupStatus, { error_code: "RATE_LIMIT_EXCEEDED", detail: "x" }];
      return [200, { phone: String(json.phone), name: this.lookup.name, addresses: this.lookup.addresses }];
    }
    if (rest === "" && method === "POST") {
      this.createBodies.push(json);
      const existing = this.items.find((d) => d.clientRequestId !== null && d.clientRequestId === json.client_request_id);
      if (existing) return [200, this.detail(existing)];
      const customer = json.customer as { name: string; phone: string | null };
      const address = json.address as Record<string, string | null>;
      const payment = json.payment as Record<string, unknown>;
      const driver = json.driver as { mode: string };
      const d = this.seed({
        number: this.items.length + 100,
        status: "preparing",
        name: customer.name,
        phone: customer.phone ? `55${customer.phone}` : null,
        channel: String(json.channel),
        address: { zip_code: null, complement: null, reference: null, ...address },
        payment,
        fee: (json.delivery_fee as string | null) ?? null,
        driver: driver.mode === "auto",
        clientRequestId: String(json.client_request_id),
      });
      return [201, this.detail(d)];
    }
    const match = /^\/([^/]+)(?:\/(.+))?$/.exec(rest);
    const d = match ? this.items.find((i) => i.id === match[1]) : undefined;
    if (!match || !d) return null;
    const action = match[2];
    if (!action && method === "GET") return [200, this.detail(d)];
    if (method !== "POST") return null;
    switch (action) {
      case "ready":
        this.push(d, "ready", "ready");
        return [200, this.detail(d)];
      case "cancel":
        d.cancellation = { by: "establishment", at: new Date().toISOString(), reason: String(json.reason), after_pickup: false };
        this.push(d, "cancelled", "cancelled");
        return [200, this.detail(d)];
      case "assign":
        d.driver = true;
        this.push(d, "driver_assigned", null);
        return [200, this.detail(d)];
      case "unassign":
        d.driver = false;
        this.push(d, "driver_unassigned", null);
        return [200, this.detail(d)];
      case "tracking-link/sent":
        d.trackingSent = true;
        return [200, { tracking_url: `http://localhost:8787/r/#tok-${d.number}`, sent_at: new Date().toISOString() }];
      case "after-cancel-ack":
        d.afterCancel = { acknowledged_at: new Date().toISOString(), charged: json.charged === true, charged_amount: (json.charged_amount as string | undefined) ?? null };
        return [200, this.detail(d)];
      default:
        return null;
    }
  }
}
