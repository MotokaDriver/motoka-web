import { TEAM_IDS } from "./mockTeam";

/** Estado de /v1/teams/me/settlements do mock (S5–S9): o servidor faz as contas, como na API real. */
interface Line {
  id: string;
  number: number;
  kind: "delivery" | "return" | "pending";
  reason: string | null;
}

interface MockSettlement {
  id: string;
  status: "pending_driver" | "pending_store" | "disputed" | "confirmed" | "paid";
  version: number;
  date: string;
  daily: number;
  unit: number;
  rainPercent: number | null;
  rainApplied: boolean;
  adjustment: number;
  adjustmentNote: string | null;
  lines: Line[];
  excluded: string[];
  history: Array<{ action: string; actor_role: string; at: string; total_seen: string | null; note: string | null }>;
  paidNote: string | null;
}

const cents = (n: number) => (n / 100).toFixed(2);
const DRIVER = { id: TEAM_IDS.driverDiego, full_name: "Diego Ramos", short_name: "Diego R.", initials: "DR" };

export class MockSettlements {
  items: MockSettlement[] = [];
  calls: string[] = [];
  bodies: Array<{ route: string; body: Record<string, unknown> }> = [];
  /** Chave Pix do motoboy; `null` simula "sem chave". */
  pixKey: string | null = "diego@exemplo.com";
  /** `false`: o motoboy saiu da equipe, e a loja só vê a máscara. */
  keyVisible = true;
  private counter = 0;

  private uuid(prefix: string): string {
    this.counter += 1;
    return `${prefix}${String(this.counter).padStart(7, "0")}-0000-4000-8000-000000000000`;
  }

  seed(over: Omit<Partial<MockSettlement>, "lines"> & { lines?: Array<{ number: number; kind?: Line["kind"]; reason?: string | null }> } = {}): MockSettlement {
    const given: Array<{ number: number; kind?: Line["kind"]; reason?: string | null }> = over.lines ?? [1, 2, 3, 4, 5].map((number) => ({ number }));
    const lines: Line[] = given.map((l) => ({ id: this.uuid("f"), number: l.number, kind: l.kind ?? "delivery", reason: l.reason ?? null }));
    const item: MockSettlement = {
      id: this.uuid("a"),
      status: "pending_store",
      version: 3,
      date: "2026-09-29",
      daily: 9000,
      unit: 600,
      rainPercent: 10,
      rainApplied: false,
      adjustment: 0,
      adjustmentNote: null,
      excluded: [],
      history: [{ action: "created", actor_role: "system", at: new Date().toISOString(), total_seen: null, note: null }],
      paidNote: null,
      ...over,
      lines,
    };
    this.items.push(item);
    return item;
  }

  private counted(s: MockSettlement) {
    const deliveries = s.lines.filter((l) => l.kind === "delivery" && !s.excluded.includes(l.id)).length;
    const returns = s.lines.filter((l) => l.kind === "return" && !s.excluded.includes(l.id)).length;
    const pending = s.lines.filter((l) => l.kind === "pending" && !s.excluded.includes(l.id));
    return { deliveries, returns, pending };
  }

  private total(s: MockSettlement): number {
    const { deliveries, returns } = this.counted(s);
    const subtotal = s.daily + (deliveries + returns) * s.unit;
    const rain = s.rainApplied && s.rainPercent ? Math.round((subtotal * s.rainPercent) / 100) : 0;
    return subtotal + rain + s.adjustment;
  }

  summary(s: MockSettlement) {
    const { deliveries, returns, pending } = this.counted(s);
    return {
      id: s.id,
      kind: "shift",
      sequence: 0,
      status: s.status,
      occurrence_date: s.date,
      establishment: { id: "5b6acbe2-9c52-4a61-945b-9aae70c59fdc", name: "Padaria Teste", initials: "PT" },
      driver: DRIVER,
      deliveries_count: deliveries,
      returns_count: returns,
      pending_count: pending.length,
      total: cents(this.total(s)),
      deal_incomplete: false,
    };
  }

  detail(s: MockSettlement) {
    const { deliveries, returns, pending } = this.counted(s);
    const subtotal = s.daily + (deliveries + returns) * s.unit;
    const rain = s.rainApplied && s.rainPercent ? Math.round((subtotal * s.rainPercent) / 100) : 0;
    const frozen = s.status === "confirmed" || s.status === "paid";
    const key = frozen && this.pixKey ? { type: "email", masked: "d•••@exemplo.com", value: this.keyVisible ? this.pixKey : null } : null;
    return {
      ...this.summary(s),
      session_id: this.uuid("c"),
      parent_id: null,
      version: s.version,
      scheduled: { start_time: "18:00", end_time: "23:00" },
      started_at: "2026-09-29T21:00:00Z",
      ended_at: "2026-09-30T02:00:00Z",
      online_seconds: 18000,
      deal: { pay_type: "fixed_plus_per_delivery", daily_rate: "90.00", per_delivery_rate: cents(s.unit), rain_bonus_percent: s.rainPercent },
      daily: { amount: cents(s.daily) },
      deliveries: { count: deliveries, unit: cents(s.unit), amount: cents(deliveries * s.unit) },
      returns: { count: returns, unit: cents(s.unit), amount: cents(returns * s.unit), items: [] },
      subtotal: cents(subtotal),
      rain: { percent: s.rainPercent, applied: s.rainApplied, amount: cents(rain) },
      adjustment: { amount: cents(s.adjustment), note: s.adjustmentNote },
      pending: pending.map((l) => ({ delivery_id: l.id, number: l.number, reason: l.reason ?? "return_receipt" })),
      excluded: s.lines.filter((l) => s.excluded.includes(l.id)).map((l) => ({ delivery_id: l.id, number: l.number })),
      lines: s.lines
        .filter((l) => !s.excluded.includes(l.id))
        .map((l) => ({ delivery_id: l.id, number: l.number, kind: l.kind, reason: l.reason, occurred_at: "2026-09-29T22:00:00Z", address_line: `Rua ${l.number}, 10`, amount: l.kind === "pending" ? null : cents(s.unit) })),
      driver_decision: null,
      driver_confirmed_total: null,
      confirmed_over_dispute: s.history.some((h) => h.action === "disputed") && frozen,
      confirmed_at: frozen ? new Date().toISOString() : null,
      paid_at: s.status === "paid" ? new Date().toISOString() : null,
      paid_note: s.paidNote,
      history: s.history,
      payout_key: key,
      frozen,
    };
  }

  private push(s: MockSettlement, action: string, role: string, note: string | null = null) {
    s.version += 1;
    s.history.push({ action, actor_role: role, at: new Date().toISOString(), total_seen: cents(this.total(s)), note });
  }

  route(rest: string, method: string, query: URLSearchParams, json: Record<string, unknown>): [number, unknown] | null {
    this.calls.push(`${method} ${rest}`);
    if (rest === "" && method === "GET") {
      let items = this.items;
      const status = query.get("status");
      if (status) items = items.filter((s) => status.split(",").includes(s.status));
      if (query.get("needs_action") === "true") items = items.filter((s) => s.status === "pending_store" || s.status === "disputed");
      const week = query.get("week_start");
      const summaries = items.map((s) => this.summary(s));
      const total = summaries.reduce((sum, i) => sum + Number(i.total), 0);
      const units = items.reduce((sum, s) => sum + this.counted(s).deliveries + this.counted(s).returns, 0);
      return [
        200,
        {
          count: summaries.length,
          total: total.toFixed(2),
          items: summaries,
          week: week ? { week_start: week, total: total.toFixed(2), units } : null,
          needs_action_count: this.items.filter((s) => s.status === "pending_store" || s.status === "disputed").length,
        },
      ];
    }
    const match = /^\/([^/]+)(?:\/(confirm|paid))?$/.exec(rest);
    const s = match ? this.items.find((i) => i.id === match[1]) : undefined;
    if (!match || !s) return match ? [404, { error_code: "TEAM_SETTLEMENT_NOT_FOUND", detail: "x" }] : null;
    const action = match[2];
    const conflict = (): [number, unknown] => [409, { error_code: "TEAM_SETTLEMENT_VERSION_CONFLICT", detail: "x" }];
    this.bodies.push({ route: `${method} ${action ?? ""}`, body: json });
    if (!action && method === "GET") return [200, this.detail(s)];
    if (!action && method === "PATCH") {
      if (s.status === "confirmed" || s.status === "paid") return [409, { error_code: "TEAM_SETTLEMENT_ALREADY_CLOSED", detail: "x" }];
      if (json.version !== s.version) return conflict();
      const before = this.total(s);
      if (typeof json.rain_applied === "boolean") s.rainApplied = json.rain_applied;
      if (typeof json.adjustment_amount === "string") {
        s.adjustment = Math.round(Number(json.adjustment_amount) * 100);
        s.adjustmentNote = (json.adjustment_note as string | null) ?? null;
      }
      if (Array.isArray(json.excluded_delivery_ids)) s.excluded = json.excluded_delivery_ids as string[];
      this.push(s, "adjusted", "establishment", s.adjustmentNote);
      if (this.total(s) !== before && (s.status === "pending_store" || s.status === "disputed")) s.status = "pending_driver";
      return [200, this.detail(s)];
    }
    if (action === "confirm") {
      if (s.status === "pending_driver") return [409, { error_code: "TEAM_SETTLEMENT_AWAITING_DRIVER", detail: "x" }];
      if (s.status === "confirmed" || s.status === "paid") return [200, this.detail(s)];
      if (json.version !== s.version || json.expected_total !== cents(this.total(s))) return conflict();
      const { pending } = this.counted(s);
      if (pending.length > 0) {
        return [409, { error_code: "TEAM_SETTLEMENT_HAS_PENDING_LINES", detail: "x", errors: pending.map((l) => ({ field: l.id, message: l.reason ?? "return_receipt" })) }];
      }
      s.status = "confirmed";
      this.push(s, "store_confirmed", "establishment");
      return [200, this.detail(s)];
    }
    if (action === "paid") {
      if (s.status === "paid") return [200, this.detail(s)];
      if (s.status !== "confirmed") return [409, { error_code: "TEAM_SETTLEMENT_NOT_CONFIRMED", detail: "x" }];
      s.status = "paid";
      s.paidNote = (json.note as string | undefined) ?? null;
      this.push(s, "paid", "establishment", s.paidNote);
      return [200, this.detail(s)];
    }
    return null;
  }
}
