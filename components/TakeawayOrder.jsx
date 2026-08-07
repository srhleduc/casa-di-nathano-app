"use client";

// Parcours de commande à emporter par lien/QR code (/commande) — volontairement
// séparé de Kiosk.jsx : ce fichier n'importe ni PinScreen ni TeamSpace, donc
// l'espace équipe n'existe tout simplement pas dans l'arbre de composants
// rendu ici, quelle que soit la manipulation d'URL tentée par un client.

import { useMemo, useState } from "react";
import { cartSignature, lineUnitPrice, withAutoFocaccia, computeSlotOptions, minutesFromNow, TAKEAWAY_SERVICE_TYPE } from "@/lib/business";
import { FORMULE_PRICE, eur } from "@/lib/menu";
import { useOrders, useSlots, useRuptures, useDessertStock, usePizzaStock, useMenu, useTakeawayLinkStatus, insertOrder } from "@/lib/data";
import { useRestaurant } from "@/lib/restaurant";

import WelcomeScreen from "./WelcomeScreen";
import OrderScreen from "./OrderScreen";
import PizzaCustomizeModal from "./PizzaCustomizeModal";
import FlavorModal from "./FlavorModal";
import PanuzzoModal from "./PanuzzoModal";
import CheckoutScreen from "./CheckoutScreen";
import SlotScreen from "./SlotScreen";
import StatusScreen from "./StatusScreen";

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

function SuspendedScreen({ restaurantName, phone }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <span className="text-6xl mb-6">⏸️</span>
      <h1 className="display-font text-3xl font-semibold mb-4">{restaurantName}</h1>
      <p className="text-[#c9b8a4] text-lg max-w-md mb-2">La commande en ligne est temporairement indisponible.</p>
      {phone && (
        <p className="text-[#c9b8a4] text-lg max-w-md">
          Merci de nous appeler directement au{" "}
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className="font-bold text-[#E8B23D]">
            {phone}
          </a>
          .
        </p>
      )}
    </div>
  );
}

export default function TakeawayOrder() {
  const [screen, setScreen] = useState("welcome"); // welcome | order | checkout | slot | done
  const [activeCat, setActiveCat] = useState("pizza");
  const [cart, setCart] = useState([]);
  const [serviceType, setServiceType] = useState(TAKEAWAY_SERVICE_TYPE); // ne change jamais ici, un seul choix possible
  const [tableName, setTableName] = useState("");
  const [customizing, setCustomizing] = useState(null);
  const [flavoring, setFlavoring] = useState(null);
  const [panuzzoOrdering, setPanuzzoOrdering] = useState(null);
  const [slotChoice, setSlotChoice] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [confirmedNumber, setConfirmedNumber] = useState(null);

  const { orders } = useOrders();
  const { slots } = useSlots();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { menuItems } = useMenu();
  const { suspended, loading: suspendedLoading } = useTakeawayLinkStatus();
  const restaurant = useRestaurant();

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
    setActiveCat("pizza");
    setSlotChoice(null);
    setSelectedSlot(null);
    setPanuzzoOrdering(null);
    setConfirmedNumber(null);
    setScreen("welcome");
  }

  function submitOrder(finalPlan) {
    const newOrder = {
      items: cart.map(({ id, name, price, cat, qty, note, modifiers }) => ({ id, name, price, cat, qty, note, modifiers })),
      serviceType: TAKEAWAY_SERVICE_TYPE,
      name: tableName || "Commande en ligne",
      slotAllocations: finalPlan || [],
      pizzaCount,
      total,
      status: "attente",
    };
    setScreen("done");
    submitWithRetry(newOrder).then(setConfirmedNumber);
  }

  function goToSlot() {
    if (pizzaCount === 0) {
      submitOrder(null);
      return;
    }
    const choice = computeSlotOptions(orders, slots, pizzaCount);
    setSelectedSlot(null);
    setSlotChoice(choice);
    setScreen("slot");
  }

  function doneMessage() {
    return `Merci ${tableName ? tableName + " " : ""}— rends-toi sur place pour récupérer ta commande et régler.`;
  }

  if (suspendedLoading) {
    return (
      <div className="kiosk-root">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#8a7561] text-sm">Chargement…</p>
        </div>
      </div>
    );
  }

  if (suspended) {
    return (
      <div className="kiosk-root">
        <SuspendedScreen restaurantName={restaurant.name} phone={restaurant.phone} />
      </div>
    );
  }

  return (
    <div className="kiosk-root">
      {screen === "welcome" && <WelcomeScreen onStart={() => setScreen("order")} restaurantName={restaurant.name} />}

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
          aperoMode={false}
          ruptures={ruptures}
          orders={orders}
          dessertStock={dessertStock}
          pizzaStock={pizzaStock}
          menu={menuItems}
          restaurantName={restaurant.name}
          showPhotos={true}
          serviceType={serviceType}
          onPanuzzoTap={setPanuzzoOrdering}
          onFinishApero={() => {}}
        />
      )}

      {customizing && (
        <PizzaCustomizeModal
          pizza={customizing}
          menu={menuItems}
          onClose={() => setCustomizing(null)}
          onConfirm={(removedItems, addedItems) => addCustomizedPizza(customizing, removedItems, addedItems)}
        />
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

      {screen === "checkout" && (
        <CheckoutScreen
          cart={cart}
          changeQty={changeQty}
          total={total}
          pizzaCount={pizzaCount}
          serviceType={serviceType}
          setServiceType={setServiceType}
          serviceTypeOptions={[TAKEAWAY_SERVICE_TYPE]}
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
        <StatusScreen title="Commande envoyée !" subtitle={doneMessage()} success onDone={resetAll} bigNumber={confirmedNumber} />
      )}
    </div>
  );
}
