# Casa Di Nathano — Cahier des charges : passage en vraie application

## Contexte

Ce document décrit un système de commande complet développé et testé sous forme d'artefact Claude (React, dans le navigateur, avec un stockage temporaire propre à Claude.ai). Il fonctionne bien mais doit être transformé en **vraie application web indépendante**, avec une vraie base de données, pour pouvoir être utilisée en production sans dépendre de Claude.ai.

**Fichier source à donner à Claude Code comme point de départ :** `borne-casa-di-nathano.jsx`

---

## 1. Vue d'ensemble

Le système a deux faces :

- **Borne cliente** : les clients (sur place ou à emporter) composent eux-mêmes leur commande sur une tablette, qui écrit directement dans le système.
- **Espace équipe** (protégé par code) : trois zones —
  - **En cuisine** : Four (pizzas), Finition (planches/salades/garniture après-cuisson), Boissons (soir de concert)
  - **En salle** : Prise de commande (téléphone), Service, Caisse, Commandes programmées
  - **Logistique service** : Créneaux du jour, Ruptures de stock, Stock desserts, Nouveau produit, Maintenance, Plan de table

Toutes les tablettes (borne + équipe) doivent voir les mêmes données en quasi temps réel.

---

## 2. Ce qui doit absolument changer pour la vraie application

### 2.1 Remplacer le stockage
Actuellement tout est stocké via `window.storage` (propre aux artefacts Claude, limité à 5 Mo par clé, texte/JSON uniquement, pas de vrais fichiers).

**Recommandation :** [Supabase](https://supabase.com) (base Postgres + temps réel + auth, gratuit pour ce volume) ou Firebase. Supabase a l'avantage d'un vrai SQL et d'un système de **realtime** natif (écoute des changements en direct), ce qui réglerait proprement les soucis de synchronisation qu'on a rencontrés avec le stockage actuel.

### 2.2 Vrai temps réel
Le système actuel n'a **aucune synchronisation automatique en arrière-plan** entre les tablettes (on l'a désactivée volontairement car le stockage d'artefact la faisait planter — les commandes disparaissaient). Chaque écran doit être rafraîchi manuellement.

**Avec Supabase Realtime (ou équivalent Firebase/WebSocket) :** ce problème disparaît naturellement — c'est fait pour ça, contrairement au stockage d'artefact. **Priorité n°1 de la vraie app.**

### 2.3 Vraies photos
Actuellement les photos produits sont soit un lien externe, soit une image compressée encodée en base64 (limité par la taille max de 5 Mo par clé). Avec un vrai backend, utiliser un vrai stockage de fichiers (Supabase Storage, S3, Cloudinary) et un vrai `<input type="file">` qui fonctionnera correctement (le blocage actuel du sélecteur de fichier vient du bac à sable de l'artefact, pas du code).

### 2.4 Authentification équipe
Le code à 4 chiffres actuel (0505) est très basique (codé en dur dans le fichier). Pour une vraie app, prévoir une vraie authentification (comptes par rôle, ou au moins un code stocké côté serveur et modifiable sans redéployer le code).

### 2.5 Remise à zéro quotidienne
Le système ne fait aucune distinction automatique entre les jours (sauf ce qu'on a ajouté manuellement : nettoyage manuel des vieilles commandes, filtrage des commandes programmées). Une vraie app devrait gérer une **vraie notion de "service du jour"** côté serveur (reset automatique des créneaux/stocks à minuit ou à l'ouverture, archivage automatique des commandes de la veille).

---

## 3. Modèle de données (tel qu'il existe aujourd'hui, à reproduire en base)

### `orders` (commandes)
```
id, items[], serviceType ("Sur place"/"À emporter"), name (nom/table),
slotAllocations[] ({slotId, label, qty}), pizzaCount, total,
status ("attente"|"preparation"|"prete"|"pret_service"|"servie"),
aperoStatus (null|"waiting"|"served_by_kitchen"|"released"),
scheduledFor (date ou null), scheduledTime (heure ou null), createdAt
```
Chaque `item` dans `items[]` : `{id, name, price, cat, qty, note, phase, modifiers[]}`
- `modifiers[]` = suppléments/sans rattachés à CET article précis (ex. une pizza avec ses modifications) — c'est ce qui permet l'affichage "un produit par ligne, modifications en dessous" sur tous les écrans.
- `phase` = "apero" | "main" | undefined — sert à distinguer les articles pris pendant la phase apéritif de ceux pris après, pour gérer la mise en attente des pizzas pendant l'apéro.

### `slots` (créneaux du jour)
```
id, label ("19h30"), capacity (nombre de pizzas max)
```

### `ruptures`
Liste d'ids d'articles du menu actuellement en rupture de stock.

### `dessertStock`
```
{ pannacotta: nb, tiramisu_cafe: nb, tiramisu_speculoos: nb, paris_palerme: nb }
```
Stock du jour décompté automatiquement au fil des commandes.

### `customMenuItems`
Produits ajoutés manuellement par l'équipe (nom, prix, catégorie, ingrédients, photo).

### `tablePlan`
```
{
  defaultLayout: { interieur: [tables], exterieur: [tables], mangedebout: [tables] },
  currentLayout: { même structure }
}
```
Chaque table : `{id, number, seats, x, y}` (x/y en pourcentage, pour le positionnement visuel glisser-déposer).

---

## 4. Logique métier importante à ne pas perdre dans la réécriture

1. **Répartition automatique sur plusieurs créneaux** : si une commande a plus de pizzas que la capacité d'un seul créneau, le système cherche la première suite de créneaux **consécutifs** (sans trou) qui suffit — jamais de créneau "sauté".
2. **Focaccia automatique** : commander une planche ajoute automatiquement une focaccia (0€) au panier, qui suit son propre circuit cuisine.
3. **Flux apéritif** : "Sur place" + apéro → menu restreint (boissons + antipasti) d'abord, focaccia visible en cuisine avec mention "attente apéro", pizzas normales bloquées jusqu'à ce que le pizzaiolo clique "Apéro servi" PUIS que la serveuse clique "Lancer les pizzas".
4. **Personnalisation pizza** : retirer un ingrédient (uniquement ceux réellement présents dans la recette) / ajouter un supplément — attaché à la ligne, pas des lignes séparées.
5. **Parfums** : glaces (1/2/3 boules) et sirops/diabolo demandent un choix de parfum obligatoire avant ajout au panier.
6. **Créneau simplifié pour "Sur place"** : pas d'écran de choix, créneau le plus proche auto-assigné, message "commande lancée dans les X prochaines minutes" (le vrai décompte de capacité continue de fonctionner derrière).
7. **Commandes programmées** : une commande avec `scheduledFor` dans le futur reste invisible partout sauf dans "Commandes à programmer", et bascule **automatiquement** dans les écrans normaux le jour J (comparaison de date, pas d'action manuelle).

---

## 5. Design / identité visuelle à conserver

- Thème "four à bois" : fond dégradé charbon/brun foncé (#1a120b → #120c07), accent rouge tomate (#C0392B), doré mozzarella (#E8B23D)
- Police display : **Fraunces** (serif, italique pour les accents) — police texte : **Manrope**
- Gros boutons tactiles, retour visuel marqué au clic (léger zoom + éclaircissement)
- Un seul produit par ligne dans les listes, modifications indentées en dessous avec "↳"

---

## 6. Étapes recommandées pour la mise en place avec Claude Code

1. Créer un compte Supabase (gratuit) → créer les tables ci-dessus
2. Donner ce document + le fichier `.jsx` à Claude Code comme contexte de démarrage
3. Demander à Claude Code de : convertir le projet en app Next.js (ou Vite + React), remplacer les fonctions `loadX`/`saveX` (actuellement `window.storage`) par de vrais appels Supabase, activer le Realtime sur les tables `orders`, `slots`, `ruptures`, `dessertStock`
4. Déployer sur Vercel (gratuit pour ce volume)
5. Tester sur les vraies tablettes du restaurant

---

*Document généré à partir des échanges de développement de la borne Casa Di Nathano.*
