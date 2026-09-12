"use client";

import { useCallback, useEffect, useState } from "react";
import { findStaffByPin, getLastPointageType, addPointageEntry } from "@/lib/data";
import { useRestaurant, useRestaurantFilter } from "@/lib/restaurant";
import PointageInfoNotice from "./PointageInfoNotice";

const ACTION_SEQUENCE = {
  start: { type: "arrivee", label: "Pointer l'arrivée" },
  arrivee: { type: "pause_debut", label: "Démarrer la pause" },
  pause_debut: { type: "pause_fin", label: "Terminer la pause" },
  pause_fin: { type: "depart", label: "Pointer le départ" },
  depart: { type: "arrivee", label: "Pointer l'arrivée" },
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function PointageKiosk({ readOnly }) {
  const restaurantFilter = useRestaurantFilter();
  const restaurant = useRestaurant(restaurantFilter);

  const [pin, setPin] = useState("");
  const [staffMember, setStaffMember] = useState(null);
  const [lastType, setLastType] = useState("start");
  const [status, setStatus] = useState("idle"); // idle | checking | ready | confirmed | error
  const [errorMessage, setErrorMessage] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  const resetKiosk = useCallback(() => {
    setPin("");
    setStaffMember(null);
    setLastType("start");
    setStatus("idle");
    setErrorMessage("");
  }, []);

  useEffect(() => {
    if (status === "confirmed" || status === "error") {
      const timeout = setTimeout(resetKiosk, status === "confirmed" ? 3000 : 2500);
      return () => clearTimeout(timeout);
    }
  }, [status, resetKiosk]);

  const lookupStaff = useCallback(
    async (code) => {
      setStatus("checking");
      try {
        const match = await findStaffByPin(restaurant.id, code);
        if (!match) {
          setErrorMessage("Code non reconnu");
          setStatus("error");
          return;
        }
        const type = await getLastPointageType(match.id);
        setStaffMember(match);
        setLastType(type || "start");
        setStatus("ready");
      } catch (err) {
        console.error(err);
        setErrorMessage("Le pointage n'a pas pu être vérifié");
        setStatus("error");
      }
    },
    [restaurant.id]
  );

  function handleDigit(digit) {
    if (status !== "idle" || pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    if (nextPin.length === 4) void lookupStaff(nextPin);
  }

  function handleClear() {
    if (status === "idle") setPin("");
  }

  async function confirmAction() {
    if (!staffMember || readOnly) return;
    const action = ACTION_SEQUENCE[lastType];
    setStatus("checking");
    try {
      await addPointageEntry(staffMember.id, staffMember.restaurantId, action.type);
      setLastType(action.type);
      setStatus("confirmed");
    } catch (err) {
      console.error(err);
      setErrorMessage("Le pointage n'a pas pu être enregistré");
      setStatus("error");
    }
  }

  const nextAction = ACTION_SEQUENCE[lastType];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8 py-10 relative">
      <button
        onClick={() => setShowInfo(true)}
        className="tap-scale absolute top-4 right-6 text-xs font-bold px-4 py-2 rounded-full border-2 border-[#3a2b1f] text-[#c9b8a4]"
      >
        ℹ️ Vos droits (RGPD)
      </button>
      {showInfo && <PointageInfoNotice restaurantId={restaurant.id} onClose={() => setShowInfo(false)} />}

      {readOnly && (
        <div className="text-xs font-bold px-4 py-2 rounded-full" style={{ background: "#2c1c14", color: "#a88f78" }}>
          👁️ Vue Direction — le pointage est réservé au poste du restaurant
        </div>
      )}

      {status === "confirmed" && staffMember ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="display-font text-3xl font-bold">{staffMember.fullName}</div>
          <div className="text-[#a88f78]">Pointage enregistré ✓</div>
        </div>
      ) : status === "ready" && staffMember ? (
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="display-font text-3xl font-bold">{staffMember.fullName}</div>
          <button
            onClick={() => void confirmAction()}
            disabled={readOnly}
            className="tap-scale rounded-full px-8 py-4 font-bold text-lg disabled:opacity-40"
            style={{ background: "#C0392B", color: "#fff5ea" }}
          >
            {nextAction.label}
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-4 h-4 rounded-full"
                style={{ border: "2px solid #C0392B", background: i < pin.length ? "#C0392B" : "transparent" }}
              />
            ))}
          </div>
          {status === "error" && <div className="text-sm font-bold" style={{ color: "#e88a8a" }}>{errorMessage}</div>}
          {status === "checking" && <div className="text-sm text-[#a88f78]">Vérification…</div>}
          <div className="grid grid-cols-3 gap-4">
            {KEYS.map((digit) => (
              <button
                key={digit}
                onClick={() => handleDigit(digit)}
                className="tap-scale w-20 h-20 rounded-full text-2xl font-bold"
                style={{ border: "1px solid #3a2b1f", background: "#211712", color: "#f5ebdd" }}
              >
                {digit}
              </button>
            ))}
            <button onClick={handleClear} className="tap-scale w-20 h-20 rounded-full text-sm font-bold text-[#8a7561]">
              Effacer
            </button>
            <button
              onClick={() => handleDigit("0")}
              className="tap-scale w-20 h-20 rounded-full text-2xl font-bold"
              style={{ border: "1px solid #3a2b1f", background: "#211712", color: "#f5ebdd" }}
            >
              0
            </button>
            <div />
          </div>
        </>
      )}
    </div>
  );
}
