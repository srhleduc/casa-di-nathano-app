"use client";

import { useMemo, useState } from "react";
import { cartSignature, withAutoFocaccia, computeSlotOptions, lineUnitPrice, RESERVED_SERVICE_TYPE, RESERVED_SERVICE_NOTE } from "@/lib/business";
import { FORMULE_PRICE, eur } from "@/lib/menu";
import { useOrders, useSlots, useRuptures, useDessertStock, usePizzaStock, useMenu, useTestMode, useServiceTypeSettings, insertOrder } from "@/lib/data";
import { useRestaurant } from "@/lib/restaurant";

import ServiceTypeScreen from "../ServiceTypeScreen";
import AperoAskScreen from "../AperoAskScreen";
import OrderScreen from "../OrderScreen";
import PizzaCustomizeModal from "../PizzaCustomizeModal";
import FlavorModal from "../FlavorModal";
import PanuzzoModal from "../PanuzzoModal";
import CheckoutScreen from "../CheckoutScreen";
import SlotScreen from "../SlotScreen";
import StatusScreen from "../StatusScreen";

const STAFF_SERVICE_OPTIONS = [
  { value: "🍽️ Sur place", label: "Sur place", desc: "La table s'installe en salle" },
  { value: "🥡 À emporter", label: "À emporter", desc: "Le client repart avec sa commande" },
  { value: RESERVED_SERVICE_TYPE, label: "Sur place déjà réservé", desc: RESERVED_SERVICE_NOTE },
];

async function submitWithRetry(order, attempt = 1) {
  try {
    return await insertOrder(order);
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400));
      return submitWithRetry(order, attempt + 1);
    }
    console.error("Échec définitif de l'enregistrement de la commande", err);
    return null;
  }
}

export default function StaffOrderFlow() {
  const { orders } = useOrders();
  const { slots } = useSlots();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { menuItems } = useMenu();
  const { testMode } = useTestMode();
  const { serviceTypeSettings } = useServiceTypeSettings();
  const restaurant = useRestaurant();

  const [screen, setScreen] = useState("service"); // service | apero-ask | order | checkout | slot | done
  const [activeCat, setActiveCat] = useState("boisson");
  const [cart, setCart] = useState([]);
  const [serviceType, setServiceType] = useState("🍽️ Sur place");
  const [tableName, setTableName] = useState("");
  const [customizing, setCustomizing] = useState(null);
  const [flavoring, setFlavoring] = useState(null);
  const [panuzzoOrdering, setPanuzzoOrdering] = useState(null);
  const [slotChoice, setSlotChoice] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [confirmedNumber, setConfirmedNumber] = useState(null);
  const [checkPizzaCount, setCheckPizzaCount] = useState(0); // vérif rapide de dispo avant de commander
  const [aperoMode, setAperoMode] = useState(false); // vrai pendant la sélection de l'apéro
  const [aperoUsed, setAperoUsed] = useState(false); // vrai si cette commande a démarré par un apéro

  const total = useMemo(() => cart.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const pizzaCount = useMemo(() => cart.filter((i) => i.cat === "pizza").reduce((s, i) => s + i.qty, 0), [cart]);

  const SERVICE_ENABLED_BY_VALUE = {
    "🍽️ Sur place": serviceTypeSettings.dineInEnabled,
    "🥡 À emporter": serviceTypeSettings.takeawayEnabled,
    [RESERVED_SERVICE_TYPE]: serviceTypeSettings.reservedEnabled,
  };
  const availableServiceOptions = STAFF_SERVICE_OPTIONS.filter((o) => SERVICE_ENABLED_BY_VALUE[o.value]);
  const availableServiceValues = availableServiceOptions.map((o) => o.value);

  function addItem(item, note) {
    const phase = aperoMode ? "apero" : aperoUsed ? "main" : undefined;
    setCart((prev) => {
      const sig = cartSignature(item.id, note, null) + "|" + (phase || "");
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) + "|" + (i.phase || "") === sig);
      let next = existing
        ? prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { ...item, qty: 1, note: note || null, modifiers: [], phase }];
      return withAutoFocaccia(next, item, phase, menuItems);
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
  function addFormule(sandwich, drinkItem, drinkSupplement, dessertItem, dessertSupplement) {
    addItem({ ...sandwich, price: FORMULE_PRICE }, "Formule");
    addItem({ ...drinkItem, price: drinkSupplement }, drinkSupplement > 0 ? `Formule +${eur(drinkSupplement)}` : "Formule (incluse)");
    addItem({ ...dessertItem, price: dessertSupplement }, dessertSupplement > 0 ? `Formule +${eur(dessertSupplement)}` : "Formule (inclus)");
    setPanuzzoOrdering(null);
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
    setPanuzzoOrdering(null);
    setConfirmedNumber(null);
    setScreen("service");
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
      isTest: testMode.enabled,
    };
    setScreen("done");
    submitWithRetry(newOrder).then(setConfirmedNumber);
  }

  function goToSlot() {
    // Table déjà réservée en amont : sa capacité a déjà été retirée
    // manuellement des créneaux, on ne la redécompte pas ici.
    if (serviceType === RESERVED_SERVICE_TYPE) {
      submitOrder(null);
      return;
    }
    if (pizzaCount === 0) {
      submitOrder(null);
      return;
    }
    setSelectedSlot(null);
    setSlotChoice(computeSlotOptions(orders, slots, pizzaCount));
    setScreen("slot");
  }

  const checkSlotChoice = checkPizzaCount > 0 ? computeSlotOptions(orders, slots, checkPizzaCount) : null;

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {screen === "service" && (
        <div className="px-6 py-4 border-b border-[#3a2b1f] flex items-center gap-4 flex-wrap">
          <span className="text-sm font-bold text-[#a88f78]">📞 Vérifier une dispo avant de commander :</span>
          <select
            value={checkPizzaCount}
            onChange={(e) => setCheckPizzaCount(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          >
            <option value={0}>Nb pizzas…</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} pizza{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
          {checkSlotChoice && (
            <span className="text-sm font-bold" style={{ color: "#E8B23D" }}>
              {checkSlotChoice.mode === "none" && "😕 Aucune place disponible aujourd'hui"}
              {checkSlotChoice.mode === "single" &&
                checkSlotChoice.options[0] &&
                `🕐 Créneau le plus proche : ${checkSlotChoice.options[0].label} (${checkSlotChoice.options[0].remaining} place${checkSlotChoice.options[0].remaining > 1 ? "s" : ""})`}
              {checkSlotChoice.mode === "split" &&
                `🕐 À répartir : ${checkSlotChoice.plan.map((p) => `${p.qty}×${p.label}`).join(" + ")}`}
            </span>
          )}
        </div>
      )}

      {screen === "service" && (
        <ServiceTypeScreen
          options={availableServiceOptions}
          onSelect={(type) => {
            setServiceType(type);
            if (type === "🥡 À emporter") {
              setAperoMode(false);
              setAperoUsed(false);
              setActiveCat("pizza");
              setScreen("order");
            } else {
              setScreen("apero-ask");
            }
          }}
        />
      )}

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
          onPanuzzoTap={setPanuzzoOrdering}
          changeQty={changeQty}
          total={total}
          itemCount={itemCount}
          onCancel={resetAll}
          onCheckout={() => setScreen("checkout")}
          aperoMode={aperoMode}
          ruptures={ruptures}
          orders={orders}
          dessertStock={dessertStock}
          pizzaStock={pizzaStock}
          menu={menuItems}
          restaurantName={restaurant.name}
          serviceType={serviceType}
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
          serviceTypeOptions={availableServiceValues}
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

      {screen === "done" && (
        <StatusScreen title="Commande enregistrée !" subtitle="Elle est partie en cuisine." success onDone={resetAll} bigNumber={confirmedNumber} />
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
      {panuzzoOrdering && (
        <PanuzzoModal
          item={panuzzoOrdering}
          menu={menuItems}
          dessertStock={dessertStock}
          orders={orders}
          ruptures={ruptures}
          serviceType={serviceType}
          onClose={() => setPanuzzoOrdering(null)}
          onAddSolo={(item) => {
            addItem(item);
            setPanuzzoOrdering(null);
          }}
          onAddFormule={addFormule}
        />
      )}
    </div>
  );
}
