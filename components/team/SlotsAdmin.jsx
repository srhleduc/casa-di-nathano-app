"use client";

import { useEffect, useState } from "react";
import { useSlots, insertSlot, updateSlotCapacity, deleteSlot, clearAllSlots, bulkUpsertSlots, useSlotDefaults, setSlotDefaults } from "@/lib/data";
import { parseMinutes } from "@/lib/business";

// Les créneaux midi/soir sont maintenant ouverts automatiquement chaque nuit
// (voir supabase/schema.sql, tâche "casa-di-nathano-daily-reset") — les
// boutons "Générer" restent utiles pour régénérer/ajuster en cours de
// journée, et mémorisent la capacité utilisée comme nouveau défaut pour la
// prochaine génération automatique.
const MIDI_SOIR_CUTOFF_MINUTES = 16 * 60; // tout avant 16h = midi, après = soir
function isMidiSlot(label) {
  const mins = parseMinutes(label);
  return mins !== null && mins < MIDI_SOIR_CUTOFF_MINUTES;
}

export default function SlotsAdmin() {
  const { slots, reload } = useSlots();
  const { slotDefaults, loading: defaultsLoading } = useSlotDefaults();
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("6");
  const [capMidi, setCapMidi] = useState("6");
  const [capSoir, setCapSoir] = useState("6");
  const [defaultsInitialized, setDefaultsInitialized] = useState(false);
  const [service, setService] = useState("midi"); // "midi" | "soir"

  useEffect(() => {
    if (!defaultsLoading && !defaultsInitialized) {
      setCapMidi(String(slotDefaults.midiCapacity));
      setCapSoir(String(slotDefaults.soirCapacity));
      setDefaultsInitialized(true);
    }
  }, [defaultsLoading, defaultsInitialized, slotDefaults]);

  function addSlot() {
    if (!label.match(/^\d{1,2}[:h]\d{2}$/)) return;
    const clean = label.replace("h", ":");
    insertSlot({ label: clean, capacity: parseInt(capacity, 10) || 0 }).catch((err) => console.error(err));
    setLabel("");
  }
  function removeSlot(id) {
    deleteSlot(id).catch((err) => console.error(err));
  }
  function updateCapacity(id, val) {
    updateSlotCapacity(id, parseInt(val, 10) || 0).catch((err) => console.error(err));
  }
  // Calcule en minutes totales (pas en heures/minutes séparées) pour que la
  // plage du soir puisse aller jusqu'à minuit inclus (24:00) sans bricolage
  // de dépassement d'heure.
  function bulkGenerate(start, end, step, cap) {
    const out = [];
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const totalStart = sh * 60 + sm;
    const totalEnd = eh * 60 + em;
    for (let t = totalStart; t <= totalEnd; t += step) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      out.push({ label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, capacity: cap });
    }
    bulkUpsertSlots(out).catch((err) => console.error(err));
  }
  function generateMidi() {
    const cap = parseInt(capMidi, 10) || 0;
    bulkGenerate("12:00", "15:00", 10, cap);
    setSlotDefaults({ midiCapacity: cap }).catch((err) => console.error(err));
  }
  function generateSoir() {
    const cap = parseInt(capSoir, 10) || 0;
    bulkGenerate("18:00", "24:00", 10, cap);
    setSlotDefaults({ soirCapacity: cap }).catch((err) => console.error(err));
  }

  const visibleSlots = slots.filter((s) => (service === "midi" ? isMidiSlot(s.label) : !isMidiSlot(s.label)));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="text-xs text-[#8a7561] mb-4">
        🌙 Les créneaux midi et soir s'ouvrent automatiquement chaque nuit (capacité = dernière valeur utilisée ci-dessous) — les boutons
        "Générer" servent à régénérer/ajuster en cours de journée si besoin.
      </div>
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="rounded-xl border border-[#3a2b1f] p-4 flex-1 min-w-[240px]">
          <div className="font-bold mb-2">☀️ Service midi (12h–15h, ttes les 10 min)</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#a88f78]">Pizzas max / créneau</span>
            <input value={capMidi} onChange={(e) => setCapMidi(e.target.value)} type="number" className="w-16 text-center rounded-lg px-2 py-1" style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }} />
            <button onClick={generateMidi} className="tap-scale rounded-lg px-4 py-2 text-sm font-bold ml-auto" style={{ background: "#C0392B", color: "#fff5ea" }}>
              Générer
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-[#3a2b1f] p-4 flex-1 min-w-[240px]">
          <div className="font-bold mb-2">🌙 Service soir (18h–minuit, ttes les 10 min)</div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#a88f78]">Pizzas max / créneau</span>
            <input value={capSoir} onChange={(e) => setCapSoir(e.target.value)} type="number" className="w-16 text-center rounded-lg px-2 py-1" style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }} />
            <button onClick={generateSoir} className="tap-scale rounded-lg px-4 py-2 text-sm font-bold ml-auto" style={{ background: "#C0392B", color: "#fff5ea" }}>
              Générer
            </button>
          </div>
        </div>
        <button onClick={() => clearAllSlots().catch((err) => console.error(err))} className="tap-scale rounded-xl border border-red-800 text-red-400 px-4 py-3 text-sm font-bold self-start">
          Tout effacer
        </button>
        <button onClick={() => reload()} className="tap-scale rounded-xl border border-[#3a2b1f] px-4 py-3 text-sm font-bold self-start">
          🔄 Actualiser
        </button>
      </div>

      <div className="flex items-end gap-3 mb-6">
        <div>
          <div className="text-xs text-[#a88f78] mb-1">Horaire (ex 19:30)</div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-lg px-3 py-2 w-28" style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }} />
        </div>
        <div>
          <div className="text-xs text-[#a88f78] mb-1">Pizzas max</div>
          <input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" className="rounded-lg px-3 py-2 w-24" style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }} />
        </div>
        <button onClick={addSlot} className="tap-scale rounded-lg px-5 py-2 font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
          Ajouter
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setService("midi")}
          className={`tap-scale rounded-full px-5 py-2 font-bold border-2 ${service === "midi" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}
        >
          ☀️ Service midi
        </button>
        <button
          onClick={() => setService("soir")}
          className={`tap-scale rounded-full px-5 py-2 font-bold border-2 ${service === "soir" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}
        >
          🌙 Service soir
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {visibleSlots
          .slice()
          .sort((a, b) => (parseMinutes(a.label) ?? 0) - (parseMinutes(b.label) ?? 0))
          .map((s) => (
            <div key={s.id} className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-3 flex flex-col items-center">
              <span className="font-bold">{s.label}</span>
              <input
                defaultValue={s.capacity}
                onBlur={(e) => updateCapacity(s.id, e.target.value)}
                type="number"
                className="w-16 text-center bg-transparent border-b border-[#3a2b1f] my-1"
              />
              <button onClick={() => removeSlot(s.id)} className="text-xs text-red-400 tap-scale">
                Supprimer
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
