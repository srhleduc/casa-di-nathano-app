"use client";

import { useState } from "react";
import {
  useOrders, useMenu, useRuptures, useDessertStock, usePizzaStock, useSlots,
  updateOrder, markOrderServed, restoreOrder, deleteOrders, useTakeawayLinkStatus, setTakeawayLinkSuspended,
  awardLoyaltyPointsFromCaisse, fetchLoyaltyCustomerByPhone, searchLoyaltyCustomers, createLoyaltyCustomer, useOrderLoyaltyLinks, fetchOrderCommitmentPhone, fetchReservationPhoneForOrder,
} from "@/lib/data";
import { isOrderActiveToday, isOrderPaid, sortOrdersByTime, sortKitchenQueue, sortByTableName, isTakeawayLike, canonicalLoyaltyPhone } from "@/lib/business";
import { eur } from "@/lib/menu";
import OrderCardHeader from "../OrderCardHeader";
import OrderNote from "../OrderNote";
import GroupedItemList from "../GroupedItemList";
import EditOrderModal from "./EditOrderModal";

export default function CaisseBoard({ readOnly = false }) {
  const { orders } = useOrders();
  const { menuItems } = useMenu();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { slots } = useSlots();
  const [editingOrder, setEditingOrder] = useState(null);
  const active = orders.filter((o) => o.status !== "servie" && isOrderActiveToday(o));
  const paidToday = orders.filter((o) => o.status === "servie" && isOrderActiveToday(o));
  // Rattachement fidélité des commandes visibles (badge ☑️ / bouton ➕).
  const loyaltyLinks = useOrderLoyaltyLinks(active.map((o) => o.id));
  // Le chiffre du jour n'inclut jamais les commandes du mode test. "À
  // encaisser" ne compte que ce qui reste vraiment à payer — une commande
  // payée d'avance (bouton "Payée, non servie") ne doit plus y apparaître
  // même si elle est encore en préparation. "Déjà encaissé" suit le
  // paiement (isOrderPaid), pas le statut : l'argent est en caisse dès le
  // clic, que la commande soit terminée ou non.
  const realActive = active.filter((o) => !o.isTest);
  const unpaidActive = realActive.filter((o) => !isOrderPaid(o));
  const realPaidToday = orders.filter((o) => isOrderActiveToday(o) && !o.isTest && isOrderPaid(o));
  const totalActive = unpaidActive.reduce((s, o) => s + o.total, 0);
  const totalCollected = realPaidToday.reduce((s, o) => s + o.total, 0);

  const [cancelMode, setCancelMode] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const { suspended } = useTakeawayLinkStatus();

  function toggleTakeawayLink() {
    setTakeawayLinkSuspended(!suspended).catch((err) => console.error(err));
  }

  function markPaidUnserved(order) {
    updateOrder(order.id, { paid: true }).catch((err) => console.error(err));
  }
  function markPaidAndServed(order) {
    markOrderServed(order, { paid: true }).catch((err) => console.error(err));
  }
  function markServed(order) {
    markOrderServed(order).catch((err) => console.error(err));
  }

  function cancelOrder(order) {
    deleteOrders([order.id]).catch((err) => console.error(err));
    setConfirmingId(null);
  }

  function restoreServedOrder(order) {
    restoreOrder(order).catch((err) => console.error(err));
  }

  function quickCancel(order) {
    if (!window.confirm(`Annuler définitivement la commande « ${order.name} » ? Cette action est irréversible.`)) return;
    deleteOrders([order.id]).catch((err) => console.error(err));
  }

  const cancellable = sortOrdersByTime([...active, ...paidToday]);
  const activeQueue = sortKitchenQueue(active);
  const activeTakeaway = activeQueue.filter((o) => isTakeawayLike(o.serviceType));
  // Sur place trié par numéro/nom de table plutôt que par créneau, pour
  // retrouver une table au coup d'œil, comme sur l'écran Service.
  const activeDineIn = sortByTableName(active.filter((o) => !isTakeawayLike(o.serviceType)));

  function renderActiveCard(o) {
    return (
      <div key={o.id} className="w-72 shrink-0 rounded-xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}>
        <OrderCardHeader order={o} onEdit={() => setEditingOrder(o)} onDelete={() => quickCancel(o)} />
        <div className="display-font text-lg font-bold mb-2">{o.name}</div>
        <GroupedItemList items={o.items} className="mb-3" showSource />
        <div className="display-font font-bold text-lg mb-2" style={{ color: "var(--color-accent-gold)" }}>{eur(o.total)}</div>
        {!o.isTest && (
          <div className="mb-2">
            <OrderLoyaltyControl order={o} link={loyaltyLinks[o.id]} readOnly={readOnly} />
          </div>
        )}
        {o.paid ? (
          // Déjà encaissée (paiement anticipé en caisse, ou réglée dès la prise
          // de commande côté serveuse) — il ne reste qu'à la marquer servie.
          <div className="flex items-center gap-2">
            <span className="flex-1 text-center text-xs font-bold rounded-full px-3 py-2" style={{ background: "var(--color-success-bg)", color: "var(--color-success)" }}>
              ✅ Payée
            </span>
            <button onClick={() => markServed(o)} className="tap-scale flex-1 text-xs font-bold rounded-full px-3 py-2" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
              ✅ Servie
            </button>
          </div>
        ) : !isTakeawayLike(o.serviceType) ? (
          // Sur place : le client a généralement déjà mangé au moment de
          // payer, pas besoin du paiement anticipé — un seul bouton, comme
          // avant.
          <button onClick={() => markPaidAndServed(o)} className="tap-scale w-full text-xs font-bold rounded-full px-3 py-2" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
            💰 Marquer payée
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={() => markPaidUnserved(o)} className="tap-scale flex-1 text-xs font-bold rounded-full px-3 py-2 border-2" style={{ borderColor: "var(--color-border)" }}>
              💰 Payée, non servie
            </button>
            <button onClick={() => markPaidAndServed(o)} className="tap-scale flex-1 text-xs font-bold rounded-full px-3 py-2" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
              💰 Payée et servie
            </button>
          </div>
        )}
        <OrderNote note={o.note} />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="flex gap-4 mb-4">
        <div className="rounded-xl border px-5 py-4 flex-1" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}>
          <div className="text-xs uppercase font-bold mb-1" style={{ color: "var(--color-text-muted)" }}>À encaisser ({unpaidActive.length})</div>
          <div className="display-font text-2xl font-bold">{eur(totalActive)}</div>
        </div>
        <div className="rounded-xl border px-5 py-4 flex-1" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}>
          <div className="text-xs uppercase font-bold mb-1" style={{ color: "var(--color-text-muted)" }}>Déjà encaissé ({realPaidToday.length})</div>
          <div className="display-font text-2xl font-bold" style={{ color: "var(--color-accent-gold)" }}>{eur(totalCollected)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => {
            setCancelMode(!cancelMode);
            setConfirmingId(null);
          }}
          className="tap-scale rounded-full px-5 py-3 text-sm font-bold border-2"
          style={cancelMode ? { borderColor: "var(--color-accent)", background: "var(--color-surface-alt)" } : { borderColor: "var(--color-border)", color: "var(--color-text-subtle)" }}
        >
          {cancelMode ? "← Retour à la caisse" : "🗑️ Annuler une commande"}
        </button>
        <button
          onClick={toggleTakeawayLink}
          className="tap-scale rounded-full px-5 py-3 text-sm font-bold border-2"
          style={suspended ? { borderColor: "var(--color-accent)", background: "var(--color-surface-alt)", color: "var(--color-danger)" } : { borderColor: "var(--color-border)", color: "var(--color-text-subtle)" }}
        >
          {suspended ? "▶️ Réactiver le click and collect" : "⏸️ Suspendre le click and collect"}
        </button>
      </div>
      {suspended && (
        <div className="rounded-2xl px-5 py-3 mb-6 text-sm font-bold" style={{ background: "var(--color-surface-alt)", border: "1px solid var(--color-accent)", color: "var(--color-danger)" }}>
          ⏸️ Le lien de commande en ligne (/commande) est actuellement suspendu — les clients qui scannent le QR code voient un message les
          invitant à appeler.
        </div>
      )}

      {cancelMode ? (
        <>
          <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
            Sélectionne la commande à annuler — elle sera supprimée définitivement, y compris de "Déjà encaissé" si elle
            était payée.
          </p>
          {cancellable.length === 0 && <p style={{ color: "var(--color-text-faint)" }}>Aucune commande aujourd'hui.</p>}
          <div className="flex flex-wrap gap-3">
            {cancellable.map((o) => (
              <div key={o.id} className="w-72 shrink-0 rounded-xl border p-4" style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}>
                <OrderCardHeader order={o} />
                <div className="display-font text-lg font-bold mb-1">{o.name}</div>
                <div className="text-xs mb-2" style={{ color: "var(--color-text-muted)" }}>{isOrderPaid(o) ? "💰 Déjà encaissée" : "⏳ En attente de règlement"}</div>
                <GroupedItemList items={o.items} className="mb-3" showSource />
                {o.status === "servie" && o.previousStatus && (
                  <button
                    onClick={() => restoreServedOrder(o)}
                    className="tap-scale w-full mb-2 text-xs font-bold rounded-full px-4 py-2 border-2"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    ↩️ Restaurer (marquée servie par erreur)
                  </button>
                )}
                <div className="flex items-center justify-between">
                  <span className="display-font font-bold text-lg" style={{ color: "var(--color-accent-gold)" }}>{eur(o.total)}</span>
                  {confirmingId === o.id ? (
                    <button onClick={() => cancelOrder(o)} className="tap-scale text-xs font-bold rounded-full px-4 py-2" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
                      Confirmer ?
                    </button>
                  ) : (
                    <button onClick={() => setConfirmingId(o.id)} className="tap-scale text-xs font-bold rounded-full px-4 py-2 border-2 border-red-800 text-red-400">
                      🗑️ Annuler
                    </button>
                  )}
                </div>
                <OrderNote note={o.note} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {active.length === 0 && <p style={{ color: "var(--color-text-faint)" }}>Aucune commande en attente de règlement.</p>}
          {active.length > 0 && (
            <>
              <div className="font-bold mb-3">🥡 À emporter ({activeTakeaway.length})</div>
              <div className="flex gap-4 overflow-x-auto pb-2 mb-6">
                {activeTakeaway.map(renderActiveCard)}
                {activeTakeaway.length === 0 && <p style={{ color: "var(--color-text-faint)" }}>Aucune pour l'instant.</p>}
              </div>

              <div className="font-bold mb-3">🍽️ Sur place ({activeDineIn.length})</div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {activeDineIn.map(renderActiveCard)}
                {activeDineIn.length === 0 && <p style={{ color: "var(--color-text-faint)" }}>Aucune pour l'instant.</p>}
              </div>
            </>
          )}
        </>
      )}

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          menu={menuItems}
          orders={orders}
          slots={slots}
          ruptures={ruptures}
          dessertStock={dessertStock}
          pizzaStock={pizzaStock}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </div>
  );
}

const LOYALTY_INPUT_STYLE = { background: "var(--color-bg-team)", border: "1px solid var(--color-border)", color: "var(--color-text)" };

// Contrôle fidélité d'une carte de commande en caisse :
//  - déjà rattachée (un mouvement porte son order_id) -> "⭐ Fidélité ☑️ Nom"
//  - sinon, bouton "⭐ Fidélité ➕" ouvrant un panneau : recherche d'un compte par
//    nom / prénom OU téléphone (champ pré-rempli avec le numéro du client pour un
//    click & collect), association + crédit de floor(total) points ; ou création
//    du compte si le numéro est inconnu.
function OrderLoyaltyControl({ order, link, readOnly }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState(""); // nom, prénom ou téléphone
  const [step, setStep] = useState("idle"); // idle | searching | list | found | unknown | saving
  const [results, setResults] = useState([]);
  const [match, setMatch] = useState(null);
  const [createPhone, setCreatePhone] = useState(null); // numéro canonique quand on crée
  const [nom, setNom] = useState("");
  const [dateAnniversaire, setDateAnniversaire] = useState("");
  const [msg, setMsg] = useState(null);

  const pts = Math.floor(order.total || 0);

  if (link) {
    return (
      <div className="text-xs font-bold" style={{ color: "var(--color-success-strong)" }}>
        ⭐ Fidélité ☑️ <span style={{ color: "var(--color-success)" }}>{link.nom || link.phone}</span>
      </div>
    );
  }

  if (readOnly) return null;

  function resetToSearch() {
    setStep("idle");
    setResults([]);
    setMatch(null);
    setCreatePhone(null);
    setMsg(null);
  }

  async function runSearch(raw) {
    const t = (raw ?? term).trim();
    if (t.length < 2) {
      setMsg("Saisis un nom, un prénom ou un numéro.");
      return;
    }
    setStep("searching");
    setMsg(null);
    setResults([]);
    setMatch(null);
    setCreatePhone(null);
    try {
      const p = canonicalLoyaltyPhone(t);
      if (p) {
        // Numéro complet valide -> recherche exacte, avec création si inconnu.
        const c = await fetchLoyaltyCustomerByPhone(p);
        if (c) {
          setMatch(c);
          setStep("found");
        } else {
          setCreatePhone(p);
          setStep("unknown");
          setMsg("Numéro inconnu du service de fidélité — créer un compte ?");
        }
        return;
      }
      // Sinon : recherche souple par nom/prénom (ou fragment de numéro).
      const list = await searchLoyaltyCustomers(t);
      if (list.length === 0) {
        setStep("idle");
        setMsg("Aucun client trouvé. Pour créer un compte, saisis le numéro de téléphone.");
      } else if (list.length === 1) {
        setMatch(list[0]);
        setStep("found");
      } else {
        setResults(list);
        setStep("list");
      }
    } catch (err) {
      console.error(err);
      setStep("idle");
      setMsg("Erreur pendant la recherche.");
    }
  }

  async function openPanel() {
    setOpen(true);
    setMsg(null);
    try {
      const ccPhone =
        (await fetchOrderCommitmentPhone(order.id)) ||
        (await fetchReservationPhoneForOrder(order.id));
      if (ccPhone) {
        setTerm(ccPhone);
        runSearch(ccPhone);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function associate() {
    const p = match ? match.phone : createPhone;
    if (!p || pts <= 0) return;
    setStep("saving");
    try {
      if (!match) {
        await createLoyaltyCustomer({ phone: p, nom: nom.trim(), dateAnniversaire });
      }
      const newSolde = await awardLoyaltyPointsFromCaisse(p, order.total, order.id);
      // Resynchronise la carte Google Wallet du client + notification (nouveau
      // solde, ou déblocage de bon si un palier est franchi).
      // Fire-and-forget : ne doit jamais gêner l'encaissement.
      if (newSolde != null) {
        fetch("/api/wallet/update-points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: p,
            solde: newSolde,
            pointsAdded: Math.floor(Number(order.total) || 0),
          }),
        }).catch(() => {});
      }
      setOpen(false); // le badge ☑️ apparaît via le rafraîchissement temps réel
    } catch (err) {
      console.error(err);
      setStep(match ? "found" : "unknown");
      setMsg("Association impossible.");
    }
  }

  if (!open) {
    return (
      <button onClick={openPanel} className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold border-2" style={{ borderColor: "var(--color-border)" }}>
        ⭐ Fidélité ➕
      </button>
    );
  }

  return (
    <div className="rounded-lg border p-2 flex flex-col gap-2" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Nom, prénom ou téléphone"
          className="flex-1 rounded px-2 py-1 text-sm min-w-0"
          style={LOYALTY_INPUT_STYLE}
        />
        <button onClick={() => runSearch()} className="tap-scale shrink-0 rounded px-3 py-1 text-xs font-bold border-2" style={{ borderColor: "var(--color-border)" }}>
          Chercher
        </button>
      </div>

      {msg && (
        <div className="text-xs" style={{ color: step === "unknown" ? "var(--color-accent-gold)" : "var(--color-danger)" }}>
          {msg}
        </div>
      )}

      {step === "list" && (
        <div className="flex flex-col gap-1">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setMatch(c);
                setStep("found");
                setMsg(null);
              }}
              className="tap-scale text-left rounded border px-2 py-1 text-xs"
              style={{ borderColor: "var(--color-border)", color: "var(--color-text-subtle)" }}
            >
              <span className="font-bold">{c.nom || "Sans nom"}</span> · {c.phone} · {c.soldePoints} pts
            </button>
          ))}
        </div>
      )}

      {step === "found" && match && (
        <>
          <div className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
            {match.nom || "Sans nom"} · {match.phone} · {match.soldePoints} pts
          </div>
          <button
            onClick={associate}
            disabled={pts <= 0}
            className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}
          >
            Associer &amp; créditer {pts} pts
          </button>
        </>
      )}

      {step === "unknown" && (
        <>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom (facultatif)" className="rounded px-2 py-1 text-sm" style={LOYALTY_INPUT_STYLE} />
          <input value={dateAnniversaire} onChange={(e) => setDateAnniversaire(e.target.value)} type="date" className="rounded px-2 py-1 text-sm" style={LOYALTY_INPUT_STYLE} />
          <button
            onClick={associate}
            disabled={pts <= 0}
            className="tap-scale rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50"
            style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}
          >
            Créer le compte &amp; créditer {pts} pts
          </button>
        </>
      )}

      <div className="flex items-center gap-3">
        {(step === "list" || step === "found" || step === "unknown") && (
          <button onClick={resetToSearch} className="text-xs" style={{ color: "var(--color-text-faint)" }}>
            ← Nouvelle recherche
          </button>
        )}
        <button onClick={() => setOpen(false)} className="text-xs" style={{ color: "var(--color-text-faint)" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}
