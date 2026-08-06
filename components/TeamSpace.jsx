"use client";

import { useState } from "react";

import KitchenBoard from "./team/KitchenBoard";
import FinitionBoard from "./team/FinitionBoard";
import BoissonBoard from "./team/BoissonBoard";
import StaffOrderFlow from "./team/StaffOrderFlow";
import ServiceBoard from "./team/ServiceBoard";
import CaisseBoard from "./team/CaisseBoard";
import ScheduledOrdersList from "./team/ScheduledOrdersList";
import ScheduledOrderFlow from "./team/ScheduledOrderFlow";
import SlotsAdmin from "./team/SlotsAdmin";
import RupturesAdmin from "./team/RupturesAdmin";
import DessertStockAdmin from "./team/DessertStockAdmin";
import MenuAdmin from "./team/MenuAdmin";
import MaintenanceAdmin from "./team/MaintenanceAdmin";
import TablePlanAdmin from "./team/TablePlanAdmin";

const ZONE_LABELS = { cuisine: " · En cuisine", salle: " · En salle", logistique: " · Logistique service" };

export default function TeamSpace({ onExit }) {
  const [zone, setZone] = useState(null); // null | "cuisine" | "salle" | "logistique"
  const [tab, setTab] = useState(null);
  const [schedulingNew, setSchedulingNew] = useState(false);

  function goZone(z, defaultTab) {
    setZone(z);
    setTab(defaultTab);
  }

  return (
    <div className="kiosk-root--team">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
        <div className="flex items-center gap-3">
          {zone && (
            <button onClick={() => setZone(null)} className="text-[#c9b8a4] text-sm font-semibold tap-scale">
              ← Zones
            </button>
          )}
          <span className="display-font text-xl font-semibold">🧑‍🍳 Espace équipe{zone ? ZONE_LABELS[zone] : ""}</span>
        </div>
        <button onClick={onExit} className="text-[#c9b8a4] text-sm font-semibold px-4 py-2 rounded-full border border-[#4a3826] tap-scale">
          Fermer
        </button>
      </div>

      {!zone && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <button onClick={() => goZone("cuisine", "kitchen")} className="tap-scale w-full max-w-md rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2">
            <span className="text-5xl mb-2">🧑‍🍳</span>
            <span className="display-font text-3xl font-bold">En cuisine</span>
            <span className="text-[#a88f78]">Four · Finition · Boissons</span>
          </button>
          <button onClick={() => goZone("salle", "staff-order")} className="tap-scale w-full max-w-md rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2">
            <span className="text-5xl mb-2">🍽️</span>
            <span className="display-font text-3xl font-bold">En salle</span>
            <span className="text-[#a88f78]">Prise de commande · Service · Caisse</span>
          </button>
          <button onClick={() => goZone("logistique", "slots")} className="tap-scale w-full max-w-md rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2">
            <span className="text-5xl mb-2">🛠️</span>
            <span className="display-font text-3xl font-bold">Logistique service</span>
            <span className="text-[#a88f78]">Créneaux du jour · Ruptures</span>
          </button>
        </div>
      )}

      {zone === "cuisine" && (
        <>
          <div className="flex gap-3 px-6 py-4 overflow-x-auto">
            <button onClick={() => setTab("kitchen")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "kitchen" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🔥 Four</button>
            <button onClick={() => setTab("finition")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "finition" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🥗 Finition</button>
            <button onClick={() => setTab("boisson")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "boisson" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🥤 Boissons</button>
          </div>
          {tab === "kitchen" && <KitchenBoard />}
          {tab === "finition" && <FinitionBoard />}
          {tab === "boisson" && <BoissonBoard />}
        </>
      )}

      {zone === "salle" && (
        <>
          <div className="flex gap-3 px-6 py-4 overflow-x-auto">
            <button onClick={() => setTab("staff-order")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "staff-order" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>📞 Prise de commande</button>
            <button onClick={() => setTab("service")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "service" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🍽️ Service</button>
            <button onClick={() => setTab("caisse")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "caisse" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>💰 Caisse</button>
            <button onClick={() => { setTab("scheduled"); setSchedulingNew(false); }} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "scheduled" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>📅 Programmées</button>
          </div>
          {tab === "staff-order" && <StaffOrderFlow />}
          {tab === "service" && <ServiceBoard />}
          {tab === "caisse" && <CaisseBoard />}
          {tab === "scheduled" && !schedulingNew && <ScheduledOrdersList onNew={() => setSchedulingNew(true)} />}
          {tab === "scheduled" && schedulingNew && <ScheduledOrderFlow onDone={() => setSchedulingNew(false)} />}
        </>
      )}

      {zone === "logistique" && (
        <>
          <div className="flex gap-3 px-6 py-4 overflow-x-auto">
            <button onClick={() => setTab("slots")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "slots" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>⏱️ Créneaux du jour</button>
            <button onClick={() => setTab("ruptures")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "ruptures" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🚫 Ruptures</button>
            <button onClick={() => setTab("desserts")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "desserts" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🍰 Desserts du jour</button>
            <button onClick={() => setTab("newproduct")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "newproduct" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>✏️ Menu</button>
            <button onClick={() => setTab("maintenance")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "maintenance" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🗑️ Maintenance</button>
            <button onClick={() => setTab("tables")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "tables" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>🪑 Plan de table</button>
          </div>
          {tab === "slots" && <SlotsAdmin />}
          {tab === "ruptures" && <RupturesAdmin />}
          {tab === "desserts" && <DessertStockAdmin />}
          {tab === "newproduct" && <MenuAdmin />}
          {tab === "maintenance" && <MaintenanceAdmin />}
          {tab === "tables" && <TablePlanAdmin />}
        </>
      )}
    </div>
  );
}
