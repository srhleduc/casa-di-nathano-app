// Logique pure des campagnes : écran proposé au client du click & collect juste
// avant qu'il passe sa commande (ex. vente de panettone pour Noël). Aucune
// I/O — les campagnes vivent en base (table `campaigns`, voir
// lib/data.js#useCampaigns) et s'éditent dans Direction → Campagnes.

const pad = (n) => String(n).padStart(2, "0");

// Date locale au format YYYY-MM-DD (et non toISOString, qui est en UTC et
// donnerait la veille entre minuit et 1h/2h du matin en France).
export function localDateISO(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// La campagne est-elle ouverte aujourd'hui, pour ce restaurant ? Les bornes
// de période sont incluses ; une borne vide = pas de limite de ce côté.
// `restaurantId` null (déploiement sans restaurant) → pas de filtre restaurant.
export function isCampaignActive(campaign, { restaurantId, date = new Date() } = {}) {
  if (!campaign || campaign.active === false) return false;
  const ids = campaign.restaurantIds || [];
  if (restaurantId && ids.length > 0 && !ids.includes(restaurantId)) return false;
  const today = localDateISO(date);
  if (campaign.startDate && today < campaign.startDate) return false;
  if (campaign.endDate && today > campaign.endDate) return false;
  return true;
}

// Campagnes à proposer MAINTENANT au client, dans l'ordre configuré :
//   - ouvertes aujourd'hui pour ce restaurant ;
//   - pas déjà vues pendant cette commande (`seenIds`) ;
//   - si elles ont un produit lié : le produit existe encore au menu, n'est
//     pas en rupture, n'est pas déjà dans le panier et ne crée pas de conflit
//     midi/soir (`isBlocked(item)`) — sinon le bouton « Je réserve » mènerait
//     nulle part.
// Les campagnes sans produit lié sont de simples annonces, toujours proposées.
export function campaignsToShow(
  campaigns,
  { restaurantId, date = new Date(), cart = [], menuById = new Map(), ruptures = [], seenIds = [], isBlocked = () => false } = {}
) {
  const seen = new Set(seenIds);
  return (campaigns || []).filter((c) => {
    if (seen.has(c.id)) return false;
    if (!isCampaignActive(c, { restaurantId, date })) return false;
    if (!c.menuItemId) return true;
    const item = menuById.get(c.menuItemId);
    if (!item) return false;
    if (ruptures.includes(item.id)) return false;
    if (cart.some((line) => line.id === item.id)) return false;
    if (isBlocked(item)) return false;
    return true;
  });
}

// Résumé lisible de la période, pour la liste admin.
export function describeCampaignPeriod(campaign) {
  const fmt = (iso) => {
    const [y, m, d] = String(iso).split("-");
    return `${d}/${m}/${y}`;
  };
  const { startDate, endDate } = campaign || {};
  if (startDate && endDate) return `Du ${fmt(startDate)} au ${fmt(endDate)}`;
  if (startDate) return `À partir du ${fmt(startDate)}`;
  if (endDate) return `Jusqu'au ${fmt(endDate)}`;
  return "Sans limite de dates";
}
