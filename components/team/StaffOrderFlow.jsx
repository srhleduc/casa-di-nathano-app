"use client";

import { useMemo, useState } from "react";
import { MENU } from "@/lib/menu";
import { cartSignature, withAutoFocaccia, computeSlotOptions, lineUnitPrice } from "@/lib/business";
import { useOrders, useSlots, useRuptures, useDessertStock, useCustomMenuItems, insertOrder } from "@/lib/data";

import AperoAskScreen from "../AperoAskScreen";
import OrderScreen from "../OrderScreen";
import PizzaCustomizeModal from "../PizzaCustomizeModal";
import FlavorModal from "../FlavorModal";
import CheckoutScreen from "../CheckoutScreen";
import SlotScreen from "../SlotScreen";
import StatusScreen from "../StatusScreen";

async function submitWithRetry(order, attempt = 1) {
  try {
    await insertOrder(order);
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400));
      return submitWithRetry(order, attempt + 1);
    }
    console.error("Échec définitif de l'enregistrement de la commande", err);
  }
}

export default function StaffOrderFlow() {
  const { orders } = useOrders();
  const { slots } = useSlots();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { customMenuItems } = useCustomMenuItems();
  const fullMenu = useMemo(() => [...MENU, ...customMenuItems], [customMenuItems]);

  const [screen, setScreen] = useState("apero-ask"); // apero-ask | order | checkout | slot | done
  const [activeCat, setActiveCat] = useState("boisson");
  const [cart, setCart] = useState([]);
  const [serviceType, setServiceType] = useState("🍽️ Sur place");
  const [tableName, setTableName] = useState("");
  const [customizing, setCustomizing] = useState(null);
  const [flavoring, setFlavoring] = useState(null);
  const [slotChoice, setSlotChoice] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [aperoMode, setAperoMode] = useState(false); // vrai pendant la sélection de l'apéro
  const [aperoUsed, setAperoUsed] = useState(false); // vrai si cette commande a démarré par un apéro

  const total = useMemo(() => cart.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const pizzaCount = useMemo(() => cart.filter((i) => i.cat === "pizza").reduce((s, i) => s + i.qty, 0), [cart]);

  function addItem(item, note) {
    const phase = aperoMode ? "apero" : aperoUsed ? "main" : undefined;
    setCart((prev) => {
      const sig = cartSignature(item.id, note, null) + "|" + (phase || "");
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) + "|" + (i.phase || "") === sig);
      let next = existing
        ? prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { ...item, qty: 1, note: note || null, modifiers: [], phase }];
      return withAutoFocaccia(next, item, phase);
    });
  }
  function addCustomizedPizza(pizzaItem, removedItems, addedItems) {
    const phase = aperoMode ? "apero" : aperoUsed ? "main" : undefined;
    const modifiers = [
      ...removedItems.map((i) => ({ name: i.name, price: i.price })),
      ...addedItems.map((i) => ({ name: i.name, price: i.price })),
    ];
    setCart((prev) => {
      const sig = cartSignature(pizzaItem.id, null, modifiers) + "|" + (phase || "");
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) + "|" + (i.phase || "") === sig);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...pizzaItem, qty: 1, note: null, modifiers, phase }];
    });
    setCustomizing(null);
  }
  function changeQty(id, note, modifiers, delta) {
    const sig = cartSignature(id, note, modifiers);
    setCart((prev) => prev.map((i) => (cartSignature(i.id, i.note, i.modifiers) === sig ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  }
  function resetAll() {
    setCart([]);
    setTableName("");
    setServiceType("🍽️ Sur place");
    setActiveCat("boisson");
    setSlotChoice(null);
    setSelectedSlot(null);
    setAperoMode(false);
    setAperoUsed(false);
    setScreen("apero-ask");
  }

  function submitOrder(finalPlan) {
    const hasMainPizza = cart.some((i) => i.cat === "pizza" && i.phase === "main");
    const newOrder = {
      items: cart.map(({ id, name, price, cat, qty, note, phase, modifiers }) => ({ id, name, price, cat, qty, note, phase, modifiers })),
      serviceType,
      name: tableName || "Commande équipe",
      slotAllocations: finalPlan || [],
      pizzaCount,
      total,
      status: "attente",
      aperoStatus: aperoUsed && hasMainPizza ? "waiting" : null,
    };
    setScreen("done");
    submitWithRetry(newOrder);
  }

  function goToSlot() {
    if (pizzaCount === 0) {
      submitOrder(null);
      return;
    }
    setSelectedSlot(null);
    setSlotChoice(computeSlotOptions(orders, slots, pizzaCount));
    setScreen("slot");
  }

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {screen === "apero-ask" && (
        <AperoAskScreen
          onAnswer={(wantsApero) => {
            if (wantsApero) {
              setAperoMode(true);
              setAperoUsed(true);
              setActiveCat("boisson");
            } else {
              setAperoMode(false);
              setAperoUsed(false);
              setActiveCat("pizza");
            }
            setScreen("order");
          }}
        />
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
          onCancel={resetAll}
          onCheckout={() => setScreen("checkout")}
          aperoMode={aperoMode}
          ruptures={ruptures}
          orders={orders}
          dessertStock={dessertStock}
          menu={fullMenu}
          onFinishApero={() => {
            setAperoMode(false);
            setActiveCat("pizza");
          }}
        />
      )}

      {screen === "checkout" && (
        <CheckoutScreen
          cart={cart}
          changeQty={changeQty}
          total={total}
          pizzaCount={pizzaCount}
          serviceType={serviceType}
          setServiceType={setServiceType}
          tableName={tableName}
          setTableName={setTableName}
          onBack={() => setScreen("order")}
          onConfirm={goToSlot}
        />
      )}

      {screen === "slot" && (
        <SlotScreen
          pizzaCount={pizzaCount}
          slotChoice={slotChoice}
          selectedSlot={selectedSlot}
          setSelectedSlot={setSelectedSlot}
          allSlotsConfigured={slots.length > 0}
          onBack={() => setScreen("checkout")}
          onConfirm={() => {
            const finalPlan =
              slotChoice.mode === "split" ? slotChoice.plan : selectedSlot ? [{ slotId: selectedSlot.id, label: selectedSlot.label, qty: pizzaCount }] : null;
            submitOrder(finalPlan);
          }}
        />
      )}

      {screen === "done" && <StatusScreen title="Commande enregistrée !" subtitle="Elle est partie en cuisine." success onDone={resetAll} />}

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
