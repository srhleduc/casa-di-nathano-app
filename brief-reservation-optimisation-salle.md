# Brief technique — Module "Réservation sur place" (Casa)

> Version courante du brief technique du module. Complète le cahier des charges
> conceptuel (`Casa_Moteur_Reservation_Optimisation_Salle.docx`). Sections 1 et 2
> corrigées : la combinabilité des tables est **déclarative** (relation
> `combinable_with` saisie table par table), et un groupe de 3 tables ou plus est
> valide dès qu'il forme une **chaîne connectée** dans ce graphe (pas besoin de
> déclarer toutes les paires).

## Contexte & architecture

Casa fonctionne comme **un seul repo GitHub** (`srhleduc/casa-di-nathano-app`), déployé sur **trois environnements Vercel distincts** :
- `casa-di-nathano-app` (Riec)
- `casa-di-luigi-quimperle` (Quimperlé)
- `casa-direction` (pilotage / admin transverse)

Ce module est développé **une seule fois** dans le repo commun. Séparation des
données : **une seule base Supabase**, cloisonnée par `restaurant_id text`
(`'riec'` / `'quimperle'`) + RLS `my_restaurant_id()` / `is_manager()` — comme
tout le reste du schéma. (Le brief parlait de `establishment_id uuid` / bases
séparées : c'est faux pour Casa, on reste sur `restaurant_id text`.)

## Objectif du module

Un moteur de réservation de tables et d'optimisation de salle, intégré à Casa, qui :
1. Reçoit les demandes de réservation (nombre de personnes, date, heure)
2. Attribue automatiquement la meilleure configuration de tables possible
3. Optimise sur l'ensemble du service (pas réservation par réservation isolément)
4. Laisse l'équipe garder la main en cas de besoin (mode manuel)

**Note d'architecture** : approche grille (une case = une table 70×70), pas de
placement libre façon TheFork. On reprend quelques idées de leur éditeur :
sélection d'une table avec panneau de configuration, capacité min/préférée/max,
ordre de priorité de remplissage, combinaisons par clic.

## 1. Modèle de données (Supabase)

- **`room_layouts`** : plan quadrillé par restaurant. `cell_size_cm` défaut **70**
  (une case = une table). Demi-case 35 cm possible en mode fin (case = objet
  `{s,a,b}`). `cells` jsonb, codes `empty / S / P / T / D / W`.

- **`tables`** : tables physiques (registre partagé avec le SAT).
  - `label` — renommable à tout moment.
  - `grid_row` / `grid_col` **nullable** : une table peut exister sans être placée
    sur le plan actif (table de terrasse rangée hors saison…). Tant qu'elle n'est
    pas placée elle est **mise de côté** : hors capacité totale, invisible pour le
    moteur et l'affichage de dispo, replaçable à tout moment.
  - `capacity_min` / `capacity_preferred` / `capacity_max`.
  - `bookable_online` — proposable pour la résa en ligne.
  - `blocked` — non réservable sauf ajout manuel (table VIP…).
  - `priority_order` — ordre de remplissage préférentiel pendant le service.
  - **`combinable_with uuid[]`** — tables qu'on peut physiquement rapprocher.
    **Déclaration manuelle, table par table**, ne dépend PAS de la position au
    repos sur le plan : deux tables non adjacentes peuvent être combinables si
    l'équipe peut les déplacer en salle. **Ne pas supprimer ce champ ni son UI.**
  - `non_combinable_with uuid[]` — exception : jamais combinée avec, même si
    déclarée combinable ou adjacente.

- **`table_combinations`** : combinaisons valides.
  - `table_ids uuid[]`, `capacity int` (calculée à la création, éditable),
    `is_usual boolean`, `penalty_score int`.
  - **Validité** : les tables listées doivent former une **chaîne connectée** dans
    le graphe `combinable_with` (chaque table reliée à au moins une autre du
    groupe, directement ou de proche en proche). **Pas besoin que toutes les
    paires soient déclarées combinables.** Ex : `T1↔T2` et `T2↔T3` déclarées
    suffisent pour `T1+T2+T3`, même sans `T1↔T3`.
  - **Validation à l'écriture** : BFS/DFS sur le graphe `combinable_with` des
    tables du groupe → refus si non connecté. `non_combinable_with` d'une table
    bloque toute combinaison incluant cette paire précise, même si elle est
    déclarée combinable par ailleurs.

- **`reservations`** : `customer_name`, `customer_phone`, `party_size`,
  `requested_at`, `estimated_duration_minutes`, `status`
  (`confirmed / seated / completed / cancelled`), `arrived_at`, `departed_at`.

- **`reservation_table_assignments`** : `(reservation_id, table_id)`, écrite
  uniquement quand l'équipe force une affectation (`assigned_manually`).

- **`circulation_constraints`** : `endpoint_a/b` jsonb `{row,col}`,
  `min_width_cells` (en unités de 35 cm après détail interne), `priority`
  (`obligatoire / fortement_recommande / preferable`).

- **`service_templates`** : services par défaut. `default_start_time` /
  `default_end_time` = **plage d'ARRIVÉE** des clients (première → dernière table
  possible), pas la plage d'occupation. Un client arrivant à l'heure de fin
  exacte est valide même si sa durée estimée dépasse.

- **`service_overrides`** : ajustements par date (activer/désactiver/décaler,
  `auto_generated`).

- **`reservation_settings`** (le `establishment_settings` du brief) : bornes de la
  journée, marge de sécurité, granularité, `online_booking_enabled`.

## 2. Éditeur de plan de salle

Grille = une case = une table (70 cm), mode demi-case (35 cm) pour les passages,
défilement borné (déjà en place).

**À ajouter, inspiré de TheFork** :

**Sélection et configuration d'une table** — cliquer une case « Table » l'ouvre :
nom, disponible en ligne (toggle), bloquer (toggle), places min/préféré/max,
ordre de priorité de remplissage (glisser-déposer, global à l'établissement).

**Combinaisons** :
- Chaque table déclare manuellement « Peut être rapprochée de » (`combinable_with`)
  — relation pratique, pas géométrique.
- Créer : sélectionner plusieurs tables (clic / sélection multiple) → « Combiner ».
- Le système valide que le groupe forme une **chaîne connectée** dans le graphe
  des relations déclarées — pas besoin de déclarer toutes les paires. Sinon refus
  avec message clair.
- Exception par table : « Jamais combinée avec » — bloque même une paire déclarée
  combinable.
- Capacité calculée automatiquement, éditable ensuite. Liste des combinaisons
  visible dans un panneau.

## 3. Moteur de contraintes

**Absolues** (rejet) : table sur case interdite ; passage connexe ; largeur mini.
**Préférences** (pénalité) : deux tables normalement combinées mais séparées ;
table hors plage min/préféré/max ; écart à l'ordre de priorité habituel.

**Connectivité des passages** : contrainte de connectivité entre deux points
(BFS/A* largeur mini), pas de tracé figé — le moteur raisonne sur l'existence
d'un chemin. Pour < 70 cm (90, 105…), utiliser le mode demi-case (35 cm).

## 4. Moteur d'optimisation

Score global sur tout le service : `+ couverts/résas acceptées`,
`+ table adaptée (plage min/préféré/max)`, `+ respect de l'ordre de priorité`,
`+ préservation des combinaisons utiles pour les résas à venir`,
`− déplacements/séparations inutiles`, `− gaspillage de capacité`. Contraintes
absolues toujours respectées. Heuristique (glouton + recherche locale).

Durées estimées : 2p ≈ 1h15, 4p ≈ 1h30, 6p ≈ 1h45 — à caler avec les données
réelles arrivée/départ.

## 5. Interfaces

**Client** : nb personnes + date/heure → seuls les créneaux réellement
compatibles, jamais le plan de salle.

**Équipe** (bloc « Tables / Réservation ») : plan visuel avec statuts (libre /
réservée / occupée / bientôt dispo / groupée / séparée / bloquée) ; synthèse de
service (couverts réservés, capacité restante, configs prévues) ; mode manuel
(forcer une affectation + avertissement si config inhabituelle + recalcul des
conséquences).

## 6. Page `/reserver` (client)

Route publique unique (`/reserver`, sans accent), exposée par chaque déploiement
avec ses propres données. Formulaire nom + téléphone + nombre de personnes →
créneaux compatibles (moteur) → création dans `reservations`. Message de rappel
« ~1h30 par table ». Email/SMS de confirmation : plus tard (infra OVH SMS de la
fidélité, différée jusqu'au nouveau POS).

## 7. Services / créneaux (équipe)

Services par défaut préconfigurés, étendus automatiquement si besoin.

- `start_time` / `end_time` = plage d'**arrivée**. Une réservation est valide si
  `requested_at` tombe dans la plage, **même si `estimated_duration_minutes` se
  termine après `end_time`** (service qui ferme à 13h30 → arrivée 13h pour 1h15 =
  OK jusqu'à 14h15).
- Comptée dans le service correspondant à l'heure demandée ; refus / autre
  créneau si `max_covers` atteint.
- **Disponibilité des tables** calculée sur la plage d'occupation effective
  (arrivée + durée estimée), pas sur les horaires du service — une table occupée
  jusqu'à 14h15 n'est pas libre à 14h même si le service suivant a commencé.
- **Extension automatique** : réservation hors des services actifs → `service_override`
  `auto_generated = true` couvrant l'heure, borné par `latest_service_time`,
  services suivants recalés sans chevauchement. L'équipe voit le service auto et
  garde la main.

## 8. Étapes

1. Isolation env Supabase entre les 3 déploiements — fait (base unique + RLS).
2. Tables Supabase — faites (schéma phasé, RLS par `restaurant_id`).
3. Éditeur de plan React branché sur `room_layouts` / `tables` + sélection de
   table + panneau de config + combinaisons par clic.
4. Moteur de contraintes (connectivité + largeurs).
5. Services par défaut + extension automatique.
6. Moteur d'optimisation (scoring + heuristique, services actifs + priorité).
7. Interfaces client (`/reserver`) et équipe.
8. Test sur un service réel + calage des durées et horaires.
