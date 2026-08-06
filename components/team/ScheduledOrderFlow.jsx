"use client";

import { useMemo, useState } from "react";
import { MENU } from "@/lib/menu";
import { cartSignature, withAutoFocaccia, lineUnitPrice, todayStr, formatFrenchDate } from "@/lib/business";
import { useRuptures, useCustomMenuItems, insertOrder } from "@/lib/data";

import OrderScreen from "../OrderScreen";
import PizzaCustomizeModal from "../PizzaCustomizeModal";
import FlavorModal from "../FlavorModal";
import CheckoutScreen from "../CheckoutScreen";
import StatusScreen from "../StatusScreen";

async function submitWithRetry(order, attempt = 1) {
  try {
    await insertOrder(order);
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400));
      return submitWithRetry(order, attempt + 1);
    }
    console.error("Échec définitif de l'enregistrement de la commande programmée", err);
  }
}

export default function ScheduledOrderFlow({ onDone }) {
  const { ruptures } = useRuptures();
  const { customMenuItems } = useCustomMenuItems();
  const fullMenu = useMemo(() => [...MENU, ...customMenuItems], [customMenuItems]);

  const [screen, setScreen] = useState("date"); // date | order | checkout | done
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [activeCat, setActiveCat] = useState("pizza");
  const [cart, setCart] = useState([]);
  const [serviceType, setServiceType] = useState("🍽️ Sur place");
  const [tableName, setTableName] = useState("");
  const [customizing, setCustomizing] = useState(null);
  const [flavoring, setFlavoring] = useState(null);

  const total = useMemo(() => cart.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const pizzaCount = useMemo(() => cart.filter((i) => i.cat === "pizza").reduce((s, i) => s + i.qty, 0), [cart]);

  function addItem(item, note) {
    setCart((prev) => {
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) === cartSignature(item.id, note, null));
      let next = existing
        ? prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { ...item, qty: 1, note: note || null, modifiers: [] }];
      return withAutoFocaccia(next, item);
    });
  }
  function addCustomizedPizza(pizzaItem, removedItems, addedItems) {
    const modifiers = [
      ...removedItems.map((i) => ({ name: i.name, price: i.price })),
      ...addedItems.map((i) => ({ name: i.name, price: i.price })),
    ];
    setCart((prev) => {
      const sig = cartSignature(pizzaItem.id, null, modifiers);
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) === sig);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...pizzaItem, qty: 1, note: null, modifiers }];
    });
    setCustomizing(null);
  }
  function changeQty(id, note, modifiers, delta) {
    const sig = cartSignature(id, note, modifiers);
    setCart((prev) => prev.map((i) => (cartSignature(i.id, i.note, i.modifiers) === sig ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  }

  function submitOrder() {
    const newOrder = {
      items: cart.map(({ id, name, price, cat, qty, note, modifiers }) => ({ id, name, price, cat, qty, note, modifiers })),
      serviceType,
      name: tableName || "Commande programmée",
      slotAllocations: [],
      pizzaCount,
      total,
      status: "attente",
      scheduledFor,
      scheduledTime,
    };
    setScreen("done");
    submitWithRetry(newOrder);
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {screen === "date" && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <span className="text-6xl mb-6">📅</span>
          <h2 className="display-font text-3xl font-semibold mb-6">Pour quel jour ?</h2>
          <input
            type="date"
            value={scheduledFor}
            min={todayStr()}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="rounded-xl px-4 py-4 text-lg mb-4"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          />
          <div className="text-sm text-[#a88f78] uppercase font-bold mb-2">À quelle heure ?</div>
          <input
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            className="rounded-xl px-4 py-4 text-lg mb-8"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          />
          <div className="flex gap-4">
            <button onClick={onDone} className="tap-scale rounded-full px-8 py-4 font-bold border-2 border-[#3a2b1f]">
              Annuler
            </button>
            <button
              onClick={() => setScreen("order")}
              disabled={!scheduledFor || !scheduledTime}
              className="tap-scale rounded-full px-8 py-4 font-bold disabled:opacity-40"
              style={{ background: "#C0392B", color: "#fff5ea" }}
            >
              Continuer →
            </button>
          </div>
        </div>
      )}

      {screen === "order" && (
        <OrderScreen
          activeCat={activeCat}
          setActiveCat={setActiveCat}
          cart={cart}
          addItem={addItem}
          onPizzaTap={setCustomizing}
          onGlaceTap={setFlavoring}
          changeQty={changeQty}
          total={total}
          itemCount={itemCount}
          onCancel={onDone}
          onCheckout={() => setScreen("checkout")}
          aperoMode={false}
          ruptures={ruptures}
          orders={[]}
          dessertStock={{}}
          menu={fullMenu}
          onFinishApero={() => {}}
        />
      )}

      {screen === "checkout" && (
        <CheckoutScreen
          cart={cart}
          changeQty={changeQty}
          total={total}
          pizzaCount={0}
          serviceType={serviceType}
          setServiceType={setServiceType}
          tableName={tableName}
          setTableName={setTableName}
          onBack={() => setScreen("order")}
          onConfirm={submitOrder}
        />
      )}

      {screen === "done" && (
        <StatusScreen title="Commande programmée !" subtitle={`Elle basculera automatiquement le ${formatFrenchDate(scheduledFor)} à ${scheduledTime}.`} success onDone={onDone} />
      )}

      {customizing && (
        <PizzaCustomizeModal pizza={customizing} onClose={() => setCustomizing(null)} onConfirm={(r, a) => addCustomizedPizza(customizing, r, a)} />
      )}
      {flavoring && (
        <FlavorModal
          item={flavoring}
          onClose={() => setFlavoring(null)}
          onConfirm={(note) => {
            addItem(flavoring, note);
            setFlavoring(null);
          }}
        />
      )}
    </div>
  );
}
