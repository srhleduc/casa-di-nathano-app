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
        <div className="rounded-3xl border-2 border-[#C0392B] bg-[#2c1c14] px-12 py-6 mb-6">
          <div className="text-xs font-bold uppercase tracking-wide text-[#a88f78] mb-1">Ton numéro de commande</div>
          <div className="display-font text-6xl font-bold text-[#E8B23D]">N°{bigNumber}</div>
        </div>
      )}
      <p className="text-[#c9b8a4] text-lg max-w-md">{subtitle}</p>
    </div>
  );
}
