"use client";

import { useEffect, useMemo, useState } from "react";
import { cartSignature, withAutoFocaccia, computeSlotOptions, earliestSlotPlan, allUpcomingSlotsForStaff, lineUnitPrice, kitchenPendingQty, tableDisplayLabel, tableDisplayName, findOpenDineInOrderForTables, TAKEAWAY_SERVICE_TYPE, IMMEDIATE_TAKEAWAY_SERVICE_TYPE, TAKEAWAY_SLOT_MARGIN_MINUTES } from "@/lib/business";
import { FORMULE_PRICE, eur } from "@/lib/menu";
import { useOrders, useSlots, useRuptures, useDessertStock, usePizzaStock, useMenu, useTestMode, useServiceTypeSettings, useTables, useCategoryOrder, useReservations, useReservationTableAssignments, insertOrder, appendItemsToOrder, updateOrder, updateReservation, createWalkInReservationForTables, fetchOpenDineInOrderForTables } from "@/lib/data";
import { assignmentsByReservation, matchReservationForOrder, seatedReservationForTables } from "@/lib/reservation/order-link";
import { useRestaurant } from "@/lib/restaurant";

// "YYYY-MM-DDTHH:MM:00" heure murale locale — même repère que requested_at.
function nowWall() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

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
  { value: TAKEAWAY_SERVICE_TYPE, label: "À emporter", desc: "Le client repart avec sa commande" },
  { value: IMMEDIATE_TAKEAWAY_SERVICE_TYPE, label: "À emporter tout de suite", desc: "Client de passage — pas de créneau, ça part dès que possible" },
];

async function submitWithRetry(order, attempt = 1) {
  try {
    return await insertOrder(order);
  } catch (err) {
    // Une commande sur place vient d'être ouverte pour cette table au même
    // instant (/sat client, autre poste) → l'index d'unicité rejette la 2e.
    // On bascule en ajout à la commande existante plutôt que d'en créer une 2e.
    if (err?.code === "23505" && (order.tableIds || []).length && !order.isTest) {
      try {
        const fresh = await fetchOpenDineInOrderForTables(order.tableIds);
        if (fresh) {
          await appendItemsToOrder(fresh.id, {
            newItems: order.items,
            addedTotal: order.total,
            addedPizzaCount: order.pizzaCount,
            reopenKitchen: kitchenPendingQty(order.items) > 0,
            extraTableIds: order.tableIds,
          });
          return null;
        }
      } catch (mergeErr) {
        console.error("Fusion après conflit d'insertion échouée", mergeErr);
      }
    }
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 400));
      return submitWithRetry(order, attempt + 1);
    }
    console.error("Échec définitif de l'enregistrement de la commande", err);
    return null;
  }
}

export default function StaffOrderFlow({ initialTableIds = null, onConsumed = null } = {}) {
  // Lancé depuis le plan du board (« Prise de commande » sur une table) :
  // sur place, table pré-cochée, on saute l'écran type de service / apéro.
  const prefilled = Array.isArray(initialTableIds) && initialTableIds.length > 0;
  // La pré-sélection est lue une fois dans les états initiaux — on la vide côté
  // parent pour qu'un retour ultérieur sur cet onglet reparte propre.
  useEffect(() => {
    if (prefilled) onConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { orders } = useOrders();
  const { slots } = useSlots();
  const { ruptures } = useRuptures();
  const { dessertStock } = useDessertStock();
  const { pizzaStock } = usePizzaStock();
  const { menuItems } = useMenu();
  const { testMode } = useTestMode();
  const { serviceTypeSettings } = useServiceTypeSettings();
  const { categoryOrder } = useCategoryOrder();
  const { tables } = useTables();
  const { reservations } = useReservations();
  const { assignments: resaAssignments } = useReservationTableAssignments();
  const restaurant = useRestaurant();

  // Rapproche une commande sur place d'une réservation confirmée posée sur la
  // même table → la marque « arrivée » et la lie à la commande.
  function linkReservationSeated(resId) {
    if (!resId) return;
    const res = reservations.find((r) => r.id === resId);
    if (res && res.status === "confirmed") {
      updateReservation(resId, { status: "seated", arrivedAt: new Date().toISOString() }).catch((e) => console.error(e));
    }
  }

  // Table libre sur laquelle on prend une commande sans réservation préalable :
  // réservation « Passage » installée (seated) forcée sur la/les table(s) →
  // « occupée » (ou « groupée » à ≥2) sur le board, plus proposée jusqu'à
  // l'encaissement (boucle du board). Voir createWalkInReservationForTables.
  async function createWalkInReservation(tableIds) {
    try {
      return await createWalkInReservationForTables(tableIds, { tables });
    } catch (e) {
      console.error("Création de la réservation « Passage » échouée", e);
      return null;
    }
  }

  const tableNameCollator = useMemo(() => new Intl.Collator("fr", { numeric: true, sensitivity: "base" }), []);
  const activeTables = useMemo(
    () => tables.filter((t) => t.active).sort((a, b) => tableNameCollator.compare(tableDisplayName(a), tableDisplayName(b))),
    [tables, tableNameCollator]
  );

  const [screen, setScreen] = useState(prefilled ? "order" : "service"); // service | apero-ask | order | checkout | slot | done
  const [activeCat, setActiveCat] = useState(prefilled ? "pizza" : "boisson");
  const [cart, setCart] = useState([]);
  const [serviceType, setServiceType] = useState("🍽️ Sur place");
  const [tableName, setTableName] = useState(""); // nom du client — cas "à emporter"
  const [selectedTableIds, setSelectedTableIds] = useState(prefilled ? [...initialTableIds] : []); // sur place : tables cochées
  const [otherTableLabel, setOtherTableLabel] = useState(""); // sur place : table hors registre
  const [note, setNote] = useState("");
  const [customizing, setCustomizing] = useState(null);
  const [flavoring, setFlavoring] = useState(null);
  const [panuzzoOrdering, setPanuzzoOrdering] = useState(null);
  const [slotChoice, setSlotChoice] = useState(null);
  const [paidUpfront, setPaidUpfront] = useState(false); // client règle dès la prise de commande

  const [selectedOption, setSelectedOption] = useState(null);
  const [confirmedNumber, setConfirmedNumber] = useState(null);
  const [checkPizzaCount, setCheckPizzaCount] = useState(0); // vérif rapide de dispo avant de commander
  const [aperoMode, setAperoMode] = useState(false); // vrai pendant la sélection de l'apéro
  const [aperoUsed, setAperoUsed] = useState(false); // vrai si cette commande a démarré par un apéro

  const total = useMemo(() => cart.reduce((s, i) => s + lineUnitPrice(i) * i.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const pizzaCount = useMemo(() => cart.filter((i) => i.cat === "pizza").reduce((s, i) => s + i.qty, 0), [cart]);

  const SERVICE_ENABLED_BY_VALUE = {
    "🍽️ Sur place": serviceTypeSettings.dineInEnabled,
    [TAKEAWAY_SERVICE_TYPE]: serviceTypeSettings.takeawayEnabled,
    [IMMEDIATE_TAKEAWAY_SERVICE_TYPE]: serviceTypeSettings.takeawayEnabled,
  };
  const availableServiceOptions = STAFF_SERVICE_OPTIONS.filter((o) => SERVICE_ENABLED_BY_VALUE[o.value]);
  const availableServiceValues = availableServiceOptions.map((o) => o.value);

  function addItem(item, note) {
    const phase = aperoMode ? "apero" : aperoUsed ? "main" : undefined;
    setCart((prev) => {
      const sig = cartSignature(item.id, note, null) + "|" + (phase || "");
      // Une ligne déjà notée (note libre par produit) ne fusionne jamais un
      // nouvel ajout identique — sa note ne doit pas déteindre sur d'autres.
      const existing = prev.find((i) => !i.itemNote && cartSignature(i.id, i.note, i.modifiers) + "|" + (i.phase || "") === sig);
      let next = existing
        ? prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i))
        : [...prev, { ...item, qty: 1, note: note || null, itemNote: null, modifiers: [], phase }];
      return withAutoFocaccia(next, item, phase, menuItems);
    });
  }
  function addCustomizedPizza(pizzaItem, removedItems, addedItems, itemNote) {
    const phase = aperoMode ? "apero" : aperoUsed ? "main" : undefined;
    const modifiers = [
      ...removedItems.map((i) => ({ name: i.name, price: i.price })),
      ...addedItems.map((i) => ({ name: i.name, price: i.price })),
    ];
    setCart((prev) => {
      const sig = cartSignature(pizzaItem.id, null, modifiers) + "|" + (phase || "");
      const existing = prev.find((i) => !i.itemNote && !itemNote && cartSignature(i.id, i.note, i.modifiers) + "|" + (i.phase || "") === sig);
      if (existing) return prev.map((i) => (i === existing ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...pizzaItem, qty: 1, note: null, itemNote: itemNote || null, modifiers, phase }];
    });
    setCustomizing(null);
  }
  function addFormule(sandwich, drinkItem, drinkSupplement, dessertItem, dessertSupplement) {
    addItem({ ...sandwich, price: FORMULE_PRICE }, "Formule");
    addItem({ ...drinkItem, price: drinkSupplement }, drinkSupplement > 0 ? `Formule +${eur(drinkSupplement)}` : "Formule (incluse)");
    addItem({ ...dessertItem, price: dessertSupplement }, dessertSupplement > 0 ? `Formule +${eur(dessertSupplement)}` : "Formule (inclus)");
    setPanuzzoOrdering(null);
  }
  function changeQty(id, note, modifiers, delta, itemNote) {
    const sig = cartSignature(id, note, modifiers) + "|" + (itemNote || "");
    setCart((prev) => prev.map((i) => (cartSignature(i.id, i.note, i.modifiers) + "|" + (i.itemNote || "") === sig ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0));
  }
  function updateItemNote(index, value) {
    setCart((prev) => prev.map((i, idx) => (idx === index ? { ...i, itemNote: value } : i)));
  }
  function toggleTableId(id) {
    setSelectedTableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function resetAll() {
    setCart([]);
    setTableName("");
    setSelectedTableIds([]);
    setOtherTableLabel("");
    setNote("");
    setServiceType("🍽️ Sur place");
    setActiveCat("boisson");
    setSlotChoice(null);
    setSelectedOption(null);
    setPaidUpfront(false);
    setAperoMode(false);
    setAperoUsed(false);
    setPanuzzoOrdering(null);
    setConfirmedNumber(null);
    setScreen("service");
  }

  function submitOrder(finalPlan, forced) {
    const isDineIn = serviceType === "🍽️ Sur place";
    const items = cart.map(({ id, name, price, cat, qty, note, itemNote, phase, modifiers }) => ({
      id, name, price, cat, qty, note, itemNote: (itemNote || "").trim() || null, phase, modifiers,
    }));

    // Sur place : si une commande est déjà ouverte pour l'une des tables cochées
    // (ou le libellé libre), on y AJOUTE les articles au lieu d'en créer une
    // concurrente — même chemin atomique (sat_append_items) que le lien /sat.
    // Jamais en mode test (on ne veut pas greffer des lignes test sur une vraie
    // commande, ni l'inverse).
    // Réservation confirmée posée sur l'une des tables cochées, ou occupation
    // déjà créée à la main sur le board (« Marquer occupée » / « Combiner »).
    const asgByRes = assignmentsByReservation(resaAssignments);
    const matchedResId =
      isDineIn && !testMode.enabled && selectedTableIds.length
        ? matchReservationForOrder({ tableIds: selectedTableIds }, reservations, asgByRes, nowWall()) ||
          seatedReservationForTables({ tableIds: selectedTableIds }, reservations, asgByRes, nowWall())
        : null;

    // Table réelle occupée sans réservation ni occupation préalable → on crée
    // une réservation « Passage » pour l'occuper (1 table = "occupée",
    // plusieurs = combinaison auto). Pas en libellé libre (pas de table registre).
    const needsWalkIn = isDineIn && !testMode.enabled && selectedTableIds.length > 0 && !matchedResId;

    const existing =
      isDineIn && !testMode.enabled
        ? findOpenDineInOrderForTables(orders, { tableIds: selectedTableIds, tableLabel: otherTableLabel })
        : null;
    if (existing) {
      setScreen("done");
      setConfirmedNumber(null);
      appendItemsToOrder(existing.id, {
        newItems: items,
        addedTotal: total,
        addedPizzaCount: pizzaCount,
        reopenKitchen: kitchenPendingQty(items) > 0,
        extraTableIds: selectedTableIds,
      }).catch((err) => console.error("Échec de l'ajout à la commande ouverte", err));
      if (matchedResId && !existing.reservationId) {
        updateOrder(existing.id, { reservationId: matchedResId }).catch((e) => console.error(e));
      }
      linkReservationSeated(matchedResId);
      if (needsWalkIn && !existing.reservationId) {
        createWalkInReservation(selectedTableIds).then((rid) => {
          if (rid) updateOrder(existing.id, { reservationId: rid }).catch((e) => console.error(e));
        });
      }
      return;
    }

    const hasMainPizza = cart.some((i) => i.cat === "pizza" && i.phase === "main");
    // Une planche (et sa focaccia auto-ajoutée) doit passer par le circuit
    // "apéro à préparer" du four même si aucune pizza principale n'a encore
    // été choisie (table qui commande l'apéro d'abord, les pizzas ensuite) —
    // sinon ces articles ne sont ni dans la file normale (phase "apero" les
    // en exclut) ni dans la file d'attente apéro (aperoStatus resterait null).
    const hasAperoKitchenItems = cart.some(
      (i) => i.phase === "apero" && (i.cat === "pizza" || i.cat === "panuzzo" || i.cat === "supplement" || i.cat === "sans")
    );
    const newOrder = {
      items,
      serviceType,
      name: isDineIn
        ? tableDisplayLabel({ tableIds: selectedTableIds, tableLabel: otherTableLabel }, tables)
        : tableName || "Commande équipe",
      // trié : clé stable pour l'index d'unicité orders_one_open_dinein_tables.
      tableIds: isDineIn ? [...selectedTableIds].sort() : [],
      tableLabel: isDineIn ? otherTableLabel.trim() || null : null,
      reservationId: matchedResId || null,
      note: note.trim() || null,
      slotAllocations: finalPlan || [],
      slotForced: !!forced,
      pizzaCount,
      total,
      status: "attente",
      paid: paidUpfront,
      aperoStatus: aperoUsed && (hasMainPizza || hasAperoKitchenItems) ? "waiting" : null,
      isTest: testMode.enabled,
    };
    setScreen("done");
    if (needsWalkIn) {
      createWalkInReservation(selectedTableIds).then((rid) => {
        submitWithRetry({ ...newOrder, reservationId: rid || null }).then(setConfirmedNumber);
      });
    } else {
      submitWithRetry(newOrder).then(setConfirmedNumber);
      linkReservationSeated(matchedResId);
    }
  }

  function goToSlot() {
    // Le pizzaiolo peut désactiver le décompte des créneaux pour le sur place
    // (voir SlotsAdmin) — dans ce cas la pizza part comme un client de passage,
    // sans créneau réservé, mais décompte quand même le stock de pâtons.
    const dineInSkipsSlot = serviceType === "🍽️ Sur place" && serviceTypeSettings.dineInCountsTowardSlots === false;
    if (pizzaCount === 0 || serviceType === IMMEDIATE_TAKEAWAY_SERVICE_TYPE || dineInSkipsSlot) {
      // Client de passage : aucun créneau, ni choisi ni réservé — la pizza
      // part dès que le four a la place, sans décompter les créneaux du jour.
      submitOrder(null);
      return;
    }
    if (serviceType !== TAKEAWAY_SERVICE_TYPE) {
      // Sur place : le client est déjà à table, inutile de lui communiquer
      // un horaire — on réserve directement le créneau le plus proche.
      const choice = computeSlotOptions(orders, slots, pizzaCount);
      submitOrder(earliestSlotPlan(choice, pizzaCount));
      return;
    }
    setSelectedOption(null);
    setSlotChoice(computeSlotOptions(orders, slots, pizzaCount, TAKEAWAY_SLOT_MARGIN_MINUTES));
    setScreen("slot");
  }

  const checkSlotChoice = checkPizzaCount > 0 ? computeSlotOptions(orders, slots, checkPizzaCount, TAKEAWAY_SLOT_MARGIN_MINUTES) : null;

  const availabilityBanner =
    serviceType === "🥡 À emporter" ? (
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
              checkSlotChoice.plans[0] &&
              `🕐 Créneau le plus proche : ${checkSlotChoice.plans[0][checkSlotChoice.plans[0].length - 1].label}`}
          </span>
        )}
      </div>
    ) : null;

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {testMode.enabled && (
        <div className="px-6 py-3 text-center text-sm font-bold shrink-0" style={{ background: "#f0c860", color: "#1a120b" }}>
          🧪 MODE TEST ACTIF — cette commande ne sera pas comptabilisée dans le chiffre du jour et sera supprimée à la désactivation
        </div>
      )}
      {screen === "service" && (
        <ServiceTypeScreen
          options={availableServiceOptions}
          onSelect={(type) => {
            setServiceType(type);
            if (type !== "🍽️ Sur place") {
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
          categoryOrder={categoryOrder.staff}
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
          topBanner={availabilityBanner}
          staffMode
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
          tables={activeTables}
          selectedTableIds={selectedTableIds}
          toggleTableId={toggleTableId}
          otherTableLabel={otherTableLabel}
          setOtherTableLabel={setOtherTableLabel}
          note={note}
          setNote={setNote}
          setItemNote={updateItemNote}
          paidUpfront={paidUpfront}
          setPaidUpfront={setPaidUpfront}
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
          staffForceOptions={allUpcomingSlotsForStaff(orders, slots, pizzaCount)}
          onBack={() => setScreen("checkout")}
          onConfirm={(forced) => submitOrder(selectedOption?.plan || null, forced)}
        />
      )}

      {screen === "done" && (
        <StatusScreen title="Commande enregistrée !" subtitle="Elle est partie en cuisine." success onDone={resetAll} bigNumber={confirmedNumber} />
      )}

      {customizing && (
        <PizzaCustomizeModal pizza={customizing} menu={menuItems} staffMode onClose={() => setCustomizing(null)} onConfirm={(r, a, n) => addCustomizedPizza(customizing, r, a, n)} />
      )}
      {flavoring && (
        <FlavorModal
          item={flavoring}
          ruptures={ruptures}
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
          staffMode
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
