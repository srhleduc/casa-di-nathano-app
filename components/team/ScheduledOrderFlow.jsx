"use client";

import { useMemo, useState } from "react";
import { cartSignature, withAutoFocaccia, lineUnitPrice, todayStr, formatFrenchDate, MIDI_SLOT_LABELS, SOIR_SLOT_LABELS } from "@/lib/business";
import { useRuptures, useMenu, useTestMode, insertOrder } from "@/lib/data";
import { useRestaurant } from "@/lib/restaurant";

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
  const { menuItems } = useMenu();
  const { testMode } = useTestMode();
  const restaurant = useRestaurant();

  const [screen, setScreen] = useState("date"); // date | order | checkout | done
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [activeCat, setActiveCat] = useState("pizza");
  const [cart, setCart] = useState([]);
  const [serviceType, setServiceType] = useState("🍽️ Sur place");
  const [tableName, setTableName] = useState("");
  const [note, setNote] = useState("");
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
      return withAutoFocaccia(next, item, undefined, menuItems);
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
      note: note.trim() || null,
      slotAllocations: [],
      pizzaCount,
      total,
      status: "attente",
      scheduledFor,
      scheduledTime,
      isTest: testMode.enabled,
    };
    setScreen("done");
    submitWithRetry(newOrder);
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {testMode.enabled && (
        <div className="px-6 py-3 text-center text-sm font-bold shrink-0" style={{ background: "#f0c860", color: "#1a120b" }}>
          🧪 MODE TEST ACTIF — cette commande ne sera pas comptabilisée dans le chiffre du jour et sera supprimée à la désactivation
        </div>
      )}
      {screen === "date" && (
        <div className="flex-1 flex flex-col items-center px-8 py-8 overflow-y-auto text-center">
          <span className="text-6xl mb-6">📅</span>
          <h2 className="display-font text-3xl font-semibold mb-6">Pour quel jour ?</h2>
          <input
            type="date"
            value={scheduledFor}
            min={todayStr()}
            onChange={(e) => setScheduledFor(e.target.value)}
            className="rounded-xl px-4 py-4 text-lg mb-8"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          />

          <div className="text-sm text-[#a88f78] uppercase font-bold mb-2">☀️ Service midi</div>
          <div className="flex flex-wrap gap-2 justify-center mb-6 max-w-xl">
            {MIDI_SLOT_LABELS.map((l) => (
              <button
                key={l}
                onClick={() => setScheduledTime(l)}
                className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
                style={scheduledTime === l ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="text-sm text-[#a88f78] uppercase font-bold mb-2">🌙 Service soir</div>
          <div className="flex flex-wrap gap-2 justify-center mb-8 max-w-xl">
            {SOIR_SLOT_LABELS.map((l) => (
              <button
                key={l}
                onClick={() => setScheduledTime(l)}
                className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
                style={scheduledTime === l ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", color: "#c9b8a4" }}
              >
                {l}
              </button>
            ))}
          </div>

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
          menu={menuItems}
          restaurantName={restaurant.name}
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
          note={note}
          setNote={setNote}
          onBack={() => setScreen("order")}
          onConfirm={submitOrder}
        />
      )}

      {screen === "done" && (
        <StatusScreen
          title="Commande programmée !"
          subtitle={`Elle apparaîtra automatiquement sur les écrans dès minuit le ${formatFrenchDate(scheduledFor)}, à la bonne place selon son horaire (${scheduledTime}).`}
          success
          onDone={onDone}
        />
      )}

      {customizing && (
        <PizzaCustomizeModal pizza={customizing} menu={menuItems} onClose={() => setCustomizing(null)} onConfirm={(r, a) => addCustomizedPizza(customizing, r, a)} />
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
