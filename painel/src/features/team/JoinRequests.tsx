"use client";

import { relativeTime } from "@/features/notices/logic";
import { Avatar } from "@/ui/Avatar";
import { Btn } from "@/ui/Btn";
import { entityColor, formatPhone, type Member } from "./model";

/**
 * "Pedidos para entrar (N)": quem entrou pelo link e espera a loja (vínculo `pending`). Aprovar abre o
 * combinado opcional; recusar pede confirmação. Uma ação por vez (`busyId`).
 */
export function JoinRequests({
  requests,
  now,
  busyId,
  onApprove,
  onReject,
}: {
  requests: readonly Member[];
  now: Date;
  busyId: string | null;
  onApprove: (member: Member) => void;
  onReject: (member: Member) => void;
}) {
  if (requests.length === 0) return null;
  return (
    <section aria-labelledby="join-requests-title" className="mx-5 mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3.5 lg:mx-7">
      <h2 id="join-requests-title" className="type-title-sm font-semibold">
        Pedidos para entrar ({requests.length})
      </h2>
      <p className="type-body-sm mt-0.5 text-text-secondary">Entraram pelo link da loja e esperam a sua aprovação para receber turnos.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {requests.map((member) => {
          const phone = formatPhone(member.driver.phone);
          const when = member.joinedAt ? relativeTime(member.joinedAt, now) : "";
          const busy = busyId === member.id;
          return (
            <li key={member.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-3">
              <Avatar initials={member.driver.initials} color={entityColor(member.driver.id)} size={34} />
              <div className="min-w-0 flex-1">
                <p className="type-label-lg truncate font-semibold">{member.driver.fullName}</p>
                <p className="type-caption text-text-tertiary">{[phone, when && `pediu ${when.toLowerCase()}`].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="flex gap-2">
                <Btn
                  kind="danger"
                  disabled={busyId !== null}
                  aria-label={`Recusar o pedido de ${member.driver.fullName}`}
                  onClick={() => onReject(member)}
                >
                  Recusar
                </Btn>
                <Btn
                  loading={busy}
                  disabled={busyId !== null}
                  aria-label={`Aprovar o pedido de ${member.driver.fullName}`}
                  onClick={() => onApprove(member)}
                >
                  Aprovar
                </Btn>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
