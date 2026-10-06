import { apiFetch } from "@/features/session/runtime";
import { ApiError, isUuid } from "@/lib/api/errors";
import {
  dealBody,
  parseCreatedShifts,
  parseInviteCreated,
  parseInviteLink,
  parseInvites,
  parseMember,
  parseOnShift,
  parseSchedule,
  type CreatedShifts,
  type Deal,
  type Invite,
  type InviteCreated,
  type InviteLink,
  type Member,
  type OnShiftDriver,
  type Schedule,
} from "./model";

/** `/teams/me/*` (E1–E16). Todo id vira caminho só depois de passar por `isUuid`. */
const BASE = "/teams/me";

function path(...segments: string[]): string {
  for (const segment of segments) {
    if (!isUuid(segment)) throw new ApiError({ status: 404, code: "ROUTE_NOT_FOUND" });
  }
  return segments.join("/");
}

export const fetchSchedule = async (weekStart: string, signal?: AbortSignal): Promise<Schedule> =>
  parseSchedule(await apiFetch<unknown>(`${BASE}/schedule`, { query: { week_start: weekStart }, signal }));

export const fetchOnShift = async (signal?: AbortSignal): Promise<OnShiftDriver[]> =>
  parseOnShift(await apiFetch<unknown>(`${BASE}/on-shift`, { signal }));

export const updateDeal = async (memberId: string, deal: Deal): Promise<Member> =>
  parseMember(await apiFetch<unknown>(`${BASE}/members/${path(memberId)}`, { method: "PATCH", body: { deal: dealBody(deal) } }));

export type MemberAction = "pause" | "resume" | "remove";

export const memberAction = async (memberId: string, action: MemberAction): Promise<Member> =>
  parseMember(await apiFetch<unknown>(`${BASE}/members/${path(memberId)}/${action}`, { method: "POST" }));

export const fetchInviteLink = async (signal?: AbortSignal): Promise<InviteLink> =>
  parseInviteLink(await apiFetch<unknown>(`${BASE}/invite-link`, { signal }));

export const rotateInviteLink = async (): Promise<InviteLink> =>
  parseInviteLink(await apiFetch<unknown>(`${BASE}/invite-link/rotate`, { method: "POST" }));

export const createNominalInvite = async (name: string, phone: string): Promise<InviteCreated> =>
  parseInviteCreated(
    await apiFetch<unknown>(`${BASE}/invites`, {
      method: "POST",
      body: { invitee_name: name.trim(), invitee_phone: phone.replace(/\D/g, "") },
    }),
  );

export const fetchInvites = async (signal?: AbortSignal): Promise<Invite[]> =>
  parseInvites(await apiFetch<unknown>(`${BASE}/invites`, { signal }));

export const resendInvite = async (inviteId: string): Promise<InviteCreated> =>
  parseInviteCreated(await apiFetch<unknown>(`${BASE}/invites/${path(inviteId)}/resend`, { method: "POST" }));

export const revokeInvite = async (inviteId: string): Promise<void> => {
  await apiFetch<unknown>(`${BASE}/invites/${path(inviteId)}/revoke`, { method: "POST" });
};

export interface CreateShiftsInput {
  readonly membershipId: string;
  readonly weekdays: readonly number[];
  readonly startTime: string;
  readonly endTime: string;
  readonly weekStart: string;
  readonly repeatWeekly: boolean;
  readonly remindLocation: boolean;
  /** `null`: usa o combinado do membro. */
  readonly pay: Deal | null;
}

export const createShifts = async (input: CreateShiftsInput): Promise<CreatedShifts> =>
  parseCreatedShifts(
    await apiFetch<unknown>(`${BASE}/shifts`, {
      method: "POST",
      body: {
        membership_id: input.membershipId,
        weekdays: [...input.weekdays].sort((a, b) => a - b),
        start_time: input.startTime,
        end_time: input.endTime,
        week_start: input.weekStart,
        repeat_weekly: input.repeatWeekly,
        remind_location: input.remindLocation,
        ...(input.pay ? { pay: dealBody(input.pay) } : {}),
      },
    }),
  );

export const deleteShift = async (seriesId: string): Promise<void> => {
  await apiFetch<unknown>(`${BASE}/shifts/${path(seriesId)}`, { method: "DELETE" });
};
