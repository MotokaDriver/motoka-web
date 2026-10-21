"use client";

import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { useId } from "react";
import { cn } from "@/ui/cn";
import { Field } from "@/ui/Field";
import { SelectField } from "@/ui/SelectField";
import { PAY_TYPES, currencyInput, usesDailyRate, usesPerDeliveryRate, type PayType } from "./model";

export interface DealFieldsValue {
  readonly type: PayType;
  /** Texto como o campo mostra ("R$ 90,00"). */
  readonly daily: string;
  readonly perDelivery: string;
  readonly rain: number | null;
}

const RAIN_OPTIONS = [0, 5, 10, 20] as const;

/**
 * Campos de um combinado (tipo, tarifas, adicional de chuva): usados no diálogo "Combinado padrão" e
 * no "Outro valor" do drawer de turno. Só mostra a tarifa que o tipo usa.
 */
export function DealFields({
  value,
  onChange,
}: {
  value: DealFieldsValue;
  onChange: (next: DealFieldsValue) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span id={labelId} className="type-body-sm text-text-secondary">
          Tipo de remuneração
        </span>
        <RadioGroup
          aria-labelledby={labelId}
          value={value.type}
          onValueChange={(next) => onChange({ ...value, type: next as PayType })}
          className="grid grid-cols-3 gap-2"
        >
          {PAY_TYPES.map((option) => (
            <Radio.Root
              key={option.value}
              value={option.value}
              className={cn(
                "type-label-md min-h-11 cursor-pointer rounded-md border border-border px-2 py-2 text-center font-semibold text-text-secondary",
                "data-[checked]:border-primary data-[checked]:bg-primary-tint data-[checked]:text-primary-text",
              )}
            >
              {option.label}
            </Radio.Root>
          ))}
        </RadioGroup>
      </div>
      {usesDailyRate(value.type) && (
        <Field
          label="Diária"
          inputMode="numeric"
          autoComplete="off"
          value={value.daily}
          onChange={(event) => onChange({ ...value, daily: currencyInput(event.target.value) })}
        />
      )}
      {usesPerDeliveryRate(value.type) && (
        <Field
          label="Por entrega"
          inputMode="numeric"
          autoComplete="off"
          value={value.perDelivery}
          onChange={(event) => onChange({ ...value, perDelivery: currencyInput(event.target.value) })}
        />
      )}
      <SelectField
        label="Adicional de chuva"
        value={String(value.rain ?? 0)}
        onChange={(event) => {
          const percent = Number(event.target.value);
          onChange({ ...value, rain: percent === 0 ? null : percent });
        }}
      >
        {RAIN_OPTIONS.map((percent) => (
          <option key={percent} value={percent}>
            {percent === 0 ? "Nenhum" : `${percent}%`}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
