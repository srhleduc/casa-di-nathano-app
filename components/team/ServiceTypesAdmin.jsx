"use client";

import { useServiceTypeSettings, setServiceTypeEnabled } from "@/lib/data";

const TYPES = [
  { key: "dineIn", label: "🍽️ Sur place", desc: "Clients à la borne et prise de commande serveuses" },
  { key: "reserved", label: "🍽️ Sur place déjà réservé", desc: "Prise de commande serveuses uniquement" },
  { key: "takeaway", label: "🥡 À emporter", desc: "Clients à la borne et prise de commande serveuses" },
];

export default function ServiceTypesAdmin() {
  const { serviceTypeSettings } = useServiceTypeSettings();

  function toggle(key, current) {
    setServiceTypeEnabled(key, !current).catch((err) => console.error(err));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="text-xs text-[#8a7561] mb-5">
        Désactive un type de service pour qu'il n'apparaisse plus au choix — ni côté borne client, ni côté prise de commande serveuses.
      </div>
      <div className="flex flex-col gap-3 max-w-xl">
        {TYPES.map((t) => {
          const enabled = serviceTypeSettings[`${t.key}Enabled`];
          return (
            <button
              key={t.key}
              onClick={() => toggle(t.key, enabled)}
              className="tap-scale rounded-2xl border-2 p-5 text-left flex items-center justify-between gap-4"
              style={enabled ? { borderColor: "#3a2b1f" } : { borderColor: "#C0392B", background: "#2c1c14" }}
            >
              <div>
                <div className="font-bold text-lg mb-1">{t.label}</div>
                <div className="text-[#a88f78] text-sm">{t.desc}</div>
              </div>
              <span
                className="text-xs font-bold rounded-full px-4 py-2 shrink-0"
                style={enabled ? { background: "#204a3a", color: "#a8e8c8" } : { background: "#4a2020", color: "#e8a8a8" }}
              >
                {enabled ? "✓ Activé" : "✕ Désactivé"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
