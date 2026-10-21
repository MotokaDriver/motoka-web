import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const http = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/features/session/runtime", () => ({ apiFetch: http.apiFetch }));

const { approveMember, fetchMembers, rejectMember } = await import("@/features/team/api");

const ID = "66666666-6666-4666-8666-666666666666";
const RAW = {
  id: ID,
  driver: { id: "d6", full_name: "Paulo Souza", initials: "PS", phone: "5541988887766" },
  status: "active",
  source: "via_link",
  access: "team",
  joined_at: "2026-10-20T10:00:00Z",
  deal: { pay_type: "per_delivery", daily_rate: null, per_delivery_rate: "7.00", rain_bonus_percent: null },
  also_in_other_team: false,
};

beforeEach(() => {
  http.apiFetch.mockReset();
  http.apiFetch.mockResolvedValue(RAW);
});

describe("pedidos para entrar (API)", () => {
  it("approveMember sem combinado vai sem corpo", async () => {
    await approveMember(ID, null);
    const [url, init] = http.apiFetch.mock.calls[0]!;
    expect(url).toBe(`/teams/me/members/${ID}/approve`);
    expect(init).toEqual({ method: "POST" });
    expect(init.body).toBeUndefined();
  });

  it("approveMember com combinado manda {deal} no formato da API", async () => {
    const member = await approveMember(ID, { payType: "per_delivery", dailyRate: "90.00", perDeliveryRate: "7.00", rainBonusPercent: null });
    expect(http.apiFetch.mock.calls[0]![1]).toEqual({
      method: "POST",
      body: { deal: { pay_type: "per_delivery", daily_rate: null, per_delivery_rate: "7.00", rain_bonus_percent: null } },
    });
    expect(member.status).toBe("active");
  });

  it("rejectMember e fetchMembers('pending')", async () => {
    await rejectMember(ID);
    expect(http.apiFetch.mock.calls[0]).toEqual([`/teams/me/members/${ID}/reject`, { method: "POST" }]);
    http.apiFetch.mockResolvedValue({ count: 1, items: [{ ...RAW, status: "pending" }] });
    const items = await fetchMembers("pending");
    expect(http.apiFetch.mock.calls[1]).toEqual(["/teams/me/members", { query: { status: "pending" }, signal: undefined }]);
    expect(items[0]?.status).toBe("pending");
  });

  it("id fora de UUID não vira caminho", async () => {
    await expect(approveMember("../x", null)).rejects.toBeInstanceOf(ApiError);
    expect(http.apiFetch).not.toHaveBeenCalled();
  });
});
