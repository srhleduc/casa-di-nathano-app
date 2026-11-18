"use client";

// Page publique de suivi de commande (lien reçu par email). Aucune connexion :
// le jeton secret du lien identifie la commande. Rafraîchie toutes les 10 s.

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { trackingProgress } from "@/lib/orderTracking";
import { formatSlotAllocations } from "@/lib/business";

const eur = (n) => `${Number(n || 0).toFixed(2).replace(".", ",")} €`;

export default function SuiviPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch(`/api/suivi?t=${encodeURIComponent(token)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (stop) return;
        if (!res.ok) {
          setError(json.error || "Suivi indisponible.");
          if (res.status === 404 || res.status === 400) setData(null);
          return;
        }
        setData(json);
        setError(null);
      } catch {
        if (!stop) setError("Connexion perdue, nouvelle tentative…");
      }
    }
    load();
    const t = setInterval(load, 10000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [token]);

  const progress = data ? trackingProgress({ status: data.status, deliveryStatus: data.deliveryStatus }) : null;
  const slotTxt = data?.slot ? formatSlotAllocations(data.slot) : data?.scheduledTime || null;
  const done = progress && !progress.cancelled && progress.current === progress.steps.length - 1;

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10" style={{ background: "#14100c", color: "#f5ebdd" }}>
      <div className="w-full max-w-md">
        {!data && !error && <p className="text-center text-[#8a7561]">Chargement…</p>}
        {!data && error && <p className="text-center" style={{ color: "#e88a8a" }}>{error}</p>}
        {data && (
          <>
            <p className="text-center text-sm uppercase tracking-wide text-[#a88f78]">{data.restaurantName}</p>
            <h1 className="display-font text-4xl font-semibold text-center mt-2">Commande N°{data.number}</h1>
            {data.isTest && <p className="text-center text-sm mt-2" style={{ color: "#f0c860" }}>🧪 Commande de test</p>}
            {slotTxt && <p className="text-center text-[#c9b8a4] mt-2">🕐 {slotTxt}</p>}

            {progress.cancelled ? (
              <p className="text-center mt-8 font-bold" style={{ color: "#e88a8a" }}>Cette commande a été annulée.</p>
            ) : (
              <ol className="mt-8 flex flex-col gap-3">
                {progress.steps.map((label, i) => {
                  const reached = i <= progress.current;
                  const active = i === progress.current && !done;
                  return (
                    <li
                      key={label}
                      className="flex items-center gap-4 rounded-2xl px-5 py-4 border-2"
                      style={{
                        background: reached ? "#2c1c14" : "#1c1510",
                        borderColor: active ? "#E8B23D" : reached ? "#204a3a" : "#2a2018",
                        opacity: reached ? 1 : 0.55,
                      }}
                    >
                      <span className="text-2xl">{reached && !active ? "✅" : active ? "⏳" : "⚪"}</span>
                      <span className="font-bold text-lg">{label}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {data.deliveryAddress && <p className="text-sm text-[#a88f78] mt-6 text-center">📍 {data.deliveryAddress}</p>}

            <div className="mt-8 rounded-2xl p-5" style={{ background: "#1c1510", border: "1px solid #2a2018" }}>
              {data.items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm py-1">
                  <span>
                    {it.qty} × {it.name}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-bold mt-3 pt-3" style={{ borderTop: "1px solid #2a2018" }}>
                <span>Total {data.deliveryStatus ? "(à régler au livreur)" : "(à régler sur place)"}</span>
                <span style={{ color: "#E8B23D" }}>{eur(data.total)}</span>
              </div>
            </div>

            {data.restaurantPhone && (
              <p className="text-center text-sm text-[#8a7561] mt-6">
                Une question ?{" "}
                <a href={`tel:${data.restaurantPhone.replace(/\s+/g, "")}`} className="font-bold text-[#E8B23D]">
                  {data.restaurantPhone}
                </a>
              </p>
            )}
            {error && <p className="text-center text-xs mt-4 text-[#8a7561]">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
