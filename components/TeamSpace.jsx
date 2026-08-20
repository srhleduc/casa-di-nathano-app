"use client";

import { useEffect, useState } from "react";
import { useOrders, useSlots, useTestMode, setTestModeEnabled, deleteAllTestOrders, updateOrder } from "@/lib/data";
import { computeScheduledOrderSlotAllocations, recomputeScheduledOrderSlotAllocations, recomputeImmediateOrderSlotAllocations } from "@/lib/business";
import { useRestaurant, useRestaurantFilter } from "@/lib/restaurant";

import KitchenBoard from "./team/KitchenBoard";
import FinitionBoard from "./team/FinitionBoard";
import BoissonBoard from "./team/BoissonBoard";
import DessertCafeBoard from "./team/DessertCafeBoard";
import StaffOrderFlow from "./team/StaffOrderFlow";
import ServiceBoard from "./team/ServiceBoard";
import CaisseBoard from "./team/CaisseBoard";
import ScheduledOrdersList from "./team/ScheduledOrdersList";
import ScheduledOrderFlow from "./team/ScheduledOrderFlow";
import SlotsAdmin from "./team/SlotsAdmin";
import RupturesAdmin from "./team/RupturesAdmin";
import DessertStockAdmin from "./team/DessertStockAdmin";
import PizzaStockAdmin from "./team/PizzaStockAdmin";
import TimingStatsAdmin from "./team/TimingStatsAdmin";
import MenuAdmin from "./team/MenuAdmin";
import MaintenanceAdmin from "./team/MaintenanceAdmin";
import TablePlanAdmin from "./team/TablePlanAdmin";
import ServiceTypesAdmin from "./team/ServiceTypesAdmin";
import ApprovisionnementAdmin from "./team/ApprovisionnementAdmin";

const ZONE_LABELS = {
  equipe: " · Écrans équipe",
  commandes: " · Commandes/Service",
  "avant-service": " · À checker avant le service",
  logistique: " · Logistique service",
};

export default function TeamSpace({ onExit }) {
  const [zone, setZone] = useState(null); // null | "equipe" | "commandes" | "avant-service" | "logistique"
  const [tab, setTab] = useState(null);
  const [schedulingNew, setSchedulingNew] = useState(false);
  const { orders } = useOrders();
  const { slots } = useSlots();
  const { testMode } = useTestMode();
  const restaurantFilter = useRestaurantFilter();
  const restaurant = useRestaurant(restaurantFilter);
  const readOnly = Boolean(restaurantFilter); // vu depuis l'espace Direction

  // Écrit une répartition de créneaux recalculée sur une commande (programmée
  // ou prise le jour même) — jamais autre chose (voir updateOrder, qui
  // n'envoie que les clés fournies). Garde-fou : si le total calculé ne
  // correspond pas au nombre de pizzas réel de la commande, on n'écrit rien
  // plutôt que de risquer une donnée fausse, et on le signale.
  function writeRecomputedSlotAllocations(orderId, slotAllocations) {
    const order = orders.find((o) => o.id === orderId);
    const total = slotAllocations.reduce((s, a) => s + a.qty, 0);
    if (!order || total !== order.pizzaCount) {
      console.error("Répartition de créneau programmée incohérente, écriture annulée", { orderId, total, pizzaCount: order?.pizzaCount });
      return;
    }
    updateOrder(orderId, { slotAllocations }).catch((err) => console.error(err));
  }

  // Une commande programmée la veille pour aujourd'hui n'a jamais réservé de
  // vraies places sur les créneaux du jour (voir ScheduledOrderFlow) —
  // remainingForSlot les prend déjà en compte dynamiquement pour le calcul
  // de capacité, mais sans écran équipe ouvert pour déclencher cet effet, la
  // commande elle-même reste affichée sur son seul horaire visé au lieu de
  // sa vraie répartition (ex. "20:30" plutôt que "6×20:10 + 7×20:20 +
  // 7×20:30"). On la fige en base dès qu'un écran équipe est ouvert, pour
  // qu'elle s'affiche partout comme n'importe quelle commande répartie.
  // Non applicable à la vue Direction (lecture seule).
  useEffect(() => {
    if (readOnly) return;
    computeScheduledOrderSlotAllocations(orders, slots).forEach(({ orderId, slotAllocations }) => writeRecomputedSlotAllocations(orderId, slotAllocations));
  }, [orders, slots, readOnly]);

  // Si le pizzaiolo ajuste la capacité d'un créneau en cours de service
  // (SlotsAdmin), toute commande programmée déjà répartie mais pas encore
  // enfournée doit en profiter/s'y adapter automatiquement — jamais une
  // commande déjà partie en cuisine, dont la répartition reflète une
  // réalité physique qu'aucun recalcul ne doit bousculer.
  useEffect(() => {
    if (readOnly) return;
    recomputeScheduledOrderSlotAllocations(orders, slots).forEach(({ orderId, slotAllocations }) => writeRecomputedSlotAllocations(orderId, slotAllocations));
  }, [orders, slots, readOnly]);

  // Même logique pour une commande "à emporter"/"sur place" classique (pas
  // programmée à l'avance) déjà répartie sur un ou plusieurs créneaux réels :
  // si le pizzaiolo change la capacité d'un créneau après coup (ex. 4 → 5
  // pizzas max), une commande de 6 pizzas restée sur 4+2 doit se retrouver en
  // 5+1 sans intervention, tant qu'elle n'est pas encore enfournée.
  useEffect(() => {
    if (readOnly) return;
    recomputeImmediateOrderSlotAllocations(orders, slots).forEach(({ orderId, slotAllocations }) => writeRecomputedSlotAllocations(orderId, slotAllocations));
  }, [orders, slots, readOnly]);

  function goZone(z, defaultTab) {
    setZone(z);
    setTab(defaultTab);
  }

  async function toggleTestMode() {
    if (testMode.enabled) {
      const testCount = orders.filter((o) => o.isTest).length;
      if (testCount > 0) {
        const ok = window.confirm(
          `Désactiver le mode test va supprimer définitivement ${testCount} commande${testCount > 1 ? "s" : ""} de test. Continuer ?`
        );
        if (!ok) return;
      }
      try {
        await deleteAllTestOrders();
        await setTestModeEnabled(false);
      } catch (err) {
        console.error(err);
      }
    } else {
      setTestModeEnabled(true).catch((err) => console.error(err));
    }
  }

  return (
    <div className="kiosk-root--team">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
        <div className="flex items-center gap-3">
          {!readOnly && (
            <button
              onClick={toggleTestMode}
              className="tap-scale text-xs font-bold px-4 py-2 rounded-full border-2 shrink-0"
              style={testMode.enabled ? { background: "#f0c860", borderColor: "#f0c860", color: "#1a120b" } : { borderColor: "#4a3826", color: "#c9b8a4" }}
            >
              🧪 Mode test{testMode.enabled ? " ACTIF" : ""}
            </button>
          )}
          {zone && (
            <button onClick={() => setZone(null)} className="text-[#c9b8a4] text-sm font-semibold tap-scale">
              ← Zones
            </button>
          )}
          <span className="display-font text-xl font-semibold">
            🧑‍🍳 Espace équipe · {restaurant.name}
            {zone ? ZONE_LABELS[zone] : ""}
          </span>
        </div>
        <button onClick={onExit} className="text-[#c9b8a4] text-sm font-semibold px-4 py-2 rounded-full border border-[#4a3826] tap-scale">
          Fermer
        </button>
      </div>

      {readOnly && (
        <div className="px-6 py-2 text-center text-sm font-bold" style={{ background: "#2c1c14", color: "#a88f78" }}>
          👁️ Vue Direction en lecture seule — les actions ne sont pas prises en compte, seule l'équipe sur place peut agir
        </div>
      )}

      {!readOnly && testMode.enabled && (
        <div className="px-6 py-2 text-center text-sm font-bold" style={{ background: "#4a3a10", color: "#f0c860" }}>
          🧪 Mode test actif — les commandes créées côté équipe ne comptent pas dans le chiffre du jour et seront supprimées à la désactivation
        </div>
      )}

      {!zone && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <button onClick={() => goZone("equipe", "kitchen")} className="tap-scale w-full max-w-md rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2">
            <span className="text-5xl mb-2">🧑‍🍳</span>
            <span className="display-font text-3xl font-bold">Écrans équipe</span>
            <span className="text-[#a88f78]">Four · Finition · Boissons · Dessert/Café · Caisse</span>
          </button>
          <button onClick={() => goZone("commandes", "staff-order")} className="tap-scale w-full max-w-md rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2">
            <span className="text-5xl mb-2">📞</span>
            <span className="display-font text-3xl font-bold">Commandes/Service</span>
            <span className="text-[#a88f78]">Prise de commande · Service · Programmées · Caisse</span>
          </button>
          <button onClick={() => goZone("avant-service", "slots")} className="tap-scale w-full max-w-md rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2">
            <span className="text-5xl mb-2">✅</span>
            <span className="display-font text-3xl font-bold">À checker avant le service</span>
            <span className="text-[#a88f78]">Créneaux du jour · Desserts du jour · Plan de table</span>
          </button>
          <button onClick={() => goZone("logistique", "services")} className="tap-scale w-full max-w-md rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2">
            <span className="text-5xl mb-2">🛠️</span>
            <span className="display-font text-3xl font-bold">Logistique service</span>
            <span className="text-[#a88f78]">Types de service · Ruptures · Menu</span>
          </button>
        </div>
      )}

      {zone === "equipe" && (
        <>
          <div className="flex gap-3 px-6 py-4 overflow-x-auto">
            <button onClick={() => setTab("kitchen")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "kitchen" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🔥 Four</button>
            <button onClick={() => setTab("finition")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "finition" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🥗 Finition</button>
            <button onClick={() => setTab("boisson")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "boisson" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🥤 Boissons</button>
            <button onClick={() => setTab("dessert-cafe")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "dessert-cafe" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🍰 Dessert/Café</button>
            <button onClick={() => setTab("caisse")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "caisse" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>💰 Caisse</button>
          </div>
          {tab === "kitchen" && <KitchenBoard />}
          {tab === "finition" && <FinitionBoard />}
          {tab === "boisson" && <BoissonBoard />}
          {tab === "dessert-cafe" && <DessertCafeBoard />}
          {tab === "caisse" && <CaisseBoard />}
        </>
      )}

      {zone === "commandes" && (
        <>
          <div className="flex gap-3 px-6 py-4 overflow-x-auto">
            <button onClick={() => setTab("staff-order")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "staff-order" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>📞 Prise de commande</button>
            <button onClick={() => setTab("service")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "service" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🍽️ Service</button>
            <button onClick={() => { setTab("scheduled"); setSchedulingNew(false); }} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "scheduled" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>📅 Programmées</button>
            <button onClick={() => setTab("caisse")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "caisse" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>💰 Caisse</button>
          </div>
          {tab === "staff-order" && <StaffOrderFlow />}
          {tab === "service" && <ServiceBoard />}
          {tab === "scheduled" && !schedulingNew && <ScheduledOrdersList onNew={() => setSchedulingNew(true)} />}
          {tab === "scheduled" && schedulingNew && <ScheduledOrderFlow onDone={() => setSchedulingNew(false)} />}
          {tab === "caisse" && <CaisseBoard />}
        </>
      )}

      {zone === "avant-service" && (
        <>
          <div className="flex gap-3 px-6 py-4 overflow-x-auto">
            <button onClick={() => setTab("slots")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "slots" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>⏱️ Créneaux du jour</button>
            <button onClick={() => setTab("desserts")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "desserts" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🍰 Desserts du jour</button>
            <button onClick={() => setTab("tables")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "tables" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🪑 Plan de table</button>
          </div>
          {tab === "slots" && <SlotsAdmin />}
          {tab === "desserts" && <DessertStockAdmin />}
          {tab === "tables" && <TablePlanAdmin />}
        </>
      )}

      {zone === "logistique" && (
        <>
          <div className="flex gap-3 px-6 py-4 overflow-x-auto">
            <button onClick={() => setTab("services")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "services" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🔀 Types de service</button>
            <button onClick={() => setTab("ruptures")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "ruptures" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🚫 Ruptures</button>
            <button onClick={() => setTab("appro")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "appro" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>📦 Approvisionnement</button>
            <button onClick={() => setTab("patons")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "patons" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🍕 Pâtons du jour</button>
            <button onClick={() => setTab("timing")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "timing" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>⏱ Temps de prépa</button>
            <button onClick={() => setTab("newproduct")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "newproduct" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>{readOnly ? "✏️" : "👁️"} Menu</button>
            <button onClick={() => setTab("maintenance")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "maintenance" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🗑️ Maintenance</button>
          </div>
          {tab === "services" && <ServiceTypesAdmin />}
          {tab === "ruptures" && <RupturesAdmin />}
          {tab === "appro" && <ApprovisionnementAdmin />}
          {tab === "patons" && <PizzaStockAdmin />}
          {tab === "timing" && <TimingStatsAdmin />}
          {tab === "newproduct" && <MenuAdmin canEdit={readOnly} />}
          {tab === "maintenance" && <MaintenanceAdmin />}
        </>
      )}
    </div>
  );
}
