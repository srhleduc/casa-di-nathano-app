"use client";

import { useMemo, useState } from "react";
import { cartSignature, lineUnitPrice, withAutoFocaccia, computeSlotOptions, minutesFromNow, TAKEAWAY_SLOT_MARGIN_MINUTES } from "@/lib/business";
import { FORMULE_PRICE, eur } from "@/lib/menu";
import { useOrders, useSlots, useRuptures, useDessertStock, usePizzaStock, useMenu, useServiceTypeSettings, insertOrder } from "@/lib/data";
import { useRestaurant } from "@/lib/restaurant";

import WelcomeScreen from "./WelcomeScreen";
import ServiceTypeScreen from "./ServiceTypeScreen";
import AperoAskScreen from "./AperoAskScreen";
import OrderScreen from "./OrderScreen";
import PizzaCustomizeModal from "./PizzaCustomizeModal";
import FlavorModal from "./FlavorModal";
import PanuzzoModal from "./PanuzzoModal";
import CheckoutScreen from "./CheckoutScreen";
import SlotScreen from "./SlotScreen";
import StatusScreen from "./StatusScreen";
import PinScreen from "./PinScreen";
import TeamSpace from "./TeamSpace";

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

export default function Kiosk() {
  const [mode, setMode] = useState("client"); // client | pin | team
  const [teamUnlocked, setTeamUnlocked] = useState(false); // mémorise l'accès équipe pour toute la session
  const [screen, setScreen] = useState("welcome");
  const [activeCat, setActiveCat] = useState("pizza");
  const [cart, setCart] = useState([]);
  const [serviceType, setServiceType] = useState("🍽️ Sur place");
  const [tableName, setTableName] = useState("");
  const [customizing, setCustomizing] = useState(null); // pizza en cours de personnalisation
  const [flavoring, setFlavoring] = useState(null); // glace en cours de choix de parfum
  const [panuzzoOrdering, setPanuzzoOrdering] = useState(null); // panuzzo en cours (seul ou formule)
  const [aperoMode, setAperoMode] = useState(false); // vrai tant que le client n'a pas validé son apéro
  const [slotChoice, setSlotChoice] = useState(null); // résultat de computeSlotOptions
  const [selectedOption, setSelectedOption] = useState(null); // option choisie (créneau simple ou réparti)
  const [confirmedNumber, setConfirmedNumber] = useState(null); // numéro de commande à emporter, une fois connu

  const { orders } = useOrders();
  const { slots } = useSlots();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { menuItems } = useMenu();
  const { serviceTypeSettings } = useServiceTypeSettings();
  const restaurant = useRestaurant();

  const clientServiceOptions = [
    { value: "🍽️ Sur place", label: "Sur place", desc: "Je m'installe en salle", enabled: serviceTypeSettings.dineInEnabled },
    { value: "🥡 À emporter", label: "À emporter", desc: "Je repars avec ma commande", enabled: serviceTypeSettings.takeawayEnabled },
  ].filter((o) => o.enabled);

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
    setServiceType("🍽️ Sur place");
    setActiveCat("pizza");
    setSlotChoice(null);
    setSelectedOption(null);
    setAperoMode(false);
    setPanuzzoOrdering(null);
    setConfirmedNumber(null);
    setScreen("welcome");
  }

  function submitOrder(finalPlan) {
    const newOrder = {
      items: cart.map(({ id, name, price, cat, qty, note, modifiers }) => ({ id, name, price, cat, qty, note, modifiers })),
      serviceType,
      name: tableName || "Client borne",
      slotAllocations: finalPlan || [],
      pizzaCount,
      total,
      status: "attente",
    };
    setScreen("done");
    submitWithRetry(newOrder).then(setConfirmedNumber);
  }

  function goToSlot() {
    // Le pizzaiolo peut désactiver le décompte des créneaux pour le sur place
    // (voir SlotsAdmin) — la pizza part alors sans créneau réservé, mais
    // décompte quand même le stock de pâtons.
    const dineInSkipsSlot = serviceType === "🍽️ Sur place" && serviceTypeSettings.dineInCountsTowardSlots === false;
    if (pizzaCount === 0 || dineInSkipsSlot) {
      submitOrder(null);
      return;
    }
    const choice = computeSlotOptions(orders, slots, pizzaCount, serviceType === "🍽️ Sur place" ? 0 : TAKEAWAY_SLOT_MARGIN_MINUTES);
    if (serviceType === "🍽️ Sur place" && choice.mode !== "none") {
      const finalPlan =
        choice.mode === "split" ? choice.plans[0] : [{ slotId: choice.options[0].id, label: choice.options[0].label, qty: pizzaCount }];
      setSlotChoice(choice);
      submitOrder(finalPlan);
      return;
    }
    setSelectedOption(null);
    setSlotChoice(choice);
    setScreen("slot");
  }

  function onSiteDoneMessage() {
    if (serviceType === "🍽️ Sur place" && slotChoice && slotChoice.mode !== "none") {
      const label = slotChoice.mode === "split" ? slotChoice.plans[0][0].label : slotChoice.options[0].label;
      const mins = minutesFromNow(label);
      return mins !== null
        ? `Votre commande sera lancée dans les ${Math.max(5, Math.ceil(mins / 5) * 5)} prochaines minutes (vers ${label}).`
        : `Merci ${tableName ? tableName + " " : ""}— votre commande est partie en cuisine.`;
    }
    return `Merci ${tableName ? tableName + " " : ""}— rends-toi en caisse pour régler.`;
  }

  if (mode === "pin") return <PinScreen onSuccess={() => { setTeamUnlocked(true); setMode("team"); }} onCancel={() => setMode("client")} />;
  if (mode === "team") return <TeamSpace onExit={() => setMode("client")} />;

  return (
    <div className="kiosk-root">
      {screen === "welcome" && (
        <WelcomeScreen onStart={() => setScreen("service")} onTeam={() => setMode(teamUnlocked ? "team" : "pin")} restaurantName={restaurant.name} />
      )}

      {screen === "service" && (
        <ServiceTypeScreen
          options={clientServiceOptions}
          onSelect={(type) => {
            setServiceType(type);
            if (type === "🍽️ Sur place") setScreen("apero-ask");
            else {
              setAperoMode(false);
              setActiveCat("pizza");
              setScreen("order");
            }
          }}
        />
      )}

      {screen === "apero-ask" && (
        <AperoAskScreen
          onAnswer={(wantsApero) => {
            if (wantsApero) {
              setAperoMode(true);
              setActiveCat("boisson");
            } else {
              setAperoMode(false);
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
          pizzaStock={pizzaStock}
          menu={menuItems}
          restaurantName={restaurant.name}
          showPhotos={true}
          clientView
          serviceType={serviceType}
          onPanuzzoTap={setPanuzzoOrdering}
          onFinishApero={() => {
            setAperoMode(false);
            setActiveCat("pizza");
          }}
        />
      )}

      {customizing && (
        <PizzaCustomizeModal pizza={customizing} menu={menuItems} onClose={() => setCustomizing(null)} onConfirm={(removedItems, addedItems) => addCustomizedPizza(customizing, removedItems, addedItems)} />
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
          selectedOption={selectedOption}
          setSelectedOption={setSelectedOption}
          allSlotsConfigured={slots.length > 0}
          onBack={() => setScreen("checkout")}
          onConfirm={() => submitOrder(selectedOption?.plan || null)}
        />
      )}

      {screen === "done" && (
        <StatusScreen title="Commande envoyée !" subtitle={onSiteDoneMessage()} success onDone={resetAll} bigNumber={confirmedNumber} />
      )}
    </div>
  );
}
