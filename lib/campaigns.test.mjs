// Tests de la logique des campagnes. Lancer : node lib/campaigns.test.mjs
import { localDateISO, isCampaignActive, campaignsToShow, campaignItems, describeCampaignPeriod } from "./campaigns.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

const jeudi = new Date(2026, 10, 12, 14, 0); // 12 nov. 2026
const base = { id: "c1", active: true, restaurantIds: [], startDate: null, endDate: null, menuItemIds: [] };

ok(localDateISO(jeudi) === "2026-11-12", "date locale formatée");
ok(localDateISO(new Date(2026, 0, 5, 0, 30)) === "2026-01-05", "00h30 reste le même jour (pas de décalage UTC)");

// Activation, restaurants, période
ok(isCampaignActive(base, { date: jeudi }), "campagne active sans limite");
ok(!isCampaignActive({ ...base, active: false }, { date: jeudi }), "campagne désactivée");
ok(!isCampaignActive(null, { date: jeudi }), "campagne absente");
ok(isCampaignActive({ ...base, restaurantIds: ["a"] }, { restaurantId: "a", date: jeudi }), "restaurant concerné");
ok(!isCampaignActive({ ...base, restaurantIds: ["a"] }, { restaurantId: "b", date: jeudi }), "autre restaurant exclu");
ok(isCampaignActive({ ...base, restaurantIds: ["a"] }, { restaurantId: null, date: jeudi }), "pas de restaurant déployé : pas de filtre");
ok(isCampaignActive({ ...base, startDate: "2026-11-12" }, { date: jeudi }), "début inclus");
ok(!isCampaignActive({ ...base, startDate: "2026-11-13" }, { date: jeudi }), "pas encore commencée");
ok(isCampaignActive({ ...base, endDate: "2026-11-12" }, { date: jeudi }), "fin incluse");
ok(!isCampaignActive({ ...base, endDate: "2026-11-11" }, { date: jeudi }), "déjà terminée");
ok(isCampaignActive({ ...base, startDate: "2026-11-01", endDate: "2026-12-24" }, { date: jeudi }), "dans la période");

// Sélection côté client
const pane = { id: "panettone", name: "Panettone", price: 18 };
const menuById = new Map([[pane.id, pane]]);
const withItem = { ...base, id: "noel", menuItemIds: ["panettone"] };
const show = (campaigns, extra = {}) => campaignsToShow(campaigns, { date: jeudi, menuById, ...extra }).map((c) => c.id);

ok(show([withItem]).join() === "noel", "campagne avec produit proposée");
ok(show([base]).join() === "c1", "annonce sans produit toujours proposée");
ok(show([withItem], { seenIds: ["noel"] }).length === 0, "déjà vue : pas reproposée");
ok(show([withItem], { ruptures: ["panettone"] }).length === 0, "produit en rupture : pas proposée");
ok(show([withItem], { cart: [{ id: "panettone", qty: 1 }] }).length === 0, "produit déjà au panier : pas proposée");
ok(show([{ ...withItem, menuItemIds: ["inconnu"] }]).length === 0, "produit supprimé du menu : pas proposée");
ok(show([withItem], { isBlocked: () => true }).length === 0, "conflit midi/soir : pas proposée");
ok(show([{ ...withItem, active: false }]).length === 0, "campagne désactivée : pas proposée");
ok(show([withItem, { ...base, id: "autre" }]).join() === "noel,autre", "ordre conservé");

// Plusieurs produits
const choco = { id: "choco", name: "Panettone chocolat", price: 20 };
const menu2 = new Map([[pane.id, pane], [choco.id, choco]]);
const multi = { ...base, id: "multi", menuItemIds: ["panettone", "choco", "inconnu", "panettone"] };
const ctx = { menuById: menu2 };
ok(campaignItems(multi, ctx).map((i) => i.id).join() === "panettone,choco", "plusieurs produits, inconnu et doublon ignorés");
ok(campaignItems(multi, { ...ctx, ruptures: ["panettone"] }).map((i) => i.id).join() === "choco", "un produit en rupture écarté");
ok(campaignItems(multi, { ...ctx, cart: [{ id: "choco", qty: 1 }] }).map((i) => i.id).join() === "panettone", "un produit déjà au panier écarté");
ok(campaignItems(multi, { ...ctx, isBlocked: (i) => i.id === "choco" }).map((i) => i.id).join() === "panettone", "un produit en conflit midi/soir écarté");
ok(campaignsToShow([multi], { date: jeudi, ...ctx, ruptures: ["panettone"] }).length === 1, "proposée tant qu'un produit reste");
ok(campaignsToShow([multi], { date: jeudi, ...ctx, ruptures: ["panettone", "choco"] }).length === 0, "plus aucun produit : pas proposée");
ok(campaignItems({ ...base }, ctx).length === 0, "annonce : aucun produit");
ok(campaignItems(undefined, ctx).length === 0, "campagne absente : aucun produit");

// Libellé de période
ok(describeCampaignPeriod(base) === "Sans limite de dates", "période libre");
ok(describeCampaignPeriod({ startDate: "2026-11-12", endDate: "2026-12-24" }) === "Du 12/11/2026 au 24/12/2026", "période complète");
ok(describeCampaignPeriod({ endDate: "2026-12-24" }) === "Jusqu'au 24/12/2026", "fin seule");
ok(describeCampaignPeriod({ startDate: "2026-11-12" }) === "À partir du 12/11/2026", "début seul");

if (failed > 0) {
  console.error(`campaigns: ${failed} échec(s), ${passed} ok`);
  process.exit(1);
}
console.log(`campaigns: ${passed} tests ok`);
