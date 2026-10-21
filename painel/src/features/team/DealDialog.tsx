"use client";

import { useState } from "react";
import { Btn } from "@/ui/Btn";
import { Dialog } from "@/ui/Dialog";
import { dealIsValid } from "./addShift";
import { DealFields, type DealFieldsValue } from "./DealFields";
import { currencyInput, currencyToDecimal, formatMoney, type Deal, type Member } from "./model";

export const DEAL_HELP =
  "Vale para os próximos turnos. Os turnos já criados mantêm o valor de quando foram salvos.";

const asField = (decimal: string | null): string => currencyInput((formatMoney(decimal) ?? "").replace(/\D/g, ""));

function initial(member: Member): DealFieldsValue {
  return {
    type: member.deal.payType,
    daily: asField(member.deal.dailyRate),
    perDelivery: asField(member.deal.perDeliveryRate),
    rain: member.deal.rainBonusPercent,
  };
}

function toDeal(value: DealFieldsValue): Deal {
  return {
    payType: value.type,
    dailyRate: currencyToDecimal(value.daily),
    perDeliveryRate: currencyToDecimal(value.perDelivery),
    rainBonusPercent: value.rain,
  };
}

/** Diálogo "Combinado de <nome>". Devolve o combinado a enviar; cancelar não devolve nada. */
export function DealDialog({
  member,
  onClose,
  onSave,
}: {
  member: Member | null;
  onClose: () => void;
  onSave: (member: Member, deal: Deal) => void;
}) {
  return (
    <Dialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={member ? `Combinado de ${member.driver.shortName}` : ""}
      description={DEAL_HELP}
    >
      {/* Remonta por membro: o estado do formulário nasce do combinado atual. */}
      {member && <DealForm key={member.id} member={member} onClose={onClose} onSave={onSave} />}
    </Dialog>
  );
}

function DealForm({
  member,
  onClose,
  onSave,
}: {
  member: Member;
  onClose: () => void;
  onSave: (member: Member, deal: Deal) => void;
}) {
  const [value, setValue] = useState(() => initial(member));
  const deal = toDeal(value);
  return (
    <>
      <div className="mt-6">
        <DealFields value={value} onChange={setValue} />
      </div>
      <div className="mt-6 flex gap-3">
        <Btn kind="secondary" className="flex-1" onClick={onClose}>
          Cancelar
        </Btn>
        <Btn
          className="flex-1"
          disabled={!dealIsValid(deal)}
          onClick={() => {
            onClose();
            onSave(member, deal);
          }}
        >
          Salvar
        </Btn>
      </div>
    </>
  );
}

export const APPROVE_HELP =
  "Ele entra na equipe e já pode receber turnos. Defina o combinado agora ou deixe para depois.";

/**
 * Diálogo "Aprovar <nome>" de um pedido para entrar pelo link. `onApprove` recebe o combinado a
 * enviar, ou `null` para aprovar sem mexer no combinado; fechar não aprova.
 */
export function ApproveDialog({
  member,
  onClose,
  onApprove,
}: {
  member: Member | null;
  onClose: () => void;
  onApprove: (member: Member, deal: Deal | null) => void;
}) {
  return (
    <Dialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={member ? `Aprovar ${member.driver.shortName}` : ""}
      description={APPROVE_HELP}
    >
      {member && <ApproveForm key={member.id} member={member} onClose={onClose} onApprove={onApprove} />}
    </Dialog>
  );
}

function ApproveForm({
  member,
  onClose,
  onApprove,
}: {
  member: Member;
  onClose: () => void;
  onApprove: (member: Member, deal: Deal | null) => void;
}) {
  const [value, setValue] = useState(() => initial(member));
  const deal = toDeal(value);
  const valid = dealIsValid(deal);
  const approve = (chosen: Deal | null) => {
    onClose();
    onApprove(member, chosen);
  };
  return (
    <>
      <div className="mt-6">
        <DealFields value={value} onChange={setValue} />
      </div>
      {/* Um só primário: com combinado válido aprova com ele; sem, aprova e o combinado fica para depois. */}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
        <Btn kind="ghost" className="flex-1" onClick={onClose}>
          Agora não
        </Btn>
        <Btn className="flex-1" onClick={() => approve(valid ? deal : null)}>
          {valid ? "Aprovar" : "Aprovar e combinar depois"}
        </Btn>
      </div>
    </>
  );
}
