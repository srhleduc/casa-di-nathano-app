# Casa Di Nathano / Casa Di Luigi — Évolution : gestion de deux restaurants séparés

## Contexte

L'application actuelle (déployée sur Vercel + Supabase) ne gère qu'un seul restaurant : **"Casa Di Nathano"**, à Riec-sur-Belon (celui déjà construit et fonctionnel).

On veut maintenant qu'elle gère un **second établissement, sous une enseigne différente** : **"Casa Di Luigi"**, à Quimperlé.

⚠️ Point important : ce ne sont **pas deux succursales de la même enseigne**, mais deux enseignes distinctes, avec chacune son propre nom affiché aux clients. Le nom du restaurant ("Casa Di Nathano" vs "Casa Di Luigi") doit donc être une donnée propre à chaque établissement, pas une valeur codée en dur quelque part dans l'application — pareil pour tout élément d'identité visuelle qu'on voudrait différencier plus tard (couleurs, logo, etc., si besoin un jour).

## Principe général

Une seule application, une seule base de données, mais **chaque donnée est rattachée à un restaurant précis**, et l'accès est cloisonné selon qui se connecte.

## 1. Modèle de données

Ajouter un champ `restaurant_id` (ou `restaurant_slug`, ex. `"riec"` / `"quimperle"`) sur **toutes** les tables concernées :
- `orders`
- `slots` (créneaux)
- `ruptures`
- `dessert_stock`
- `custom_menu_items`
- `table_plan`
- tout autre réglage propre à un établissement (code équipe, etc.)

Chaque ligne de chaque table doit savoir à quel restaurant elle appartient.

Prévoir aussi une petite table `restaurants` avec, pour chacun : son identifiant, son **nom affiché** ("Casa Di Nathano" / "Casa Di Luigi"), sa ville, et éventuellement d'autres réglages propres (couleur d'accent, etc.) — pour que rien ne soit codé en dur et que l'app affiche le bon nom au bon endroit automatiquement.

## 2. Trois types d'accès, trois niveaux de cloisonnement

### A. Bornes clientes (une par restaurant)
- Deux adresses/URLs distinctes, par exemple :
  - `casa-di-nathano-riec.vercel.app` (Casa Di Nathano, Riec-sur-Belon — l'existant)
  - `casa-di-luigi-quimperle.vercel.app` (Casa Di Luigi, Quimperlé — le nouveau)
- Chaque borne est **verrouillée** sur son restaurant : impossible d'accéder aux données de l'autre établissement, même en modifiant l'URL à la main. Un client de Quimperlé ne doit jamais pouvoir voir/commander sur Riec, et inversement.
- Chaque borne affiche le bon nom d'enseigne à l'écran d'accueil et partout où le nom apparaît.

### B. Espace équipe (un code par restaurant)
- Le code équipe (PIN) actuel de Riec ne débloque que Four/Finition/Service/Caisse/Logistique de **Casa Di Nathano (Riec)**.
- Un code équipe séparé pour Quimperlé, qui ne débloque que les données de **Casa Di Luigi (Quimperlé)**.
- Aucun croisement possible entre les deux, même avec le bon code d'un des deux restaurants.

### C. Espace Direction (nouveau — pour le patron, vous deux)
- Un accès séparé des deux précédents, réservé aux gérants.
- **Sécurité renforcée recommandée** : identifiant + mot de passe personnel plutôt qu'un simple code à 4 chiffres, car cet espace donne accès à des données sensibles (chiffre d'affaires) — utiliser un vrai système de comptes (Supabase Auth, par exemple), pas juste un code stocké en dur.
- Contenu de cet espace :
  - Vue comparative des deux enseignes (chiffre d'affaires du jour, nombre de commandes, éventuellement historique), clairement identifiées par leur nom
  - Possibilité de consulter en détail les données de l'un OU l'autre restaurant (comme s'il était dans l'espace équipe correspondant), en lecture, sans se substituer aux équipes sur place.

## 3. Sécurité — point important

Le cloisonnement ne doit **pas reposer uniquement sur l'interface** (cacher des boutons, filtrer côté client) — ce n'est pas suffisant pour de vraies garanties de séparation. Merci de mettre en place de vraies règles de sécurité côté base de données (**Row Level Security sur Supabase**), pour que même une requête technique directe à la base ne puisse pas faire fuiter les données d'un restaurant vers l'autre.

## 4. Ce qui ne change pas

Toute la logique métier déjà construite (créneaux, apéro, focaccia automatique, personnalisation pizza, stock desserts, plan de table, etc.) reste identique — elle doit juste maintenant s'appliquer **par restaurant**, indépendamment.

**Le menu (produits, prix, ingrédients) est identique dans les deux enseignes** — pas besoin de gérer deux cartes différentes, un seul catalogue de produits suffit pour les deux.

⚠️ Nuance importante malgré tout : même si la carte est la même, les **ruptures de stock, le stock desserts du jour et les créneaux** doivent rester **propres à chaque restaurant** — une pizza en rupture à Riec ne doit pas être automatiquement en rupture à Quimperlé, et inversement (les deux cuisines sont indépendantes et peuvent manquer d'ingrédients différemment).

## 5. Suggestion de démarche

1. Faire valider la structure de données (schéma SQL mis à jour, table `restaurants`) avant de tout coder
2. Migrer les données existantes (celles de Casa Di Nathano / Riec) vers ce nouveau modèle, sans rien perdre
3. Créer le restaurant et l'accès pour Casa Di Luigi / Quimperlé
4. Construire l'espace Direction en dernier, une fois que les deux restaurants sont bien cloisonnés et fonctionnels indépendamment

---

*Document préparé pour être donné à Claude Code, en complément du cahier des charges initial et du code déjà en place.*
