"use client";

import { useState } from "react";
import { useTeamPin } from "@/lib/data";
import { primeAudioContext } from "@/lib/sound";

export default function PinScreen({ onSuccess, onCancel }) {
  const { pin: teamPin } = useTeamPin();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const [pressed, setPressed] = useState(null);

  function press(d) {
    setPressed(d);
    setTimeout(() => setPressed(null), 200);
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setErr(false);
    if (next.length === 4) {
      if (next === teamPin) {
        // Débloque l'audio pendant qu'on est encore dans le geste utilisateur
        // (clic) — voir lib/sound.js. Fait ici, pas dans onSuccess (async).
        primeAudioContext();
        setTimeout(onSuccess, 150);
      }
      else
        setTimeout(() => {
          setErr(true);
          setPin("");
        }, 300);
    }
  }

  return (
    <div className="kiosk-root--pin">
      <p className="mb-4 uppercase text-sm tracking-wide font-bold" style={{ color: "var(--color-text-muted)" }}>Code équipe</p>
      <div className="flex gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 ${err ? "border-red-500" : ""}`}
            style={
              err
                ? {}
                : pin.length > i
                ? { background: "var(--color-accent)", borderColor: "var(--color-accent)" }
                : { borderColor: "var(--color-border-muted)" }
            }
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "←"].map((d, i) => (
          <button
            key={i}
            onClick={() => (d === "←" ? setPin(pin.slice(0, -1)) : d !== "" ? press(String(d)) : null)}
            className="w-20 h-20 rounded-full text-2xl font-bold transition-all duration-100"
            style={
              pressed === String(d)
                ? { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "var(--color-text-alt)", transform: "scale(0.92)" }
                : { background: "var(--color-surface)", border: "1px solid var(--color-border)" }
            }
          >
            {d}
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="mt-10 text-sm tap-scale" style={{ color: "var(--color-text-faint)" }}>
        Retour à la borne
      </button>
    </div>
  );
}
