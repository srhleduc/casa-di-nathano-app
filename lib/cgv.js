// Conditions générales de vente affichées au client avant la validation d'une
// commande en ligne (click & collect, /commande). Le texte EXACT ci-dessous est
// celui montré dans la modale ET celui copié intégralement dans
// order_commitments.cgv_text_snapshot au moment de l'acceptation — pour garder
// une preuve de ce que le client a réellement vu, indépendamment des versions
// futures.
//
// ⚠️ PLACEHOLDER — à faire relire juridiquement et remplacer par le vrai texte.
// La clause sur les commandes non retirées ("reste due") est le minimum
// fonctionnel demandé ; le reste est indicatif et volontairement court.
//
// Quand tu modifies le texte : incrémente CGV_VERSION (les anciennes commandes
// gardent leur snapshot, la nouvelle version s'applique aux suivantes).

export const CGV_VERSION = "2026-08-29";

// Phrase-clé sur le non-retrait, réutilisée telle quelle dans la case à cocher
// du checkout et mise en avant dans la modale.
export const CGV_NO_SHOW_CLAUSE =
  "Toute commande préparée et non retirée sur le créneau choisi reste intégralement due. Elle ne peut être ni annulée, ni remboursée, ni reportée.";

export const CGV_TEXT = `Conditions générales de vente — commande en ligne (retrait sur place)

Dernière mise à jour : ${CGV_VERSION}

1. Objet
Les présentes conditions régissent les commandes passées via le service de commande en ligne du restaurant, pour un retrait sur place ("click and collect"). Passer une commande implique l'acceptation pleine et entière des présentes conditions.

2. Commande
La commande est ferme dès sa validation. Un numéro de téléphone valide est demandé pour permettre au restaurant de joindre le client au sujet de sa commande. Ce numéro est utilisé uniquement pour la gestion de la commande ; il ne fait l'objet d'aucune prospection commerciale.

3. Créneau de retrait
Le client choisit un créneau de retrait lors de la commande. La préparation est lancée en fonction de ce créneau. Le client s'engage à se présenter sur place pendant le créneau choisi pour retirer et régler sa commande.

4. Prix et paiement
Les prix sont indiqués en euros, toutes taxes comprises. Le règlement s'effectue sur place, en caisse, au moment du retrait.

5. Commandes non retirées
${CGV_NO_SHOW_CLAUSE}
Le restaurant pourra réclamer le paiement de toute commande préparée et non retirée. En cas de retards ou d'absences répétés, le restaurant se réserve le droit de refuser toute nouvelle commande en ligne du même client.

6. Annulation
Toute demande de modification ou d'annulation doit être faite au plus tôt, par téléphone, et avant le lancement de la préparation. Passé ce délai, la commande est due.

7. Données personnelles
Le numéro de téléphone et les informations de commande sont conservés pour la gestion des commandes et le suivi des retraits. Le client peut demander l'accès à ses données ou leur suppression en s'adressant directement au restaurant.

8. Droit applicable
Les présentes conditions sont soumises au droit français. À défaut de résolution amiable, les tribunaux français sont compétents.
`;
