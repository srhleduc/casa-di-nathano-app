// Étapes de suivi d'une commande côté client (page /suivi et email).
// Statut cuisine : attente → preparation → prete / pret_service → servie.
// Statut livraison (indépendant) : a_livrer → en_route → livree.

const KITCHEN_STEP = { attente: 0, preparation: 1, prete: 2, pret_service: 2 };

export function trackingSteps(isDelivery) {
  return isDelivery
    ? ["Commande reçue", "En préparation", "Prête", "En route", "Livrée"]
    : ["Commande reçue", "En préparation", "Prête à retirer", "Retirée"];
}

// Renvoie { steps, current, cancelled } — `current` = index de l'étape en cours.
export function trackingProgress({ status, deliveryStatus }) {
  const isDelivery = Boolean(deliveryStatus);
  const steps = trackingSteps(isDelivery);
  if (deliveryStatus === "annulee") return { steps, current: 0, cancelled: true };
  let current = KITCHEN_STEP[status] ?? (status === "servie" ? 2 : 0);
  if (isDelivery) {
    if (deliveryStatus === "en_route") current = 3;
    else if (deliveryStatus === "livree") current = 4;
    else if (current > 2) current = 2;
  } else if (status === "servie") {
    current = 3;
  }
  return { steps, current, cancelled: false };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
