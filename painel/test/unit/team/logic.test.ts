import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  availability,
  canSubmit,
  crossesMidnight,
  dropDisabledDays,
  initialForm,
  isDirty,
  submitFailure,
  submitLabel,
  successMessage,
  timeError,
  type AddShiftForm,
} from "@/features/team/addShift";
import { resolveWeek, weekRangeLabel, weekSelectorLabel, weekdayIndex } from "@/features/team/dates";
import {
  currencyInput,
  currencyToDecimal,
  dealBody,
  dealLabel,
  entityColor,
  formatMoney,
  formatPhone,
  parseDeal,
  parseMember,
  parseSchedule,
  phoneInput,
  timeInput,
  type Member,
} from "@/features/team/model";

const member = (over: Record<string, unknown> = {}): Member =>
  parseMember({
    id: "m1",
    driver: { id: "d1", full_name: "Diego Ramos", short_name: "Diego R.", initials: "DR", phone: "5541999990077" },
    status: "active",
    source: "link",
    access: "TEAM",
    joined_at: "2026-10-01T10:00:00Z",
    deal: { pay_type: "fixed_plus_per_delivery", daily_rate: "90.00", per_delivery_rate: "6.00", rain_bonus_percent: null },
    also_in_other_team: false,
    ...over,
  });

describe("semana", () => {
  it("?semana= inválido vira a semana atual", () => {
    const today = "2026-10-07"; // quarta
    expect(resolveWeek("2026-10-05", today)).toBe("2026-10-05");
    for (const bad of [null, "", "2026-10-06", "2026-02-30", "abc", "2026-10-05x", "26-10-05"]) {
      expect(resolveWeek(bad, today)).toBe("2026-10-05");
    }
  });
  it("rótulos", () => {
    expect(weekSelectorLabel("2026-10-05", "2026-10-07")).toBe("Esta semana");
    expect(weekSelectorLabel("2026-10-12", "2026-10-07")).toBe("Próxima semana");
    expect(weekSelectorLabel("2026-09-28", "2026-10-07")).toBe("Semana passada");
    expect(weekSelectorLabel("2026-10-19", "2026-10-07")).toBe("19–25 out");
    expect(weekRangeLabel("2026-09-28")).toBe("28 set – 4 out");
    expect(weekdayIndex("2026-10-05")).toBe(0);
    expect(weekdayIndex("2026-10-11")).toBe(6);
  });
});

describe("modelo", () => {
  it("parser tolera caixa e enum desconhecido", () => {
    const m = member({ status: "ACTIVE", access: "weird" });
    expect(m.status).toBe("active");
    expect(m.access).toBe("team");
    expect(parseDeal({ pay_type: "x" }).payType).toBe("per_delivery");
  });
  it("schedule sem week_start é ilegível", () => {
    expect(() => parseSchedule({})).toThrow(ApiError);
  });
  it("dinheiro como string, sem float", () => {
    expect(formatMoney("1234.5")).toBe("R$ 1.234,50");
    expect(formatMoney("90.00", true)).toBe("R$ 90");
    expect(formatMoney("abc")).toBeNull();
    expect(currencyInput("9000")).toBe("R$ 90,00");
    expect(currencyInput("")).toBe("");
    expect(currencyToDecimal("R$ 90,00")).toBe("90.00");
    expect(currencyToDecimal("R$ 0,05")).toBe("0.05");
  });
  it("combinado: rótulo e corpo (tarifa que o tipo não usa vai null)", () => {
    const deal = parseDeal({ pay_type: "fixed_plus_per_delivery", daily_rate: "90.00", per_delivery_rate: "6.00", rain_bonus_percent: 10 });
    expect(dealLabel(deal)).toBe("Diária R$ 90 + R$ 6 por entrega · +10% na chuva");
    expect(dealBody({ ...deal, payType: "per_delivery" })).toEqual({
      pay_type: "per_delivery",
      daily_rate: null,
      per_delivery_rate: "6.00",
      rain_bonus_percent: 10,
    });
    expect(dealLabel(parseDeal({ pay_type: "per_delivery" }))).toBe("A definir");
  });
  it("máscaras e cor estável", () => {
    expect(phoneInput("41999990077")).toBe("(41) 99999-0077");
    expect(formatPhone("5541999990077")).toBe("(41) 99999-0077");
    expect(timeInput("1800")).toBe("18:00");
    expect(entityColor("abc")).toBe(entityColor("abc"));
  });
});

describe("formulário de turno", () => {
  const week = "2026-10-05";
  const before = new Date("2026-10-05T10:00:00-03:00"); // segunda 10h
  const after = new Date("2026-10-07T19:00:00-03:00"); // quarta 19h

  it("abre em Outro valor para membro sem combinado, e com o único membro escolhido", () => {
    const noDeal = member({ deal: { pay_type: "per_delivery", daily_rate: null, per_delivery_rate: null } });
    expect(initialForm([noDeal]).membershipId).toBe("m1");
    expect(initialForm([noDeal]).payMode).toBe("custom");
    expect(initialForm([member(), member({ id: "m2" })]).membershipId).toBeNull();
  });

  it("horário: formato, igual, 16 h e virada de dia", () => {
    const f = (start: string, end: string) => ({ start, end });
    expect(timeError(f("18:0", "23:00"))).toMatch(/HH:MM/);
    expect(timeError(f("18:00", "18:00"))).toMatch(/diferente/);
    expect(timeError(f("06:00", "23:00"))).toMatch(/16 horas/);
    expect(timeError(f("18:00", "00:00"))).toBeNull();
    expect(crossesMidnight(f("18:00", "00:00"))).toBe(true);
  });

  it("dia que já começou: desabilitado sem repetir, 'semana que vem' repetindo", () => {
    const form: AddShiftForm = { ...initialForm([member()]), days: [0, 3] };
    expect(availability(form, week, 0, before)).toBe("available");
    expect(availability(form, week, 0, after)).toBe("startsNextWeek");
    const once = { ...form, repeatWeekly: false };
    expect(availability(once, week, 0, after)).toBe("started");
    expect(dropDisabledDays(once, week, after).days).toEqual([3]);
  });

  it("salvar, rótulo e sujo", () => {
    const m = member();
    const form = initialForm([m]);
    expect(canSubmit(form, m)).toBe(false);
    const ok = { ...form, days: [1, 3] };
    expect(canSubmit(ok, m)).toBe(true);
    expect(submitLabel(ok)).toBe("Salvar 2 turnos");
    expect(submitLabel({ ...ok, days: [1] })).toBe("Salvar 1 turno");
    expect(isDirty(form, m)).toBe(false);
    expect(isDirty(ok, m)).toBe(true);
    expect(canSubmit({ ...ok, payMode: "custom" }, m)).toBe(false);
  });

  it("DRIVER_BUSY marca os dias pelo errors[] e usa texto do catálogo", () => {
    const error = new ApiError({
      status: 409,
      code: "TEAM_SHIFT_DRIVER_BUSY",
      fieldErrors: [
        { field: "weekdays", detail: "3" },
        { field: "weekdays", detail: "1" },
        { field: "outro", detail: "2" },
      ],
    });
    expect(submitFailure(error)).toEqual({
      message: "Esse motoboy já tem turno nesse horário. Dias: Ter, Qui.",
      errorDays: [1, 3],
    });
    expect(submitFailure(new ApiError({ status: 422, code: "TEAM_SHIFT_INVALID_TIME" })).errorDays).toEqual([]);
  });

  it("mensagem de sucesso avisa os dias que começam na semana seguinte", () => {
    const m = member();
    expect(successMessage({ count: 1, items: [{ weekday: 1, validFrom: "2026-10-06" }] }, m, "2026-10-05")).toBe("1 turno salvo para Diego.");
    expect(
      successMessage(
        { count: 2, items: [{ weekday: 0, validFrom: "2026-10-12" }, { weekday: 2, validFrom: "2026-10-07" }] },
        m,
        "2026-10-05",
      ),
    ).toBe("2 turnos salvos para Diego. Seg começa em 12 out.");
  });
});
