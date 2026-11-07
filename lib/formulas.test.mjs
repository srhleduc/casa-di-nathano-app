// Tests de la logique des formules. Lancer : node lib/formulas.test.mjs
import {
  serviceSlotKey, ALL_SERVICE_SLOTS, currentServiceGroup, isFormulaAvailable,
  slotChoices, isFormulaOrderable, formulaCartLines, summarizeServiceSlots,
} from "./formulas.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

// 2026-11-09 = lundi, 2026-11-10 = mardi
const lundiMidi = new Date(2026, 10, 9, 12, 0);
const lundiSoir = new Date(2026, 10, 9, 19, 30);
const mardiMidi = new Date(2026, 10, 10, 12, 0);

ok(serviceSlotKey(1, "midi") === "1-midi", "clé lundi midi");
ok(ALL_SERVICE_SLOTS.length === 14, "14 services dans la semaine");
ok(currentServiceGroup(lundiMidi) === "midi", "12h = midi");
ok(currentServiceGroup(new Date(2026, 10, 9, 14, 59)) === "midi", "14h59 = midi");
ok(currentServiceGroup(new Date(2026, 10, 9, 15, 0)) === "soir", "15h = soir");

const f = {
  id: "f1", name: "Formule Casa", price: 20, active: true, dineIn: false, takeaway: true,
  restaurantIds: ["riec"], serviceSlots: ["1-soir", "2-midi"],
  slots: [],
};
ok(isFormulaAvailable(f, { restaurantId: "riec", isTakeaway: true, date: lundiSoir }), "dispo lundi soir à emporter à Riec");
ok(!isFormulaAvailable(f, { restaurantId: "riec", isTakeaway: true, date: lundiMidi }), "pas lundi midi");
ok(isFormulaAvailable(f, { restaurantId: "riec", isTakeaway: true, date: mardiMidi }), "dispo mardi midi");
ok(!isFormulaAvailable(f, { restaurantId: "riec", isTakeaway: false, date: lundiSoir }), "pas sur place si dineIn=false");
ok(!isFormulaAvailable(f, { restaurantId: "quimperle", isTakeaway: true, date: lundiSoir }), "pas dans un autre restaurant");
ok(isFormulaAvailable({ ...f, restaurantIds: [] }, { restaurantId: "quimperle", isTakeaway: true, date: lundiSoir }), "restaurantIds vide = tous");
ok(isFormulaAvailable(f, { restaurantId: null, isTakeaway: true, date: lundiSoir }), "sans restaurant on ne filtre pas");
ok(!isFormulaAvailable({ ...f, active: false }, { restaurantId: "riec", isTakeaway: true, date: lundiSoir }), "inactive = jamais");
ok(!isFormulaAvailable({ ...f, serviceSlots: [] }, { restaurantId: "riec", isTakeaway: true, date: lundiSoir }), "aucun service = jamais");
ok(!isFormulaAvailable(null, {}), "formule absente");

const menu = new Map([
  ["p1", { id: "p1", name: "Margherita", price: 13, cat: "pizza" }],
  ["p2", { id: "p2", name: "Parma", price: 15, cat: "pizza" }],
  ["d1", { id: "d1", name: "Tiramisu", price: 5.9, cat: "dessert" }],
]);
const slotPizza = { id: "main", label: "Pizza", items: [{ itemId: "p1", supplement: 0 }, { itemId: "p2", supplement: 2 }, { itemId: "gone", supplement: 0 }] };
ok(slotChoices(slotPizza, menu).length === 2, "produit supprimé du menu ignoré");
ok(slotChoices(slotPizza, menu, (i) => i.id !== "p2").length === 1, "isOrderable filtre");
ok(slotChoices(slotPizza, menu)[1].supplement === 2, "supplément conservé");
ok(slotChoices({ items: [{ itemId: "p1", supplement: -3 }] }, menu)[0].supplement === 0, "supplément négatif ramené à 0");

const formula = { name: "Formule Casa", price: 20, slots: [slotPizza, { id: "dessert", label: "Dessert", items: [{ itemId: "d1", supplement: 0 }] }] };
ok(isFormulaOrderable(formula, menu), "orderable");
ok(!isFormulaOrderable(formula, menu, (i) => i.cat !== "dessert"), "un emplacement vide bloque la formule");
ok(!isFormulaOrderable({ slots: [] }, menu), "formule sans emplacement non commandable");

const fmt = (n) => n.toFixed(2) + " €";
const lines = formulaCartLines(formula, [{ item: menu.get("p2"), supplement: 2 }, { item: menu.get("d1"), supplement: 0 }], fmt);
ok(lines[0].item.price === 22, "1er emplacement = prix formule + supplément");
ok(lines[0].note === "Formule Casa +2.00 €", "note 1er emplacement avec supplément");
ok(lines[1].item.price === 0 && lines[1].note === "Formule Casa (inclus)", "2e emplacement inclus");
const lines2 = formulaCartLines(formula, [{ item: menu.get("p1"), supplement: 0 }, { item: menu.get("d1"), supplement: 1.5 }], fmt);
ok(lines2[0].item.price === 20 && lines2[0].note === "Formule Casa", "pizza sans supplément = prix formule");
ok(lines2[1].item.price === 1.5, "supplément dessert");
ok(menu.get("p1").price === 13, "le menu n'est pas muté");
const total = lines.reduce((s, l) => s + l.item.price, 0);
ok(total === 22, "total formule + supplément pizza");

ok(summarizeServiceSlots([]) === "Aucun service", "résumé vide");
ok(summarizeServiceSlots(ALL_SERVICE_SLOTS) === "Tous les services", "résumé tous");
ok(summarizeServiceSlots(["1-midi", "1-soir", "2-midi"]) === "Lun · Mar midi", "résumé jours");

console.log(`${passed} OK, ${failed} échec(s)`);
if (failed) process.exit(1);
