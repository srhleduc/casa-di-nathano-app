"use client";

import { useServiceTypeSettings, setServiceTypeEnabled } from "@/lib/data";

const TYPES = [
  { key: "dineIn", label: "🍽️ Sur place", desc: "Clients à la borne et prise de commande serveuses" },
  { key: "takeaway", label: "🥡 À emporter", desc: "Clients à la borne et prise de commande serveuses" },
];

export default function ServiceTypesAdmin() {
  const { serviceTypeSettings } = useServiceTypeSettings();

  function toggle(key, current) {
    setServiceTypeEnabled(key, !current).catch((err) => console.error(err));
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="text-xs mb-5" style={{ color: "var(--color-text-faint)" }}>
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
              style={enabled ? { borderColor: "var(--color-border)" } : { borderColor: "var(--color-accent)", background: "var(--color-surface-alt)" }}
            >
              <div>
                <div className="font-bold text-lg mb-1">{t.label}</div>
                <div className="text-sm" style={{ color: "var(--color-text-muted)" }}>{t.desc}</div>
              </div>
              <span
                className="text-xs font-bold rounded-full px-4 py-2 shrink-0"
                style={enabled ? { background: "var(--color-success-bg)", color: "var(--color-success)" } : { background: "var(--color-danger-bg)", color: "var(--color-danger-soft)" }}
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
