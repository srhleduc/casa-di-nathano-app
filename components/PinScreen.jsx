"use client";

import { useState } from "react";
import { useTeamPin } from "@/lib/data";

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
      if (next === teamPin) setTimeout(onSuccess, 150);
      else
        setTimeout(() => {
          setErr(true);
          setPin("");
        }, 300);
    }
  }

  return (
    <div className="kiosk-root--pin">
      <p className="text-[#a88f78] mb-4 uppercase text-sm tracking-wide font-bold">Code équipe</p>
      <div className="flex gap-4 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-5 h-5 rounded-full border-2 ${pin.length > i ? "bg-[#C0392B] border-[#C0392B]" : "border-[#4a3826]"} ${err ? "border-red-500" : ""}`} />
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
                ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea", transform: "scale(0.92)" }
                : { background: "#241811", border: "1px solid #3a2b1f" }
            }
          >
            {d}
          </button>
        ))}
      </div>
      <button onClick={onCancel} className="mt-10 text-[#8a7561] text-sm tap-scale">
        Retour à la borne
      </button>
    </div>
  );
}
