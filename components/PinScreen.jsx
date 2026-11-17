"use client";

import { useEffect, useRef, useState } from "react";
import { useTeamPin, logTeamPinAttempt, checkTeamDeviceAllowed, requestTeamDeviceApproval, fetchTeamDeviceStatus } from "@/lib/data";
import { primeAudioContext } from "@/lib/sound";

export default function PinScreen({ onSuccess, onCancel }) {
  const { pin: teamPin } = useTeamPin();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const [pressed, setPressed] = useState(null);
  const [refused, setRefused] = useState(false);
  // Nouvel appareil : en attente de l'approbation de la Direction.
  const [waiting, setWaiting] = useState(false);
  // onSuccess est recréée à chaque rendu du parent : on la garde en référence pour
  // que l'attente ne soit pas relancée à chaque rendu.
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  // Pendant l'attente, on interroge l'état toutes les 4 s ; dès que la Direction
  // approuve, on entre tout seul (refus : message « plus autorisé »).
  useEffect(() => {
    if (!waiting) return undefined;
    let stopped = false;
    const timer = setInterval(async () => {
      const status = await fetchTeamDeviceStatus();
      if (stopped) return;
      if (status === "approved") {
        stopped = true;
        clearInterval(timer);
        onSuccessRef.current();
      } else if (status === "blocked") {
        stopped = true;
        clearInterval(timer);
        setWaiting(false);
        setRefused(true);
      }
    }, 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [waiting]);

  function press(d) {
    setPressed(d);
    setTimeout(() => setPressed(null), 200);
    const next = (pin + d).slice(0, 4);
    setPin(next);
    setErr(false);
    setRefused(false);
    if (next.length === 4) {
      logTeamPinAttempt(next === teamPin);
      if (next === teamPin) {
        // Débloque l'audio pendant qu'on est encore dans le geste utilisateur
        // (clic) — voir lib/sound.js. Fait ici, avant tout await, pas dans onSuccess.
        primeAudioContext();
        // Mode « appareils autorisés » (désactivé par défaut) : la Direction peut
        // n'accepter que les appareils qu'elle a nommés. En cas de panne du
        // contrôle, checkTeamDeviceAllowed laisse passer.
        checkTeamDeviceAllowed().then(async (allowed) => {
          if (!allowed) {
            setRefused(true);
            setPin("");
            return;
          }
          // Appareil jamais vu : la Direction doit l'approuver avant l'entrée.
          const status = await requestTeamDeviceApproval();
          if (status === "pending") {
            setPin("");
            setWaiting(true);
          } else if (status === "blocked") {
            setRefused(true);
            setPin("");
          } else {
            setTimeout(onSuccess, 150);
          }
        });
      }
      else
        setTimeout(() => {
          setErr(true);
          setPin("");
        }, 300);
    }
  }

  if (waiting) {
    return (
      <div className="kiosk-root--pin">
        <p className="text-[#a88f78] mb-4 uppercase text-sm tracking-wide font-bold">Nouvel appareil</p>
        <p className="text-xl font-bold text-center max-w-xs mb-3">En attente d'approbation de la Direction</p>
        <p className="text-[#a88f78] text-sm text-center max-w-xs mb-8">
          Préviens la direction : elle doit valider cet appareil. Tu entreras automatiquement dès que c'est fait.
        </p>
        <div className="w-10 h-10 rounded-full border-4 border-[#3a2b1f] border-t-[#C0392B] animate-spin" />
        <button onClick={onCancel} className="mt-10 text-[#8a7561] text-sm tap-scale">
          Retour à la borne
        </button>
      </div>
    );
  }

  return (
    <div className="kiosk-root--pin">
      <p className="text-[#a88f78] mb-4 uppercase text-sm tracking-wide font-bold">Code équipe</p>
      {refused && (
        <p className="text-[#C0392B] text-sm font-bold text-center max-w-xs mb-4">
          Cet appareil n'est plus autorisé. Contacte la direction.
        </p>
      )}
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
