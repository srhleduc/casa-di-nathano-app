"use client";

import { useEffect, useState } from "react";

// Un "créneau réparti" (grosse commande sur plusieurs créneaux consécutifs)
// est affiché exactement comme un créneau simple — seul le dernier horaire
// de la série est montré au client, la répartition réelle (qui remplit
// entièrement les créneaux précédents) reste un détail d'implémentation.
//
// `staffForceOptions` (résultat de allUpcomingSlotsForStaff) n'est fourni que
// côté équipe (StaffOrderFlow) — sa présence active le mode "forçage" : la
// liste "autre créneau" montre alors TOUS les créneaux à venir, y compris ceux
// déjà pleins théoriquement (en rouge), sélectionnables avec double
// confirmation. Sans ce prop (borne client, lien à emporter), le comportement
// est strictement celui d'avant.
export default function SlotScreen({ pizzaCount, slotChoice, selectedOption, setSelectedOption, allSlotsConfigured, staffForceOptions, onBack, onConfirm }) {
  const [showAll, setShowAll] = useState(false);
  const [confirmingForce, setConfirmingForce] = useState(false);
  const mode = slotChoice?.mode;
  const isStaff = !!staffForceOptions;

  const displayOptions =
    mode === "single"
      ? (slotChoice.options || []).map((s) => ({
          key: s.id,
          label: s.label,
          remaining: s.remaining,
          full: false,
          plan: [{ slotId: s.id, label: s.label, qty: pizzaCount }],
        }))
      : mode === "split"
      ? (slotChoice.plans || []).map((p, i) => ({
          key: `plan-${i}`,
          label: p[p.length - 1].label,
          remaining: null,
          full: false,
          plan: p,
        }))
      : [];

  // La répartition automatique (mode "single" ou "split") reste proposée en
  // priorité côté équipe, exactement comme côté client — une commande de 8
  // pizzas sur des créneaux de 7 se répartit d'elle-même sur le créneau visé
  // et le précédent, sans intervention. Seul le cas vraiment sans solution
  // (mode "none", même en répartissant sur plusieurs créneaux) saute
  // directement à la liste forçable, pour que la serveuse puisse forcer un
  // seul créneau à absorber toute la commande avec l'accord du pizzaiolo.
  const hasAutoPlan = (mode === "single" || mode === "split") && displayOptions.length > 0;
  const forceList = isStaff
    ? staffForceOptions.map((o) => ({
        key: `staff-${o.id}`,
        label: o.label,
        remaining: o.remaining,
        full: o.full,
        plan: [{ slotId: o.id, label: o.label, qty: pizzaCount }],
      }))
    : [];

  const laterOptions = isStaff ? (hasAutoPlan ? [...displayOptions.slice(1), ...forceList] : forceList) : displayOptions.slice(1);
  const skipToForceList = isStaff && !hasAutoPlan;

  useEffect(() => {
    if (skipToForceList) {
      setShowAll(true);
      return;
    }
    if (displayOptions.length > 0 && !selectedOption) {
      setSelectedOption(displayOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotChoice]);

  const earliest = displayOptions[0];

  function handleValidate() {
    if (selectedOption?.full) {
      setConfirmingForce(true);
      return;
    }
    onConfirm(false);
  }
  function confirmForce() {
    setConfirmingForce(false);
    onConfirm(true);
  }

  return (
    <div className="flex-1 flex flex-col px-6 py-6">
      <button onClick={onBack} className="text-sm font-semibold mb-6 self-start tap-scale" style={{ color: "var(--color-text-subtle)" }}>
        ← Retour
      </button>
      <h2 className="display-font text-3xl font-semibold mb-2">Ton créneau</h2>
      <p className="mb-8" style={{ color: "var(--color-text-muted)" }}>
        {pizzaCount} pizza{pizzaCount > 1 ? "s" : ""} dans ta commande — on t'affiche uniquement les horaires où le four a la place.
      </p>

      {!allSlotsConfigured && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4">🧑‍🍳</span>
          <p style={{ color: "var(--color-text-subtle)" }}>L'équipe n'a pas encore ouvert les créneaux du service.</p>
          <p className="text-sm mt-2" style={{ color: "var(--color-text-faint)" }}>Adresse-toi directement à un membre de l'équipe.</p>
        </div>
      )}

      {allSlotsConfigured && !skipToForceList && mode === "none" && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4">😕</span>
          <p style={{ color: "var(--color-text-subtle)" }}>
            Même en répartissant sur plusieurs créneaux, le four n'a pas la place pour {pizzaCount} pizza{pizzaCount > 1 ? "s" : ""} aujourd'hui.
          </p>
          <p className="text-sm mt-2" style={{ color: "var(--color-text-faint)" }}>Réduis le nombre de pizzas, ou adresse-toi directement à l'équipe.</p>
        </div>
      )}

      {allSlotsConfigured && skipToForceList && forceList.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-4">😕</span>
          <p style={{ color: "var(--color-text-subtle)" }}>Aucun créneau restant aujourd'hui.</p>
        </div>
      )}

      {allSlotsConfigured && skipToForceList && forceList.length > 0 && (
        <p className="text-sm font-semibold mb-4 -mt-4" style={{ color: "var(--color-accent-gold)" }}>
          ⚠️ Aucun créneau n'a théoriquement la place pour {pizzaCount} pizza{pizzaCount > 1 ? "s" : ""}. Avec l'accord du pizzaiolo, tu peux forcer un créneau.
        </p>
      )}

      {allSlotsConfigured && !skipToForceList && earliest && !showAll && (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: "var(--color-text-muted)" }}>Créneau le plus proche</span>
          <div className="rounded-3xl border-2 px-14 py-10 mb-6" style={{ borderColor: "var(--color-accent)", background: "var(--color-surface-alt)" }}>
            <div className="display-font text-6xl font-bold">{earliest.label}</div>
            {earliest.remaining != null && (
              <div className="mt-2" style={{ color: "var(--color-text-muted)" }}>
                {earliest.remaining} place{earliest.remaining > 1 ? "s" : ""} disponible{earliest.remaining > 1 ? "s" : ""}
              </div>
            )}
          </div>
          {laterOptions.length > 0 && (
            <button onClick={() => setShowAll(true)} className="font-semibold underline underline-offset-4 tap-scale" style={{ color: "var(--color-text-subtle)" }}>
              Choisir un autre créneau
            </button>
          )}
        </div>
      )}

      {allSlotsConfigured && showAll && laterOptions.length > 0 && (
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-3 content-start">
          {laterOptions.map((o) => (
            <button
              key={o.key}
              onClick={() => setSelectedOption(o)}
              className="tap-scale rounded-2xl py-5 border-2 flex flex-col items-center"
              style={
                selectedOption?.key === o.key
                  ? { borderColor: "var(--color-accent)", background: "var(--color-surface-alt)" }
                  : o.full
                  ? { borderColor: "var(--color-danger-border)", background: "var(--color-danger-surface)" }
                  : { borderColor: "var(--color-border)", background: "var(--color-surface-card)" }
              }
            >
              <span className="display-font text-2xl font-bold">{o.label}</span>
              {o.full ? (
                <span className="text-xs mt-1 font-bold" style={{ color: "var(--color-danger-strong)" }}>
                  ⚠️ Plein — forçable
                </span>
              ) : (
                o.remaining != null && (
                  <span className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                    {o.remaining} place{o.remaining > 1 ? "s" : ""} dispo
                  </span>
                )
              )}
            </button>
          ))}
        </div>
      )}

      {allSlotsConfigured && selectedOption && (
        <button onClick={handleValidate} className="tap-scale rounded-full py-6 text-2xl font-bold mt-6" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
          Valider pour {selectedOption.label}
        </button>
      )}

      {confirmingForce && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
          <div className="w-full md:max-w-md rounded-3xl overflow-hidden" style={{ background: "var(--color-bg)", color: "var(--color-text)" }}>
            <div className="px-6 py-6 text-center">
              <span className="text-5xl mb-4 block">⚠️</span>
              <p className="font-bold text-lg mb-2">Créneau {selectedOption?.label} théoriquement plein</p>
              <p className="text-sm mb-6" style={{ color: "var(--color-text-subtle)" }}>
                Confirme que le pizzaiolo est d'accord pour forcer ce créneau à {pizzaCount} pizza{pizzaCount > 1 ? "s" : ""}.
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={confirmForce} className="tap-scale rounded-full py-4 text-lg font-bold" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
                  Forcer quand même
                </button>
                <button onClick={() => setConfirmingForce(false)} className="tap-scale rounded-full py-4 text-lg font-bold border-2" style={{ borderColor: "var(--color-border)", color: "var(--color-text-subtle)" }}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
