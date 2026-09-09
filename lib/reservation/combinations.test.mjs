// Tests des combinaisons de tables. Lancer : node lib/reservation/combinations.test.mjs
import { suggestCombinations, validateCombination } from "./combinations.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

// tables : { id, active, capacityBase, combinableWith, usuallyCombinedWith, nonCombinableWith }
const mk = (id, combinableWith = [], extra = {}) => ({ id, active: true, capacityBase: 2, combinableWith, usuallyCombinedWith: [], nonCombinableWith: [], ...extra });
const has = (list, ids) => list.some((c) => c.tableIds.join("|") === [...ids].sort().join("|"));

// --- chaîne connectée : T1-T2 et T2-T3 suffisent pour T1+T2+T3 ---
{
  const tables = [mk("T1", ["T2"]), mk("T2", ["T1", "T3"]), mk("T3", ["T2"])];
  const s = suggestCombinations(tables, []);
  ok(has(s, ["T1", "T2"]) && has(s, ["T2", "T3"]), "paires directes proposées");
  ok(has(s, ["T1", "T2", "T3"]), "T1+T2+T3 proposé via la chaîne (sans T1↔T3 déclaré)");
  ok(validateCombination(["T1", "T2", "T3"], tables).ok, "validation OK pour la chaîne");
}

// --- relation à sens unique suffit ---
{
  const tables = [mk("T1", ["T2"]), mk("T2", [])];
  ok(has(suggestCombinations(tables, []), ["T1", "T2"]), "arête à sens unique (T1→T2) → paire combinable");
  ok(validateCombination(["T1", "T2"], tables).ok, "validation OK relation à sens unique");
}

// --- groupe non connecté : refusé ---
{
  const tables = [mk("T1", ["T2"]), mk("T2", ["T1"]), mk("T3", [])];
  ok(!has(suggestCombinations(tables, []), ["T1", "T2", "T3"]), "T3 isolée → T1+T2+T3 non proposé");
  const v = validateCombination(["T1", "T2", "T3"], tables);
  ok(!v.ok && /chaîne/.test(v.reason), "validation refuse un groupe non connecté");
}

// --- non_combinable_with bloque la paire, même via la chaîne ---
{
  const tables = [mk("T1", ["T2"], { nonCombinableWith: ["T3"] }), mk("T2", ["T1", "T3"]), mk("T3", ["T2"])];
  ok(!has(suggestCombinations(tables, []), ["T1", "T2", "T3"]), "T1 ✕ T3 → T1+T2+T3 non proposé malgré la chaîne");
  const v = validateCombination(["T1", "T2", "T3"], tables);
  ok(!v.ok && /jamais combin/.test(v.reason), "validation refuse : paire interdite dans le groupe");
  ok(validateCombination(["T2", "T3"], tables).ok, "T2+T3 reste valide");
}

// --- < 2 tables ---
{
  const v = validateCombination(["T1"], [mk("T1", [])]);
  ok(!v.ok && /2 tables/.test(v.reason), "moins de 2 tables → refusé");
}

// --- combinaison déjà enregistrée exclue des propositions ---
{
  const tables = [mk("T1", ["T2"]), mk("T2", ["T1"])];
  const s = suggestCombinations(tables, [{ tableIds: ["T1", "T2"] }]);
  ok(!has(s, ["T1", "T2"]), "paire déjà enregistrée → non re-proposée");
}

// --- isUsual : usually_combined_with sur toutes les paires ---
{
  const tables = [
    mk("A", ["B"], { usuallyCombinedWith: ["B"] }),
    mk("B", ["A"], { usuallyCombinedWith: ["A"] }),
  ];
  const s = suggestCombinations(tables, []);
  const c = s.find((x) => x.tableIds.join("|") === "A|B");
  ok(c && c.isUsual === true && c.penaltyScore === 0, "paire habituelle → isUsual, pénalité 0");

  const tables2 = [mk("A", ["B"]), mk("B", ["A"])];
  const c2 = suggestCombinations(tables2, []).find((x) => x.tableIds.join("|") === "A|B");
  ok(c2 && c2.isUsual === false && c2.penaltyScore === 10, "paire seulement rapprochable → exceptionnelle, pénalité 10");
}

console.log(`\ncombinations: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
