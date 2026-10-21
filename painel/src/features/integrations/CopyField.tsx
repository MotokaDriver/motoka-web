"use client";

import { useId, useState } from "react";
import { Btn } from "@/ui/Btn";
import { useToast } from "@/ui/Toast";

/**
 * Valor para copiar (URL do operador, Client ID, secret). `secret` esconde o texto até "Mostrar". Copiar usa só a área de
 * transferência: o valor nunca vai para storage, log, toast ou URL (o toast diz só o nome do campo).
 */
export function CopyField({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const id = useId();
  const toast = useToast();
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
      toast({ title: `${label} copiado.` });
    } catch {
      toast({ title: "Não foi possível copiar. Selecione o texto e copie." });
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="type-label-md text-text-secondary">
        {label}
      </span>
      <div className="flex gap-2">
        <output aria-labelledby={id} className="type-body-sm flex min-h-10 min-w-0 flex-1 items-center overflow-hidden rounded-md border border-border bg-surface-variant px-3 font-mono text-text-primary">
          <span className="truncate" data-testid={secret ? "secret-value" : undefined}>
            {shown ? value : "••••••••••••••••••••"}
          </span>
        </output>
        {secret && (
          <Btn kind="secondary" icon={shown ? "visibility_off" : "visibility"} aria-label={shown ? `Ocultar ${label}` : `Mostrar ${label}`} onClick={() => setShown((v) => !v)}>
            {shown ? "Ocultar" : "Mostrar"}
          </Btn>
        )}
        <Btn kind="secondary" icon={copied ? "check" : "content_copy"} aria-label={`Copiar ${label}`} onClick={() => void copy()}>
          {copied ? "Copiado" : "Copiar"}
        </Btn>
      </div>
    </div>
  );
}
