"use client";

import { useEffect, useState } from "react";
import { useOrders } from "@/lib/data";
import { isOrderActiveToday } from "@/lib/business";
import { eur } from "@/lib/menu";
import { RestaurantFilterContext, useRestaurantsList } from "@/lib/restaurant";
import { signOutManager, useManagerSession } from "@/lib/managerAuth";
import { supabase } from "@/lib/supabaseClient";
import { isPushSupported, getExistingPushSubscription, enablePushNotifications, disablePushNotifications } from "@/lib/push";
import TeamSpace from "../TeamSpace";
import CostPriceAdmin from "./CostPriceAdmin";
import ConsumptionAdmin from "./ConsumptionAdmin";
import SupplierOrdersAdmin from "./SupplierOrdersAdmin";
import LoyaltyMessagesAdmin from "./LoyaltyMessagesAdmin";
import SourceStatsAdmin from "./SourceStatsAdmin";

function NotificationsToggle() {
  const { session } = useManagerSession();
  const [state, setState] = useState("checking"); // checking | off | on | unsupported | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isPushSupported()) {
      setState("unsupported");
      return;
    }
    getExistingPushSubscription().then((sub) => setState(sub ? "on" : "off"));
  }, []);

  async function toggle() {
    if (state === "on") {
      setState("checking");
      await disablePushNotifications(supabase).catch((err) => console.error(err));
      setState("off");
      return;
    }
    setState("checking");
    setErrorMsg("");
    try {
      await enablePushNotifications(supabase, session.user.id);
      setState("on");
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "Échec de l'activation.");
      setState("off");
    }
  }

  if (state === "unsupported") return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={state === "checking"}
        className="tap-scale text-xs font-bold px-4 py-2 rounded-full border-2 shrink-0"
        style={state === "on" ? { background: "#f0c860", borderColor: "#f0c860", color: "#1a120b" } : { borderColor: "#4a3826", color: "#c9b8a4" }}
      >
        {state === "on" ? "🔔 Notifications activées" : "🔕 Activer les notifications"}
      </button>
      {errorMsg && <span className="text-xs text-red-400">{errorMsg}</span>}
    </div>
  );
}

export default function DirectionDashboard() {
  // Un manager n'a pas de restaurant propre : RLS lui renvoie les commandes
  // des deux enseignes tant qu'aucun RestaurantFilterContext n'est posé.
  const { orders } = useOrders();
  const restaurants = useRestaurantsList();
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("overview"); // "overview" | "costprice" | "consumption" | "suppliers" | "messages" | "autonomy"

  if (selected) {
    return (
      <RestaurantFilterContext.Provider value={selected}>
        <TeamSpace onExit={() => setSelected(null)} />
      </RestaurantFilterContext.Provider>
    );
  }

  const realOrders = orders.filter((o) => !o.isTest && isOrderActiveToday(o));

  return (
    <div className="kiosk-root--team">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
        <span className="display-font text-xl font-semibold">🧑‍💼 Espace Direction</span>
        <div className="flex items-center gap-3">
          <NotificationsToggle />
          <button onClick={signOutManager} className="text-[#c9b8a4] text-sm font-semibold px-4 py-2 rounded-full border border-[#4a3826] tap-scale">
            Se déconnecter
          </button>
        </div>
      </div>

      <div className="flex gap-3 px-6 py-4 overflow-x-auto">
        <button onClick={() => setTab("overview")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "overview" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          📊 Vue d'ensemble
        </button>
        <button onClick={() => setTab("costprice")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "costprice" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          💰 Coût de revient
        </button>
        <button onClick={() => setTab("consumption")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "consumption" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          📦 Consommation
        </button>
        <button onClick={() => setTab("suppliers")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "suppliers" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          🚚 Commande fournisseurs
        </button>
        <button onClick={() => setTab("messages")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "messages" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          ✉️ Messages fidélité
        </button>
        <button onClick={() => setTab("autonomy")} className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === "autonomy" ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
          📲 Commande autonome
        </button>
      </div>

      {tab === "overview" && (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <p className="text-[#a88f78] text-sm mb-6">
            Vue en lecture seule — pour agir sur une commande, utilise l'espace équipe du restaurant concerné.
          </p>
          {restaurants.length === 0 && <p className="text-[#8a7561]">Chargement…</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {restaurants.map((r) => {
              const restaurantOrders = realOrders.filter((o) => o.restaurantId === r.id);
              const total = restaurantOrders.reduce((s, o) => s + o.total, 0);
              const collected = restaurantOrders.filter((o) => o.status === "servie").reduce((s, o) => s + o.total, 0);
              return (
                <div key={r.id} className="rounded-2xl border border-[#3a2b1f] bg-[#211712] p-6">
                  <div className="display-font text-2xl font-bold mb-1">{r.name}</div>
                  <div className="text-[#a88f78] text-sm mb-5">{r.city}</div>
                  <div className="flex items-end justify-between mb-1">
                    <span className="text-xs text-[#a88f78] uppercase font-bold">Chiffre du jour</span>
                    <span className="display-font text-3xl font-bold text-[#E8B23D]">{eur(total)}</span>
                  </div>
                  <div className="text-xs text-[#8a7561] mb-6">
                    {restaurantOrders.length} commande{restaurantOrders.length > 1 ? "s" : ""} · dont {eur(collected)} déjà encaissé
                  </div>
                  <button
                    onClick={() => setSelected(r.id)}
                    className="tap-scale w-full rounded-xl py-4 font-bold"
                    style={{ background: "#C0392B", color: "#fff5ea" }}
                  >
                    Voir le détail →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "costprice" && <CostPriceAdmin />}
      {tab === "consumption" && <ConsumptionAdmin />}
      {tab === "suppliers" && <SupplierOrdersAdmin />}
      {tab === "messages" && <LoyaltyMessagesAdmin />}
      {tab === "autonomy" && <SourceStatsAdmin />}
    </div>
  );
}
