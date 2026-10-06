"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { getAcceptSound, subscribePrefs } from "@/lib/prefs/prefs";

let context: AudioContext | null = null;

/** Sinal curto (dois tons) feito na hora, sem arquivo de áudio. Falha em silêncio: o aviso visual continua valendo. */
export function playBeep(): void {
  try {
    const audio = (context ??= new AudioContext());
    void audio.resume();
    const start = audio.currentTime;
    [880, 1175].forEach((frequency, i) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, start + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.18 + 0.16);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start + i * 0.18);
      oscillator.stop(start + i * 0.18 + 0.18);
    });
  } catch {
    // Sem áudio neste navegador.
  }
}

/** Texto do título com a aba oculta: "(1) Pedido aguardando". */
export const alertTitle = (count: number): string => `(${count}) ${count === 1 ? "Pedido aguardando" : "Pedidos aguardando"}`;

/**
 * Avisos de um pedido esperando o aceite com a aba oculta: o título pisca ("(1) Pedido aguardando") e, só se a pessoa
 * ligou o som em Conta, toca um sinal a cada pedido novo. Visível, o título fica quieto.
 */
export function useAwaitingAlerts(ids: readonly string[]): void {
  const sound = useSyncExternalStore(subscribePrefs, getAcceptSound, () => false);
  const seen = useRef(new Set<string>());
  const count = ids.length;
  const key = ids.join(",");

  useEffect(() => {
    if (count === 0) return;
    const original = document.title;
    const title = alertTitle(count);
    let flip = false;
    const apply = () => {
      if (!document.hidden) {
        document.title = original;
        return;
      }
      flip = !flip;
      document.title = flip ? title : original;
    };
    apply();
    const timer = setInterval(apply, 1000);
    document.addEventListener("visibilitychange", apply);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", apply);
      document.title = original;
    };
  }, [count]);

  useEffect(() => {
    const fresh = key === "" ? [] : key.split(",").filter((id) => !seen.current.has(id));
    for (const id of fresh) seen.current.add(id);
    if (fresh.length > 0 && sound) playBeep();
  }, [key, sound]);
}
