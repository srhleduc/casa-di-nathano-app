# Casa Di Nathano / Casa Di Luigi — Évolution : lien de commande à emporter par QR code

## Contexte

Le multi-restaurant est déjà en place (Casa Di Nathano à Riec-sur-Belon et Casa Di Luigi à Quimperlé, chacun cloisonné avec ses propres données, sa propre borne, son propre espace équipe).

On veut maintenant ajouter, pour **chaque restaurant**, une façon pour les clients de commander directement depuis leur téléphone, en scannant un QR code, **uniquement pour une commande à emporter**.

## Ce qui est demandé

Pour chaque restaurant, une **adresse dédiée à la commande à emporter** à distance, séparée de la borne physique habituelle :
- Ex. `[adresse-riec].vercel.app/commande`
- Ex. `[adresse-quimperle].vercel.app/commande`

Cette adresse doit :
- Afficher le même parcours client que la borne physique du restaurant correspondant (menu, panier, personnalisation des pizzas, choix des créneaux, etc.), **à une différence près : aucun choix "Sur place / À emporter" n'est proposé — la commande est automatiquement et uniquement "à emporter"**. L'étape de sélection du type de commande doit être entièrement retirée de ce parcours (pas juste pré-cochée, vraiment absente), et par conséquent tout ce qui est spécifique au "Sur place" (comme l'étape apéritif) ne doit pas non plus apparaître sur ce lien.
- **Ne jamais afficher ni rendre accessible le lien "Espace équipe"**, ni aucun autre moyen d'atteindre les écrans équipe (Four, Finition, Service, Caisse, Logistique) depuis cette adresse — même par manipulation de l'URL. Un client sur son téléphone ne doit avoir strictement aucun accès à l'espace équipe.
- Rester bien rattachée au bon restaurant : le lien de Riec ne doit permettre de commander qu'à Riec, celui de Quimperlé qu'à Quimperlé (cloisonnement déjà en place à réutiliser, pas à recréer).

## Contrainte technique

Pas de duplication de projet Vercel : réutiliser l'application existante, simplement via une route/adresse différente qui masque l'accès équipe et force le mode "à emporter". Une seule application à faire évoluer pour les deux usages (borne + lien à emporter).

## Coordonnées des restaurants

- **Casa Di Nathano** (Riec-sur-Belon) : 06 33 67 62 13
- **Casa Di Luigi** (Quimperlé) : 06 30 05 93 58

Ces numéros doivent être stockés comme donnée propre à chaque restaurant (pas codés en dur dans le texte), pour être réutilisables facilement — notamment dans le message affiché quand le click and collect est suspendu.

## Bouton d'arrêt d'urgence (côté Caisse)

Sur l'écran **Caisse** de l'espace équipe (pour chaque restaurant, indépendamment), ajouter un bouton bien visible permettant de **suspendre le click and collect à tout moment** (ex. "⏸️ Suspendre le click and collect" / "▶️ Réactiver").

- Quand c'est suspendu : le lien de commande à emporter (`/commande`) n'affiche plus le parcours de commande, mais un message clair du type *"La commande en ligne est temporairement indisponible, merci de nous appeler directement au [numéro du restaurant concerné, voir ci-dessus]"*.
- Ce réglage est propre à chaque restaurant (suspendre à Riec ne doit pas affecter Quimperlé, et inversement).
- La caissière doit pouvoir réactiver le service aussi facilement qu'elle l'a suspendu, en un seul geste.

## Une fois fait

Un QR code sera généré à partir de chaque lien (via un générateur de QR code en ligne classique, hors périmètre de ce développement), à afficher en caisse, sur les supports de communication du restaurant, etc.

---

*Document préparé pour être donné à Claude Code, en complément du code déjà en place (borne + espace équipe + multi-restaurant).*
