"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useStaff,
  fetchPointageEntriesForStaffDay,
  fetchCorrectionsForStaffDay,
  addPointageCorrection,
} from "@/lib/data";
import { useRestaurant, useRestaurantFilter } from "@/lib/restaurant";

const TYPE_LABELS = {
  arrivee: "Arrivée",
  pause_debut: "Début de pause",
  pause_fin: "Fin de pause",
  depart: "Départ",
};

const inputStyle = { background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" };

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeOf(occurredAt) {
  const d = new Date(occurredAt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function RegularisationAdmin({ readOnly }) {
  const { staff } = useStaff();
  const restaurantFilter = useRestaurantFilter();
  const restaurant = useRestaurant(restaurantFilter);

  const activeStaff = useMemo(() => [...staff].filter((s) => s.active).sort((a, b) => a.fullName.localeCompare(b.fullName, "fr")), [staff]);

  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [entries, setEntries] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!staffId && activeStaff.length > 0) setStaffId(activeStaff[0].id);
  }, [activeStaff, staffId]);

  const reload = () => {
    if (!staffId || !date) return;
    setLoading(true);
    Promise.all([fetchPointageEntriesForStaffDay(staffId, date), fetchCorrectionsForStaffDay(staffId, date)])
      .then(([e, c]) => {
        setEntries(e);
        setCorrections(c);
      })
      .finally(() => setLoading(false));
  };

  useEffect(reload, [staffId, date]);

  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("depart");
  const [formTarget, setFormTarget] = useState(""); // "" = ajout, sinon id du pointage à corriger
  const [formTime, setFormTime] = useState("");
  const [formBy, setFormBy] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function openForm(target) {
    setFormTarget(target ? target.id : "");
    setFormType(target ? target.type : "depart");
    setFormTime(target ? timeOf(target.occurredAt) : "");
    setFormBy("");
    setFormReason("");
    setFormError("");
    setShowForm(true);
  }

  async function submitCorrection() {
    if (!formTime || !formBy.trim() || !formReason.trim()) {
      setFormError("Heure, corrigé par et raison sont obligatoires.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const [h, m] = formTime.split(":").map(Number);
      const [y, mo, d] = date.split("-").map(Number);
      const correctedOccurredAt = new Date(y, mo - 1, d, h, m, 0, 0).toISOString();
      await addPointageCorrection({
        staffId,
        restaurantId: restaurant.id,
        type: formType,
        originalEntryId: formTarget || null,
        correctedOccurredAt,
        correctedBy: formBy.trim(),
        reason: formReason.trim(),
      });
      setShowForm(false);
      reload();
    } catch (err) {
      console.error(err);
      setFormError("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const correctedEntryIds = new Set(corrections.filter((c) => c.originalEntryId).map((c) => c.originalEntryId));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {readOnly && (
        <div className="text-xs font-bold mb-5 px-4 py-2 rounded-full inline-block" style={{ background: "#2c1c14", color: "#a88f78" }}>
          👁️ Vue Direction en lecture seule — pour régulariser un pointage, utilise l'espace équipe du restaurant
        </div>
      )}

      <div className="text-xs text-[#8a7561] mb-5 max-w-xl">
        Un pointage enregistré ne peut jamais être modifié ni supprimé (obligation légale — art. L.3171-4). Une
        régularisation ajoute une correction tracée (qui, quand, pourquoi) à côté, qui remplace l'heure prise en
        compte dans les calculs sans toucher au pointage brut.
      </div>

      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Salarié</div>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            {activeStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Date</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </div>
      </div>

      {loading && <p className="text-[#8a7561]">Chargement…</p>}

      {!loading && (
        <>
          <div className="mb-6 max-w-xl">
            <div className="text-xs uppercase font-bold text-[#a88f78] mb-2">Pointages du jour</div>
            {entries.length === 0 && <p className="text-sm text-[#8a7561]">Aucun pointage ce jour-là.</p>}
            <div className="flex flex-col gap-2">
              {entries.map((e) => (
                <div key={e.id} className="rounded-xl border border-[#3a2b1f] px-4 py-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-sm">
                    {timeOf(e.occurredAt)} · {TYPE_LABELS[e.type]}
                    {correctedEntryIds.has(e.id) && (
                      <span className="ml-2 text-xs font-bold rounded-full px-2 py-0.5" style={{ background: "#4a3a10", color: "#f0c860" }}>
                        corrigé
                      </span>
                    )}
                  </span>
                  {!readOnly && (
                    <button onClick={() => openForm(e)} className="tap-scale text-xs font-bold text-[#c9b8a4] underline">
                      corriger l'heure
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6 max-w-xl">
            <div className="text-xs uppercase font-bold text-[#a88f78] mb-2">Régularisations appliquées</div>
            {corrections.length === 0 && <p className="text-sm text-[#8a7561]">Aucune pour ce jour.</p>}
            <div className="flex flex-col gap-2">
              {corrections.map((c) => (
                <div key={c.id} className="rounded-xl border border-[#3a2b1f] px-4 py-2 text-sm">
                  <div className="font-mono">
                    {timeOf(c.correctedOccurredAt)} · {TYPE_LABELS[c.type]}
                    {!c.originalEntryId && (
                      <span className="ml-2 text-xs font-bold rounded-full px-2 py-0.5" style={{ background: "#204a3a", color: "#a8e8c8" }}>
                        pointage ajouté
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#8a7561] mt-1">
                    Corrigé par {c.correctedBy} — {c.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!readOnly && !showForm && (
            <button
              onClick={() => openForm(null)}
              className="tap-scale rounded-full px-6 py-3 font-bold"
              style={{ background: "#C0392B", color: "#fff5ea" }}
            >
              + Ajouter un pointage manquant
            </button>
          )}

          {!readOnly && showForm && (
            <div className="rounded-2xl border p-4 max-w-xl flex flex-col gap-3" style={{ borderColor: "#3a2b1f", background: "#211712" }}>
              <div className="font-bold">{formTarget ? "Corriger l'heure d'un pointage" : "Ajouter un pointage manquant"}</div>

              <div className="flex flex-wrap gap-3">
                <div>
                  <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Type</div>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    disabled={Boolean(formTarget)}
                    className="rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Heure corrigée</div>
                  <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle} />
                </div>
              </div>

              <div>
                <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Corrigé par</div>
                <input
                  value={formBy}
                  onChange={(e) => setFormBy(e.target.value)}
                  placeholder="Nom du responsable"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={inputStyle}
                />
              </div>

              <div>
                <div className="text-xs text-[#a88f78] uppercase font-bold mb-1">Raison</div>
                <input
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Ex. oubli de pointer le départ, confirmé par la fermeture caisse"
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={inputStyle}
                />
              </div>

              {formError && <div className="text-sm" style={{ color: "#e88a8a" }}>{formError}</div>}

              <div className="flex gap-3">
                <button
                  onClick={submitCorrection}
                  disabled={saving}
                  className="tap-scale rounded-full px-6 py-3 font-bold disabled:opacity-40"
                  style={{ background: "#C0392B", color: "#fff5ea" }}
                >
                  Enregistrer la régularisation
                </button>
                <button onClick={() => setShowForm(false)} className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                  Annuler
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
