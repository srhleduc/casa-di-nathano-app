"use client";

import { useState } from "react";
import {
  useStaff,
  addStaffWithPin,
  resetStaffPin,
  renameStaff,
  setStaffContract,
  setStaffActive,
  useStaffShifts,
  addStaffShift,
  deleteStaffShift,
} from "@/lib/data";

const CONTRACT_LABELS = { cdi: "CDI", cdd: "CDD", extra: "Extra", apprenti: "Apprenti" };

// weekday : 0 = dimanche … 6 = samedi (Date.getDay(), même convention que
// weekdayOf() côté réservation) — affiché lundi→dimanche.
const WEEKDAYS = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 0, label: "Dimanche" },
];

const collator = new Intl.Collator("fr", { sensitivity: "base" });

function ShiftPlanner({ staffId, shifts, readOnly }) {
  const [addingFor, setAddingFor] = useState(null);
  const [start, setStart] = useState("11:00");
  const [end, setEnd] = useState("15:00");
  const [err, setErr] = useState("");

  async function submit(weekday) {
    if (!start || !end || end <= start) {
      setErr("Heure de fin invalide");
      return;
    }
    setErr("");
    try {
      await addStaffShift(staffId, weekday, start, end);
      setAddingFor(null);
    } catch (e) {
      console.error(e);
      setErr("Ajout impossible");
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#3a2b1f] flex flex-col gap-2">
      {WEEKDAYS.map(({ value, label }) => {
        const dayShifts = shifts.filter((s) => s.weekday === value).sort((a, b) => a.startTime.localeCompare(b.startTime));
        return (
          <div key={value} className="flex items-center gap-2 flex-wrap text-sm">
            <span className="w-24 shrink-0 text-[#a88f78]">{label}</span>
            {dayShifts.map((s) => (
              <span
                key={s.id}
                className="rounded-full px-3 py-1 text-xs font-mono flex items-center gap-1.5"
                style={{ background: "#211712", border: "1px solid #3a2b1f" }}
              >
                {s.startTime}–{s.endTime}
                {!readOnly && (
                  <button onClick={() => deleteStaffShift(s.id).catch((e) => console.error(e))} className="tap-scale text-[#e88a8a]">
                    ✕
                  </button>
                )}
              </span>
            ))}
            {dayShifts.length === 0 && addingFor !== value && <span className="text-xs text-[#5a4a3a]">—</span>}
            {!readOnly && addingFor !== value && (
              <button
                onClick={() => {
                  setAddingFor(value);
                  setStart("11:00");
                  setEnd("15:00");
                  setErr("");
                }}
                className="tap-scale text-xs text-[#c9b8a4] underline"
              >
                + créneau
              </button>
            )}
            {!readOnly && addingFor === value && (
              <span className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="rounded px-2 py-1 text-xs"
                  style={{ background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
                />
                <span className="text-[#5a4a3a]">–</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="rounded px-2 py-1 text-xs"
                  style={{ background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
                />
                <button onClick={() => submit(value)} className="tap-scale text-xs font-bold px-3 py-1 rounded-full" style={{ background: "#C0392B", color: "#fff5ea" }}>
                  OK
                </button>
                <button onClick={() => setAddingFor(null)} className="tap-scale text-xs text-[#8a7561]">
                  annuler
                </button>
              </span>
            )}
          </div>
        );
      })}
      {err && <div className="text-xs" style={{ color: "#e88a8a" }}>{err}</div>}
    </div>
  );
}

function Row({ member, shifts, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(member.fullName);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false);

  function commit() {
    const v = value.trim();
    setEditing(false);
    if (!v || v === member.fullName) {
      setValue(member.fullName);
      return;
    }
    renameStaff(member.id, v).catch((err) => console.error(err));
  }

  return (
    <div
      className="rounded-2xl border-2 p-4 flex flex-col gap-2"
      style={member.active ? { borderColor: "#3a2b1f" } : { borderColor: "#4a2020", background: "#2c1c14" }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {editing && !readOnly ? (
              <input
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") {
                    setValue(member.fullName);
                    setEditing(false);
                  }
                }}
                className="display-font text-xl font-bold rounded-lg px-2 py-1 outline-none w-52"
                style={{ background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
              />
            ) : (
              <button
                onClick={() => !readOnly && setEditing(true)}
                className={`display-font text-xl font-bold text-left ${readOnly ? "" : "tap-scale"}`}
              >
                {member.fullName} {!readOnly && <span className="text-sm text-[#8a7561]">✏️</span>}
              </button>
            )}
            <span
              className="text-xs font-bold rounded-full px-3 py-1 shrink-0"
              style={member.active ? { background: "#204a3a", color: "#a8e8c8" } : { background: "#4a2020", color: "#e8a8a8" }}
            >
              {member.active ? "✓ Actif" : "✕ Désactivé"}
            </span>
          </div>
          <div className="text-xs text-[#8a7561] mt-2 flex items-center gap-2 font-mono">
            <span>Code PIN : {revealed ? member.pinCode : "••••"}</span>
            <button onClick={() => setRevealed((v) => !v)} className="tap-scale text-[#c9b8a4] underline">
              {revealed ? "masquer" : "afficher"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && (
            <select
              value={member.contractType}
              onChange={(e) => setStaffContract(member.id, e.target.value).catch((err) => console.error(err))}
              className="rounded-lg px-2 py-2 text-sm"
              style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
            >
              {Object.entries(CONTRACT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
          {readOnly && (
            <span className="text-xs font-bold rounded-full px-3 py-1" style={{ background: "#3a2b1f", color: "#c9b8a4" }}>
              {CONTRACT_LABELS[member.contractType]}
            </span>
          )}
          <button
            onClick={() => setPlanningOpen((v) => !v)}
            className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2"
            style={planningOpen ? { borderColor: "#C0392B", background: "#2c1c14", color: "#fff5ea" } : { borderColor: "#3a2b1f" }}
          >
            🗓️ Planning
          </button>
          {!readOnly && (
            <>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await resetStaffPin(member.id);
                    setRevealed(true);
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setBusy(false);
                  }
                }}
                className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2 border-[#3a2b1f] disabled:opacity-40"
              >
                🔁 Réinitialiser le PIN
              </button>
              <button
                onClick={() => setStaffActive(member.id, !member.active).catch((err) => console.error(err))}
                className="tap-scale rounded-full px-4 py-2 text-xs font-bold border-2"
                style={member.active ? { borderColor: "#4a2020", color: "#e8a8a8" } : { borderColor: "#204a3a", color: "#a8e8c8" }}
              >
                {member.active ? "Désactiver" : "Réactiver"}
              </button>
            </>
          )}
        </div>
      </div>

      {planningOpen && <ShiftPlanner staffId={member.id} shifts={shifts} readOnly={readOnly} />}
    </div>
  );
}

export default function StaffManagement({ readOnly }) {
  const { staff } = useStaff();
  const { staffShifts } = useStaffShifts();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContract, setNewContract] = useState("cdi");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = [...staff].sort((a, b) => collator.compare(a.fullName, b.fullName));

  async function handleAddStaff() {
    const trimmedName = newName.trim();
    if (!trimmedName || busy) {
      if (!trimmedName) setFormError("Le nom est requis");
      return;
    }
    setBusy(true);
    setFormError("");
    try {
      await addStaffWithPin(trimmedName, newContract);
      setNewName("");
      setNewContract("cdi");
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      setFormError(err.message || "L'ajout a échoué, réessaie");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {readOnly && (
        <div className="text-xs font-bold mb-5 px-4 py-2 rounded-full inline-block" style={{ background: "#2c1c14", color: "#a88f78" }}>
          👁️ Vue Direction en lecture seule — pour modifier une fiche, utilise l'espace équipe du restaurant
        </div>
      )}

      {!readOnly && (
        <div className="mb-6 max-w-xl">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="tap-scale rounded-full px-6 py-3 font-bold"
              style={{ background: "#C0392B", color: "#fff5ea" }}
            >
              + Ajouter un salarié
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-4" style={{ borderColor: "#3a2b1f", background: "#211712" }}>
              <input
                autoFocus
                placeholder="Nom complet"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddStaff()}
                className="rounded-xl px-4 py-3 outline-none"
                style={{ background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
              />
              <select
                value={newContract}
                onChange={(e) => setNewContract(e.target.value)}
                className="rounded-lg px-3 py-3"
                style={{ background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
              >
                {Object.entries(CONTRACT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button onClick={handleAddStaff} disabled={busy} className="tap-scale rounded-full px-6 py-3 font-bold disabled:opacity-40" style={{ background: "#C0392B", color: "#fff5ea" }}>
                Créer et attribuer un PIN
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setFormError("");
                  setNewName("");
                }}
                className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]"
              >
                Annuler
              </button>
              {formError && <div className="text-sm w-full" style={{ color: "#e88a8a" }}>{formError}</div>}
            </div>
          )}
        </div>
      )}

      {sorted.length === 0 && <p className="text-[#8a7561]">Aucun salarié pour le moment.</p>}

      <div className="flex flex-col gap-3 max-w-2xl">
        {sorted.map((member) => (
          <Row
            key={member.id}
            member={member}
            shifts={staffShifts.filter((s) => s.staffId === member.id)}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}
