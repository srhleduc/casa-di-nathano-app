# Cahier des charges technique — Module Approvisionnement, Phase 1
## Application Casa di Nathano (borne-casa-di-nathano.jsx)

## 0. Contexte et périmètre

Ce document décrit l'implémentation de la **Phase 1** du module d'approvisionnement intelligent défini dans le cahier des charges métier ("Cahier_des_Charges_Approvisionnement_La_Casa"). Il est destiné à une session Claude Code.

**Phase 1 = fondation** : fournisseurs, produits, mouvements de stock. Pas d'IA, pas d'import de factures, pas de recettes liées aux ventes. Ces éléments viendront dans les phases suivantes, une fois cette base validée en conditions réelles.

**⚠️ Scope strict** : cette phase ajoute une nouvelle section dans l'espace équipe protégé par PIN (0505), aux côtés des vues existantes (cuisine, finition, service, logistique). Elle ne modifie :
- ni la logique métier existante (commandes clients, créneaux, apéro, etc.)
- ni les écrans client (borne de commande)
- ni les tables Supabase existantes

Toute nouvelle table doit être préfixée `appro_` pour éviter toute collision avec le schéma existant.

---

## 1. Nouvelles tables Supabase

### 1.1 `appro_suppliers` (fournisseurs)

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| name | text | not null |
| contact_name | text | nullable |
| phone | text | nullable |
| email | text | nullable |
| delivery_day | text | nullable — ex: "mardi", "jeudi" |
| notes | text | nullable |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |

### 1.2 `appro_products` (produits/consommables achetés)

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| name | text | not null — nom interne, ex: "Mozzarella Fior di Latte" |
| unit | text | not null — ex: "kg", "L", "pièce", "carton" |
| primary_supplier_id | uuid | FK → appro_suppliers.id, nullable |
| current_stock | numeric | default 0 — stock théorique, **jamais modifié directement, uniquement recalculé via les mouvements** |
| alert_threshold | numeric | nullable — seuil sous lequel le produit apparaît "à commander" |
| is_active | boolean | default true |
| created_at | timestamptz | default now() |

### 1.3 `appro_stock_movements` (journal des mouvements)

Table centrale — **toute variation de stock passe obligatoirement par une ligne ici**, jamais par une mise à jour directe de `current_stock`.

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| product_id | uuid | FK → appro_products.id, not null |
| movement_type | text | not null — enum applicatif : `achat`, `vente`, `perte`, `correction`, `retour` |
| quantity | numeric | not null — positif pour entrée, négatif pour sortie |
| reason | text | nullable — utile pour `perte` / `correction` |
| created_by | text | nullable — qui a saisi le mouvement (prénom, pas d'auth complexe en Phase 1) |
| created_at | timestamptz | default now() |

**Logique** : `current_stock` sur `appro_products` est recalculé (trigger Postgres ou recalcul côté client à l'insertion) comme la somme de tous les `quantity` de `appro_stock_movements` pour ce produit. Un trigger SQL `AFTER INSERT` est recommandé pour garantir la cohérence même en cas d'accès multi-appareils simultané.

---

## 2. Écran "Approvisionnement" (espace équipe)

Nouvel onglet dans l'espace PIN, entre "Logistique" et les autres vues existantes.

### 2.1 Vue principale — Liste des produits

- Tableau/liste des produits actifs avec : nom, stock actuel, unité, fournisseur principal
- Ligne mise en évidence (couleur ember) si `current_stock <= alert_threshold`
- Filtre rapide par fournisseur
- Bouton "+" pour ajouter un mouvement rapide sur un produit (réception, perte, correction)

### 2.2 Formulaire mouvement rapide

Modal simple : sélection du produit (si pas déjà pré-sélectionné), type de mouvement, quantité, motif optionnel. Validation → insertion dans `appro_stock_movements` → recalcul stock affiché en temps réel (Supabase realtime, comme le reste de l'app).

### 2.3 Gestion fournisseurs et produits

Deux écrans simples de type CRUD (liste + formulaire ajout/édition) :
- Fournisseurs : nom, contact, téléphone, jour de livraison
- Produits : nom, unité, fournisseur principal, seuil d'alerte

Pas besoin de design élaboré ici — cohérence visuelle avec le reste de l'espace équipe (palette charbon/ember déjà en place) suffit.

---

## 3. Données initiales — fournisseurs à pré-charger

Liste des fournisseurs récurrents fournie par Sarah, à insérer dans `appro_suppliers` à la création de la table (seed SQL) :

- France Boissons
- Grain du Ponant
- Danioli
- Sysco
- Arno and Co
- Ferme des Mille Loches
- Carniato
- Episaveurs
- Terreazur

Seuls le nom est renseigné pour l'instant (`is_active = true`). Contact, téléphone et jour de livraison pourront être complétés ensuite via l'écran de gestion des fournisseurs (2.3).

---

## 4. Ordre d'implémentation suggéré pour Claude Code

1. Migration SQL : création des 3 tables + trigger de recalcul de stock
2. Écran liste produits (lecture seule d'abord, avec indicateur de rupture)
3. Formulaire mouvement rapide (réception/perte/correction)
4. Écrans CRUD fournisseurs et produits
5. Test en conditions réelles avec quelques produits pilotes (ex: mozzarella, farine, jambon)

---

## 5. Ce qui n'est PAS dans cette phase

- Import/lecture automatique de factures (Phase 2)
- Recettes et décrémentation automatique via les ventes (Phase 3-4)
- Prévisions et recommandations de commande (Phase 5-6)
- Alias produits fournisseur ↔ produit interne

Ces éléments restent définis dans le cahier des charges métier d'origine et seront traités dans des sessions ultérieures, une fois cette base validée par Nathan en usage réel.
