"use client";

// Espace Direction → Formules : créer / modifier / supprimer les formules
// (ex. « La Formule Casa » 20 € = pizza + dessert + soda).
//
// Une formule = un prix + des composants (pizza, dessert, boisson…). Pour
// chaque composant on coche les produits du menu qu'on peut y mettre, avec un
// supplément éventuel par produit (0 = inclus). On choisit aussi : sur place
// et/ou à emporter, les restaurants concernés, et les services de la semaine
// (jour × midi/soir) où la formule est proposée. Appliqué aussitôt sur la
// borne, le click & collect et la prise de commande équipe (voir
// components/FormulaModal.jsx). Logique de disponibilité : lib/formulas.js.

import { useMemo, useState } from "react";
import { CATEGORIES, ADMIN_ONLY_CATEGORIES, eur } from "@/lib/menu";
import { useMenu, useFormulas, insertFormula, updateFormula, deleteFormula } from "@/lib/data";
import { useRestaurantsList } from "@/lib/restaurant";
import { WEEK_DAYS, SERVICE_GROUPS, ALL_SERVICE_SLOTS, serviceSlotKey, summarizeServiceSlots } from "@/lib/formulas";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };
const PICKER_CATEGORIES = [...CATEGORIES, ...ADMIN_ONLY_CATEGORIES];
const SLOT_PRESETS = ["Pizza", "Dessert", "Boisson", "Autre"];

const newSlotId = () => `s-${Math.random().toString(36).slice(2, 8)}`;

const EMPTY_DRAFT = {
  id: null,
  name: "",
  description: "",
  price: "",
  active: true,
  dineIn: true,
  takeaway: true,
  restaurantIds: [],
  serviceSlots: [],
  slots: [],
};

function toDraft(f) {
  return {
    id: f.id,
    name: f.name,
    description: f.description || "",
    price: String(f.price),
    active: f.active,
    dineIn: f.dineIn,
    takeaway: f.takeaway,
    restaurantIds: [...f.restaurantIds],
    serviceSlots: [...f.serviceSlots],
    slots: f.slots.map((s) => ({
      id: s.id || newSlotId(),
      label: s.label || "",
      items: (s.items || []).map((e) => ({ itemId: e.itemId, supplement: String(e.supplement ?? 0) })),
    })),
  };
}

const parseMoney = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
};

function chipStyle(on) {
  return on ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]";
}

// ------------------------------------------------------------ composants --

function SlotEditor({ slot, index, count, menu, menuById, onChange, onRemove, onMove }) {
  const [cat, setCat] = useState("pizza");
  const selected = new Map(slot.items.map((e) => [e.itemId, e]));
  const catItems = menu.filter((m) => m.cat === cat).sort((a, b) => a.name.localeCompare(b.name));
  const allOn = catItems.length > 0 && catItems.every((m) => selected.has(m.id));

  function toggleItem(id) {
    onChange({
      ...slot,
      items: selected.has(id) ? slot.items.filter((e) => e.itemId !== id) : [...slot.items, { itemId: id, supplement: "0" }],
    });
  }
  function toggleCategory() {
    if (allOn) {
      const ids = new Set(catItems.map((m) => m.id));
      onChange({ ...slot, items: slot.items.filter((e) => !ids.has(e.itemId)) });
    } else {
      onChange({
        ...slot,
        items: [...slot.items, ...catItems.filter((m) => !selected.has(m.id)).map((m) => ({ itemId: m.id, supplement: "0" }))],
      });
    }
  }
  function setSupplement(id, v) {
    onChange({ ...slot, items: slot.items.map((e) => (e.itemId === id ? { ...e, supplement: v } : e)) });
  }

  return (
    <div className="rounded-2xl border border-[#3a2b1f] bg-[#1a120b] p-4">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-[#8a7561] font-bold">{index + 1}.</span>
        <input
          value={slot.label}
          onChange={(e) => onChange({ ...slot, label: e.target.value })}
          placeholder="Nom du composant (ex. Pizza)"
          className="flex-1 min-w-[180px] rounded-lg px-3 py-2 font-bold"
          style={inputStyle}
        />
        <button onClick={() => onMove(-1)} disabled={index === 0} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] font-bold disabled:opacity-30" aria-label="Monter">
          ↑
        </button>
        <button onClick={() => onMove(1)} disabled={index === count - 1} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] font-bold disabled:opacity-30" aria-label="Descendre">
          ↓
        </button>
        <button onClick={onRemove} className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f] text-[#e8806f]">
          Retirer
        </button>
      </div>

      <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">Produits possibles ({slot.items.length} choisi{slot.items.length > 1 ? "s" : ""})</div>
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {PICKER_CATEGORIES.map((c) => {
          const n = menu.filter((m) => m.cat === c.key && selected.has(m.id)).length;
          return (
            <button key={c.key} onClick={() => setCat(c.key)} className={`tap-scale shrink-0 rounded-full px-4 py-2 text-sm font-bold border-2 ${chipStyle(cat === c.key)}`}>
              {c.emoji} {c.label}
              {n > 0 && <span className="ml-1 text-[#E8B23D]">· {n}</span>}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={toggleCategory} className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
          {allOn ? "Tout décocher" : "Tout cocher"} dans cette catégorie
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {catItems.map((m) => (
          <button key={m.id} onClick={() => toggleItem(m.id)} className={`tap-scale rounded-full px-4 py-2 text-sm border-2 ${chipStyle(selected.has(m.id))}`}>
            {selected.has(m.id) ? "✓ " : ""}
            {m.name} <span className="text-[#8a7561]">({eur(m.price)})</span>
          </button>
        ))}
        {catItems.length === 0 && <p className="text-[#8a7561] text-sm">Aucun produit dans cette catégorie.</p>}
      </div>

      {slot.items.length > 0 && (
        <>
          <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">Suppléments (0 € = inclus dans le prix de la formule)</div>
          <div className="flex flex-col gap-2">
            {slot.items.map((e) => {
              const m = menuById.get(e.itemId);
              return (
                <div key={e.itemId} className="flex items-center gap-3 rounded-xl border border-[#3a2b1f] bg-[#211712] px-4 py-2">
                  <span className={`flex-1 min-w-0 truncate ${m ? "" : "text-[#e8806f]"}`}>{m ? m.name : "Produit supprimé du menu"}</span>
                  <span className="text-[#8a7561] text-sm">+</span>
                  <input
                    inputMode="decimal"
                    value={e.supplement}
                    onChange={(ev) => setSupplement(e.itemId, ev.target.value)}
                    className="w-20 rounded-lg px-3 py-1.5 text-right"
                    style={inputStyle}
                    aria-label={`Supplément ${m?.name || ""}`}
                  />
                  <span className="text-[#8a7561] text-sm">€</span>
                  <button onClick={() => toggleItem(e.itemId)} className="tap-scale w-8 h-8 rounded-full bg-[#3a2b1f] text-sm font-bold" aria-label="Retirer le produit">
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ServiceGrid({ value, onChange }) {
  const set = new Set(value);
  const toggle = (key) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange([...next]);
  };
  const toggleDay = (dow) => {
    const keys = SERVICE_GROUPS.map((g) => serviceSlotKey(dow, g.key));
    const allOn = keys.every((k) => set.has(k));
    const next = new Set(set);
    keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
    onChange([...next]);
  };
  const setGroup = (group) => onChange(WEEK_DAYS.map((d) => serviceSlotKey(d.dow, group)));

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => onChange([...ALL_SERVICE_SLOTS])} className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
          Tous les services
        </button>
        <button onClick={() => setGroup("midi")} className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
          ☀️ Tous les midis
        </button>
        <button onClick={() => setGroup("soir")} className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
          🌙 Tous les soirs
        </button>
        <button onClick={() => onChange([])} className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
          Aucun
        </button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {WEEK_DAYS.map((d) => (
          <div key={d.dow} className="flex flex-col gap-2">
            <button onClick={() => toggleDay(d.dow)} className="tap-scale text-xs font-bold text-[#c9b8a4] py-1" title="Cocher / décocher les deux services">
              {d.short}
            </button>
            {SERVICE_GROUPS.map((g) => {
              const on = set.has(serviceSlotKey(d.dow, g.key));
              return (
                <button
                  key={g.key}
                  onClick={() => toggle(serviceSlotKey(d.dow, g.key))}
                  aria-pressed={on}
                  aria-label={`${d.label} ${g.label}`}
                  className={`tap-scale rounded-xl py-3 text-lg border-2 ${chipStyle(on)}`}
                >
                  {on ? g.emoji : <span className="opacity-25">{g.emoji}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-[#8a7561] mt-2">
        ☀️ Midi = avant 15 h · 🌙 Soir = à partir de 15 h. Appuie sur un jour pour cocher ses deux services.
      </p>
    </div>
  );
}

function FormulaEditor({ initial, menu, menuById, restaurants, onClose }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const allRestaurants = draft.restaurantIds.length === 0;
  function toggleRestaurant(id) {
    set({ restaurantIds: draft.restaurantIds.includes(id) ? draft.restaurantIds.filter((x) => x !== id) : [...draft.restaurantIds, id] });
  }
  function updateSlot(i, slot) {
    set({ slots: draft.slots.map((s, j) => (j === i ? slot : s)) });
  }
  function moveSlot(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= draft.slots.length) return;
    const arr = [...draft.slots];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set({ slots: arr });
  }
  function addSlot(label) {
    set({ slots: [...draft.slots, { id: newSlotId(), label: label === "Autre" ? "" : label, items: [] }] });
  }

  function validate() {
    if (!draft.name.trim()) return "Donne un nom à la formule.";
    if (draft.price === "" || !Number.isFinite(parseFloat(String(draft.price).replace(",", ".")))) return "Indique le prix de la formule.";
    if (!draft.dineIn && !draft.takeaway) return "Choisis au moins « sur place » ou « à emporter ».";
    if (draft.slots.length === 0) return "Ajoute au moins un composant (pizza, dessert, boisson…).";
    for (const [i, s] of draft.slots.entries()) {
      if (!s.label.trim()) return `Donne un nom au composant n°${i + 1}.`;
      if (s.items.length === 0) return `Choisis au moins un produit pour « ${s.label.trim()} ».`;
    }
    return "";
  }

  async function save() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      price: parseMoney(draft.price),
      active: draft.active,
      dineIn: draft.dineIn,
      takeaway: draft.takeaway,
      restaurantIds: draft.restaurantIds,
      serviceSlots: draft.serviceSlots,
      slots: draft.slots.map((s) => ({
        id: s.id,
        label: s.label.trim(),
        items: s.items.map((e) => ({ itemId: e.itemId, supplement: parseMoney(e.supplement) })),
      })),
    };
    try {
      if (draft.id) await updateFormula(draft.id, payload);
      else await insertFormula({ ...payload, sortOrder: 1000 });
      onClose();
    } catch (err) {
      console.error(err);
      setError("Échec de l'enregistrement — la table « formulas » existe-t-elle bien dans Supabase ?");
      setSaving(false);
    }
  }

  const section = "text-xs text-[#a88f78] uppercase font-bold mb-2";

  return (
    <div className="rounded-2xl border border-[#C0392B] p-5 mb-8">
      <div className="display-font text-xl font-bold mb-5">{draft.id ? "Modifier la formule" : "Nouvelle formule"}</div>

      <div className="flex flex-wrap gap-3 mb-5">
        <label className="flex-1 min-w-[220px]">
          <div className={section}>Nom</div>
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex. La Formule Casa" className="w-full rounded-lg px-3 py-2" style={inputStyle} />
        </label>
        <label className="w-36">
          <div className={section}>Prix (€)</div>
          <input inputMode="decimal" value={draft.price} onChange={(e) => set({ price: e.target.value })} placeholder="20" className="w-full rounded-lg px-3 py-2" style={inputStyle} />
        </label>
      </div>
      <label className="block mb-5">
        <div className={section}>Description (facultatif)</div>
        <input value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ex. Une pizza + un dessert + un soda classique" className="w-full rounded-lg px-3 py-2" style={inputStyle} />
      </label>

      <div className={section}>Disponible</div>
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => set({ dineIn: !draft.dineIn })} aria-pressed={draft.dineIn} className={`tap-scale rounded-full px-5 py-2 font-bold border-2 ${chipStyle(draft.dineIn)}`}>
          🍽️ Sur place
        </button>
        <button onClick={() => set({ takeaway: !draft.takeaway })} aria-pressed={draft.takeaway} className={`tap-scale rounded-full px-5 py-2 font-bold border-2 ${chipStyle(draft.takeaway)}`}>
          🥡 À emporter
        </button>
      </div>

      <div className={section}>Restaurants</div>
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => set({ restaurantIds: [] })} aria-pressed={allRestaurants} className={`tap-scale rounded-full px-5 py-2 font-bold border-2 ${chipStyle(allRestaurants)}`}>
          Tous
        </button>
        {restaurants.map((r) => {
          const on = draft.restaurantIds.includes(r.id);
          return (
            <button key={r.id} onClick={() => toggleRestaurant(r.id)} aria-pressed={on} className={`tap-scale rounded-full px-5 py-2 font-bold border-2 ${chipStyle(on)}`}>
              {r.name}
            </button>
          );
        })}
      </div>

      <div className={section}>Services de la semaine où elle est proposée</div>
      <div className="mb-5">
        <ServiceGrid value={draft.serviceSlots} onChange={(v) => set({ serviceSlots: v })} />
        {draft.serviceSlots.length === 0 && <p className="text-xs text-[#e8806f] mt-2">Aucun service coché : la formule ne sera jamais proposée.</p>}
      </div>

      <div className={section}>Composition</div>
      <div className="flex flex-col gap-4 mb-4">
        {draft.slots.map((s, i) => (
          <SlotEditor
            key={s.id}
            slot={s}
            index={i}
            count={draft.slots.length}
            menu={menu}
            menuById={menuById}
            onChange={(slot) => updateSlot(i, slot)}
            onRemove={() => set({ slots: draft.slots.filter((_, j) => j !== i) })}
            onMove={(dir) => moveSlot(i, dir)}
          />
        ))}
        {draft.slots.length === 0 && <p className="text-[#8a7561] text-sm">Aucun composant pour l'instant.</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-sm text-[#a88f78]">Ajouter :</span>
        {SLOT_PRESETS.map((p) => (
          <button key={p} onClick={() => addSlot(p)} className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
            + {p}
          </button>
        ))}
      </div>

      <button onClick={() => set({ active: !draft.active })} aria-pressed={draft.active} className={`tap-scale rounded-full px-5 py-2 font-bold border-2 mb-6 ${chipStyle(draft.active)}`}>
        {draft.active ? "✅ Formule active" : "⏸️ Formule désactivée"}
      </button>

      {error && <p className="text-sm text-[#e8806f] mb-3">{error}</p>}
      <div className="flex gap-3">
        <button onClick={save} disabled={saving} className="tap-scale rounded-full px-8 py-3 font-bold disabled:opacity-50" style={{ background: "#C0392B", color: "#fff5ea" }}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button onClick={onClose} disabled={saving} className="tap-scale rounded-full px-8 py-3 font-bold border-2 border-[#3a2b1f]">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ page --

export default function FormulasAdmin() {
  const { formulas, loading } = useFormulas();
  const { menuItems } = useMenu();
  const restaurants = useRestaurantsList();
  const [editing, setEditing] = useState(null); // null | draft
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  const menuById = useMemo(() => new Map(menuItems.map((m) => [m.id, m])), [menuItems]);
  const restaurantName = (id) => restaurants.find((r) => r.id === id)?.name || id;

  async function remove(id) {
    setConfirmingDeleteId(null);
    try {
      await deleteFormula(id);
    } catch (err) {
      console.error(err);
      alert("Échec de la suppression.");
    }
  }
  async function toggleActive(f) {
    try {
      await updateFormula(f.id, { active: !f.active });
    } catch (err) {
      console.error(err);
    }
  }
  async function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= formulas.length) return;
    const arr = [...formulas];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    try {
      await Promise.all(arr.map((f, idx) => (f.sortOrder === idx ? null : updateFormula(f.id, { sortOrder: idx }))));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-6 max-w-3xl">
        Les formules (ex. <b>La Formule Casa 20 €</b> : pizza + dessert + soda). Pour chacune : les produits possibles et leurs
        suppléments, sur place et/ou à emporter, les restaurants, et les services de la semaine concernés. Appliqué aussitôt
        sur la borne, le click &amp; collect et la prise de commande équipe.
      </p>

      {editing ? (
        <FormulaEditor key={editing.id || "new"} initial={editing} menu={menuItems} menuById={menuById} restaurants={restaurants} onClose={() => setEditing(null)} />
      ) : (
        <button onClick={() => setEditing({ ...EMPTY_DRAFT })} className="tap-scale rounded-full px-6 py-3 font-bold mb-6" style={{ background: "#C0392B", color: "#fff5ea" }}>
          + Nouvelle formule
        </button>
      )}

      {loading && <p className="text-[#8a7561]">Chargement…</p>}
      {!loading && formulas.length === 0 && !editing && <p className="text-[#8a7561]">Aucune formule pour l'instant.</p>}

      <div className="flex flex-col gap-3">
        {formulas.map((f, i) => (
          <div key={f.id} className={`rounded-2xl border border-[#3a2b1f] bg-[#211712] p-5 ${f.active ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <div>
                <div className="display-font text-xl font-bold">
                  {f.name} <span className="text-[#E8B23D]">{eur(f.price)}</span>
                </div>
                {f.description && <div className="text-sm text-[#a88f78]">{f.description}</div>}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] font-bold disabled:opacity-30" aria-label="Monter">
                  ↑
                </button>
                <button onClick={() => move(i, 1)} disabled={i === formulas.length - 1} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] font-bold disabled:opacity-30" aria-label="Descendre">
                  ↓
                </button>
              </div>
            </div>
            <div className="text-sm text-[#c9b8a4] flex flex-col gap-1 mb-4">
              <div>
                {f.dineIn && "🍽️ Sur place"}
                {f.dineIn && f.takeaway && " · "}
                {f.takeaway && "🥡 À emporter"}
                {" · "}
                {f.restaurantIds.length === 0 ? "Tous les restaurants" : f.restaurantIds.map(restaurantName).join(", ")}
              </div>
              <div>🗓️ {summarizeServiceSlots(f.serviceSlots)}</div>
              <div className="text-[#a88f78]">
                {f.slots.map((s) => `${s.label} (${(s.items || []).length})`).join(" + ") || "Aucun composant"}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setEditing(toDraft(f))} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                ✏️ Modifier
              </button>
              <button onClick={() => toggleActive(f)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                {f.active ? "⏸️ Désactiver" : "▶️ Activer"}
              </button>
              {confirmingDeleteId === f.id ? (
                <>
                  <button onClick={() => remove(f.id)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold" style={{ background: "#C0392B", color: "#fff5ea" }}>
                    Confirmer la suppression
                  </button>
                  <button onClick={() => setConfirmingDeleteId(null)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                    Annuler
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirmingDeleteId(f.id)} className="tap-scale rounded-full px-5 py-2 text-sm font-bold border-2 border-[#3a2b1f] text-[#e8806f]">
                  🗑️ Supprimer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
