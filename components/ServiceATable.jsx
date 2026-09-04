"use client";

// Parcours « Service À Table » (/sat?table=N) — le client, déjà installé,
// commande depuis son téléphone en scannant le QR posé sur la table. Comme
// TakeawayOrder.jsx, ce fichier n'importe NI PinScreen NI TeamSpace : aucun
// accès équipe possible, quelle que soit la manipulation d'URL.
//
// Différences avec la borne : sur place uniquement (pas de choix de type de
// service, pas d'apéro), pas de créneau affiché (réservé silencieusement comme
// le sur place borne), pas de CGV / téléphone / fidélité (réglées en caisse).
// Les articles ajoutés portent source = "sat" et rejoignent directement le
// pipeline cuisine ; si une commande est déjà ouverte pour la table, ils y
// sont ajoutés (sat_append_items) au lieu d'en créer une concurrente.

import { useEffect, useMemo, useState } from "react";
import {
  cartSignature,
  lineUnitPrice,
  withAutoFocaccia,
  computeSlotOptions,
  earliestSlotPlan,
  kitchenPendingQty,
  tableDisplayLabel,
  tableDisplayName,
  findOpenDineInOrderForTables,
} from "@/lib/business";
import { FORMULE_PRICE, eur } from "@/lib/menu";
import {
  useOrders,
  useSlots,
  useRuptures,
  useDessertStock,
  usePizzaStock,
  useMenu,
  useTables,
  useServiceTypeSettings,
  insertOrder,
  appendItemsToOrder,
} from "@/lib/data";
import { useRestaurant } from "@/lib/restaurant";

import OrderScreen from "./OrderScreen";
import PizzaCustomizeModal from "./PizzaCustomizeModal";
import FlavorModal from "./FlavorModal";
import PanuzzoModal from "./PanuzzoModal";
import CheckoutScreen from "./CheckoutScreen";
import StatusScreen from "./StatusScreen";

const DINE_IN = "🍽️ Sur place";
const tableNumberCollator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

async function submitWithRetry(fn, attempt = 1) {
  try {
    return await fn();
  } catch (err) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400));
      return submitWithRetry(fn, attempt + 1);
    }
    console.error("Échec définitif de l'enregistrement de la commande", err);
    return null;
  }
}

export default function ServiceATable() {
  const [screen, setScreen] = useState("welcome"); // welcome | order | checkout | done
  const [activeCat, setActiveCat] = useState("pizza");
  const [cart, setCart] = useState([]);
  const [tableId, setTableId] = useState(null); // table choisie (id du registre `tables`)
  const [customizing, setCustomizing] = useState(null);
  const [flavoring, setFlavoring] = useState(null);
  const [panuzzoOrdering, setPanuzzoOrdering] = useState(null);
  const [submitted, setSubmitted] = useState(false); // évite un double envoi
  const [completing, setCompleting] = useState(false); // a rejoint une commande déjà ouverte

  // Paramètre ?table= lu côté navigateur (pas de useSearchParams : évite la
  // Suspense boundary et reste cohérent avec le reste de l'app, tout client).
  const [paramNumber, setParamNumber] = useState(undefined); // undefined = pas encore lu
  useEffect(() => {
    try {
      setParamNumber(new URLSearchParams(window.location.search).get("table"));
    } catch {
      setParamNumber(null);
    }
  }, []);

  const { orders } = useOrders();
  const { slots } = useSlots();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { menuItems } = useMenu();
  const { tables, loading: tablesLoading } = useTables();
  const { serviceTypeSettings } = useServiceTypeSettings();
  const restaurant = useRestaurant();

  const activeTables = useMemo(
    () => tables.filter((t) => t.active).sort((a, b) => tableNumberCollator.compare(tableDisplayName(a), tableDisplayName(b))),
    [tables]
  );
  const paramTable = useMemo(
    () => (paramNumber ? activeTables.find((t) => t.number === String(paramNumber)) : null),
    [paramNumber, activeTables]
  );

  const total = useMemo(() => cart.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const pizzaCount = useMemo(() => cart.filter((i) => i.cat === "pizza").reduce((s, i) => s + i.qty, 0), [cart]);

  function openOrderForTable(id) {
    return id ? findOpenDineInOrderForTables(orders, { tableIds: [id] }) : null;
  }

  function addItem(item, note) {
    setCart((prev) => {
      const existing = prev.find((i) => cartSignature(i.id, i.note, i.modifiers) === cartSignature(item.id, note, null));
      const next = existing
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

  function startForTable(id) {
    setTableId(id);
    setCompleting(Boolean(openOrderForTable(id)));
    setActiveCat("pizza");
    setScreen("order");
  }

  function submitOrder() {
    if (submitted || !tableId) return;
    setSubmitted(true);
    const items = cart.map(({ id, name, price, cat, qty, note, modifiers }) => ({
      id, name, price, cat, qty, note, modifiers, source: "sat",
    }));
    // On relit la commande ouverte AU MOMENT de valider : une serveuse a pu
    // ouvrir (ou encaisser) la table pendant que le client composait son panier.
    const existing = findOpenDineInOrderForTables(orders, { tableIds: [tableId] });

    setScreen("done");
    submitWithRetry(() => {
      if (existing) {
        return appendItemsToOrder(existing.id, {
          newItems: items,
          addedTotal: total,
          addedPizzaCount: pizzaCount,
          reopenKitchen: kitchenPendingQty(items) > 0,
          extraTableIds: [tableId],
        });
      }
      // Créneau réservé silencieusement (comme le sur place borne) — sauf si le
      // pizzaiolo a désactivé le décompte des créneaux pour le sur place, ou
      // s'il n'y a aucune pizza.
      const skipsSlot = serviceTypeSettings.dineInCountsTowardSlots === false;
      const finalPlan =
        pizzaCount === 0 || skipsSlot ? [] : earliestSlotPlan(computeSlotOptions(orders, slots, pizzaCount), pizzaCount) || [];
      return insertOrder({
        items,
        serviceType: DINE_IN,
        name: tableDisplayLabel({ tableIds: [tableId] }, tables),
        tableIds: [tableId],
        tableLabel: null,
        slotAllocations: finalPlan,
        pizzaCount,
        total,
        status: "attente",
      });
    });
  }

  function resetAll() {
    setCart([]);
    setTableId(null);
    setCompleting(false);
    setSubmitted(false);
    setCustomizing(null);
    setFlavoring(null);
    setPanuzzoOrdering(null);
    setActiveCat("pizza");
    setScreen("welcome");
  }

  // ------------------------------------------------------------- rendu --

  if (paramNumber === undefined || tablesLoading) {
    return (
      <div className="kiosk-root">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#8a7561] text-sm">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kiosk-root">
      {screen === "welcome" && (
        <SatWelcome
          restaurantName={restaurant.name}
          paramNumber={paramNumber}
          paramTable={paramTable}
          activeTables={activeTables}
          hasOpenOrder={(id) => Boolean(openOrderForTable(id))}
          onStart={startForTable}
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
          aperoMode={false}
          ruptures={ruptures}
          orders={orders}
          dessertStock={dessertStock}
          pizzaStock={pizzaStock}
          menu={menuItems}
          restaurantName={restaurant.name}
          showPhotos={true}
          clientView
          serviceType={DINE_IN}
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
          serviceType={DINE_IN}
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
          serviceType={DINE_IN}
          setServiceType={() => {}}
          serviceTypeOptions={[DINE_IN]}
          fixedTableLabel={tableDisplayLabel({ tableIds: tableId ? [tableId] : [] }, tables)}
          onBack={() => setScreen("order")}
          onConfirm={submitOrder}
        />
      )}

      {screen === "done" && (
        <StatusScreen
          title={completing ? "Ajout envoyé !" : "Commande envoyée !"}
          subtitle="C'est parti en cuisine. Le règlement se fait en caisse."
          success
          onDone={resetAll}
        />
      )}
    </div>
  );
}

function SatWelcome({ restaurantName, paramNumber, paramTable, activeTables, hasOpenOrder, onStart }) {
  // Table présélectionnée par le QR.
  if (paramTable) {
    const open = hasOpenOrder(paramTable.id);
    return (
      <div className="relative flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="oven-glow" />
        <div className="relative z-10 flex flex-col items-center max-w-md">
          <span className="text-6xl mb-4">🌿</span>
          <h1 className="display-font text-4xl font-semibold mb-1">{restaurantName}</h1>
          <p className="text-[#c9b8a4] text-lg mb-8">{tableDisplayName(paramTable)}</p>
          {open && (
            <p className="text-[#c9b8a4] text-base mb-6 leading-relaxed">
              Vous pouvez compléter votre commande, même si un serveur a déjà pris cette commande. Vous n'avez qu'à
              sélectionner votre table parmi celles qui vous sont proposées.
            </p>
          )}
          <button
            onClick={() => onStart(paramTable.id)}
            className="tap-scale rounded-full px-14 py-6 text-xl font-bold display-font italic"
            style={{ background: "#C0392B", color: "#fff5ea", boxShadow: "0 12px 30px rgba(192,57,43,0.35)" }}
          >
            {open ? "Compléter ma commande" : "Créer une nouvelle commande"}
          </button>
          <p className="text-[#8a7561] text-sm mt-8 tracking-wide uppercase">Règlement en caisse</p>
        </div>
      </div>
    );
  }

  // Accès sans QR (ou table du QR inconnue) : on propose toutes les tables actives.
  return (
    <div className="flex-1 flex flex-col px-6 py-8 overflow-y-auto">
      <div className="text-center mb-6">
        <span className="text-5xl">🌿</span>
        <h1 className="display-font text-3xl font-semibold mt-2">{restaurantName}</h1>
        <p className="text-[#c9b8a4] mt-1">
          {paramNumber
            ? `Table ${paramNumber} introuvable — choisissez votre table ci-dessous.`
            : "Choisissez votre table pour commander."}
        </p>
      </div>

      {activeTables.length === 0 ? (
        <p className="text-[#8a7561] text-center mt-8">Aucune table disponible — demandez à un serveur.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl w-full mx-auto">
          {activeTables.map((t) => {
            const open = hasOpenOrder(t.id);
            return (
              <button
                key={t.id}
                onClick={() => onStart(t.id)}
                className="tap-scale rounded-2xl border-2 border-[#3a2b1f] bg-[#211712] px-4 py-5 flex flex-col items-center gap-1"
              >
                <span className="display-font text-2xl font-bold">{tableDisplayName(t)}</span>
                <span className="text-xs font-bold" style={{ color: open ? "#E8B23D" : "#8a7561" }}>
                  {open ? "Compléter" : "Nouvelle commande"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
