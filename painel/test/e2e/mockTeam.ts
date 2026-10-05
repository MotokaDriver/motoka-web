/** Estado de /v1/teams/me/* do mock (E1–E16 mínimos para o fluxo do WN-1). */
export const TEAM_IDS = {
  diego: "11111111-1111-4111-8111-111111111111",
  driverDiego: "a1111111-1111-4111-8111-111111111111",
  link: "c1111111-1111-4111-8111-111111111111",
} as const;

interface TeamShift {
  id: string;
  membershipId: string;
  weekday: number;
  start: string;
  end: string;
  validFrom: string;
  repeats: boolean;
}

interface TeamInvite {
  id: string;
  name: string;
  phone: string;
  status: string;
}

const spDayOf = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const spTimeOf = (date: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
const addDay = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const mondayOf = (day: string) => addDay(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));

export class MockTeam {
  memberStatus = "active";
  shifts: TeamShift[] = [];
  invites: TeamInvite[] = [];
  linkVersion = 1;
  counter = 0;
  calls: string[] = [];
  deal = { pay_type: "fixed_plus_per_delivery", daily_rate: "90.00", per_delivery_rate: "6.00", rain_bonus_percent: null as number | null };

  private id(prefix: string): string {
    this.counter += 1;
    return `${prefix}${String(this.counter).padStart(7, "0")}-0000-4000-8000-000000000000`;
  }

  member() {
    return {
      id: TEAM_IDS.diego,
      driver: { id: TEAM_IDS.driverDiego, full_name: "Diego Ramos", short_name: "Diego R.", initials: "DR", phone: "5541999990077" },
      status: this.memberStatus,
      source: "link",
      access: "team",
      joined_at: new Date().toISOString(),
      deal: this.deal,
      also_in_other_team: false,
    };
  }

  schedule(weekStartParam: string | null) {
    const today = spDayOf(new Date());
    const weekStart = weekStartParam ?? mondayOf(today);
    const occurrences = this.shifts.flatMap((shift) => {
      const date = addDay(weekStart, shift.weekday);
      const sameWeek = mondayOf(shift.validFrom) === weekStart;
      if (date < shift.validFrom || (!shift.repeats && !sameWeek)) return [];
      return [
        {
          shift_id: shift.id,
          series_id: shift.id,
          membership_id: shift.membershipId,
          driver_id: TEAM_IDS.driverDiego,
          date,
          start_time: shift.start,
          end_time: shift.end,
          starts_at: `${date}T${shift.start}:00-03:00`,
          ends_at: `${date}T${shift.end}:00-03:00`,
          crosses_midnight: shift.end < shift.start,
          remind_location: true,
          repeats_weekly: shift.repeats,
          valid_from: shift.validFrom,
          valid_until: null,
          suspended: this.memberStatus === "paused",
          session: null,
        },
      ];
    });
    return {
      week_start: weekStart,
      week_end: addDay(weekStart, 6),
      today,
      members: this.memberStatus === "removed" ? [] : [this.member()],
      pending_invites: this.invites.filter((i) => i.status === "not_opened").map((i) => this.inviteItem(i)),
      occurrences,
      busy: [],
      coverage: [],
    };
  }

  inviteItem(i: TeamInvite) {
    return {
      id: i.id,
      invitee_name: i.name,
      invitee_phone: i.phone,
      initials: i.name.slice(0, 2).toUpperCase(),
      created_at: new Date().toISOString(),
      resent_at: null,
      opened_at: null,
      expires_at: null,
      status: i.status,
      deal: null,
    };
  }

  createInvite(name: string, phone: string) {
    const invite = { id: this.id("b"), name, phone: `55${phone}`, status: "not_opened" };
    this.invites.push(invite);
    return {
      id: invite.id,
      url: `http://localhost:8787/convite/tok-${invite.id.slice(0, 8)}`,
      token: "tok",
      invitee_name: name,
      invitee_phone: invite.phone,
      status: "not_opened",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    };
  }

  createShifts(body: { membership_id: string; weekdays: number[]; start_time: string; end_time: string; week_start: string; repeat_weekly: boolean }) {
    const now = `${spDayOf(new Date())}T${spTimeOf(new Date())}`;
    const items = body.weekdays.map((weekday) => {
      let validFrom = addDay(body.week_start, weekday);
      if (`${validFrom}T${body.start_time}` <= now && body.repeat_weekly) validFrom = addDay(validFrom, 7);
      const shift = { id: this.id("d"), membershipId: body.membership_id, weekday, start: body.start_time, end: body.end_time, validFrom, repeats: body.repeat_weekly };
      this.shifts.push(shift);
      return { id: shift.id, weekday, valid_from: validFrom, repeats_weekly: body.repeat_weekly };
    });
    return { batch_id: this.id("e"), count: items.length, items };
  }

  link() {
    return {
      id: TEAM_IDS.link,
      url: `http://localhost:8787/convite/link-v${this.linkVersion}`,
      token: "link",
      created_at: new Date().toISOString(),
      joins_last_24h: 0,
    };
  }

  /** Roteia `/teams/me/<rest>`. Devolve `[status, body]` ou `null` se a rota não existe. */
  route(rest: string, method: string, searchWeek: string | null, json: Record<string, unknown>): [number, unknown] | null {
    this.calls.push(`${method} ${rest}`);
    if (rest === "schedule") return [200, this.schedule(searchWeek)];
    if (rest === "on-shift") return [200, { count: 0, items: [] }];
    if (rest === "invite-link") return [200, this.link()];
    if (rest === "invite-link/rotate") {
      this.linkVersion += 1;
      return [200, this.link()];
    }
    if (rest === "invites" && method === "GET") return [200, { count: this.invites.length, items: this.invites.map((i) => this.inviteItem(i)) }];
    if (rest === "invites" && method === "POST") return [201, this.createInvite(String(json.invitee_name), String(json.invitee_phone))];
    const inviteAct = /^invites\/([^/]+)\/(resend|revoke)$/.exec(rest);
    if (inviteAct) {
      const invite = this.invites.find((i) => i.id === inviteAct[1]);
      if (!invite) return [404, { error_code: "TEAM_INVITE_NOT_FOUND", detail: "x" }];
      if (inviteAct[2] === "revoke") {
        invite.status = "revoked";
        return [204, undefined];
      }
      return [200, { id: invite.id, url: `http://localhost:8787/convite/re-${invite.id.slice(0, 8)}`, token: "tok", invitee_name: invite.name, invitee_phone: invite.phone, status: invite.status, expires_at: new Date(Date.now() + 86_400_000).toISOString() }];
    }
    const act = /^members\/[^/]+\/(pause|resume|remove)$/.exec(rest);
    if (act) {
      this.memberStatus = { pause: "paused", resume: "active", remove: "removed" }[act[1] as "pause" | "resume" | "remove"];
      return [200, this.member()];
    }
    if (/^members\/[^/]+$/.test(rest) && method === "PATCH") {
      this.deal = json.deal as MockTeam["deal"];
      return [200, this.member()];
    }
    if (rest === "shifts" && method === "POST") return [201, this.createShifts(json as never)];
    const shiftId = /^shifts\/([^/]+)$/.exec(rest)?.[1];
    if (shiftId && method === "DELETE") {
      this.shifts = this.shifts.filter((s) => s.id !== shiftId);
      return [204, undefined];
    }
    return null;
  }
}
