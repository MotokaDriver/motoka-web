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
