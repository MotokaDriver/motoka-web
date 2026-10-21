"use client";

import { useEffect } from "react";

// Entrada suave dos blocos [data-reveal] ao rolar. Sem JS (ou com movimento reduzido, ver
// globals.css) o conteúdo aparece direto: a classe que esconde só entra quando o observer existe.
export default function Reveal() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    root.classList.add("js-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove("js-reveal");
    };
  }, []);
  return null;
}
