"use client";

import { useEffect, useState } from "react";

/**
 * QR do link de convite como SVG de um só `<path>` (sem `dangerouslySetInnerHTML`, sem canvas e sem
 * `data:`: a CSP não precisa de nada novo). A lib carrega só quando o modal abre. Fundo branco nos
 * dois temas: o QR precisa do contraste para ser lido.
 */
export function QrCode({ value }: { value: string }) {
  const [path, setPath] = useState<{ size: number; d: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then(({ create }) => {
      if (cancelled) return;
      const qr = create(value, { errorCorrectionLevel: "M" });
      const size = qr.modules.size;
      let d = "";
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
        }
      }
      setPath({ size, d });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) return <span className="type-caption text-center text-neutral-700">QR indisponível. Use o link.</span>;
  if (!path) return null;
  return (
    <svg viewBox={`0 0 ${path.size} ${path.size}`} width={152} height={152} shapeRendering="crispEdges" aria-hidden>
      <path d={path.d} fill="#000" />
    </svg>
  );
}
