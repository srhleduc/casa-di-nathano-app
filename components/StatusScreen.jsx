"use client";

import { useEffect } from "react";

export default function StatusScreen({ title, subtitle, success, onDone, bigNumber }) {
  useEffect(() => {
    const t = setTimeout(onDone, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      {success && <span className="text-7xl mb-6">✅</span>}
      <h2 className="display-font text-4xl font-semibold mb-4">{title}</h2>
      {bigNumber != null && (
        <div className="rounded-3xl border-2 px-12 py-6 mb-6" style={{ borderColor: "var(--color-accent)", background: "var(--color-surface-alt)" }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--color-text-muted)" }}>Ton numéro de commande</div>
          <div className="display-font text-6xl font-bold" style={{ color: "var(--color-accent-gold)" }}>N°{bigNumber}</div>
        </div>
      )}
      <p className="text-lg max-w-md" style={{ color: "var(--color-text-subtle)" }}>{subtitle}</p>
    </div>
  );
}
