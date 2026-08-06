# Casa Di Nathano — borne de commande & espace équipe

App Next.js connectée à Supabase (Postgres + Realtime + Storage). Remplace l'ancien artefact React
(`borne-casa-di-nathano.jsx`, conservé à la racine pour référence) : mêmes écrans et la même logique
métier, mais avec une vraie base de données et une synchronisation en temps réel entre toutes les
tablettes (borne + équipe).

## 1. Créer le projet Supabase

1. Sur [supabase.com](https://supabase.com), crée un nouveau projet (plan gratuit).
2. Une fois le projet prêt, ouvre **SQL Editor** et exécute tout le contenu de `supabase/schema.sql`
   (crée les tables, les règles d'accès, active le temps réel, crée le bucket de stockage des photos
   et planifie le nettoyage quotidien).
3. Pour que le nettoyage automatique de minuit fonctionne, active l'extension **pg_cron** :
   Dashboard → Database → Extensions → active `pg_cron`. Vérifie aussi le fuseau horaire du projet
   (Dashboard → Settings → General) pour que "4h du matin" corresponde bien à une heure creuse du
   restaurant.
4. Récupère l'URL et la clé publique du projet dans **Project Settings → API**.

## 2. Configurer l'app en local

```bash
cp .env.local.example .env.local
```

Remplis `.env.local` avec `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

```bash
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

Sans `.env.local` rempli, l'app démarre quand même (écrans vides, avertissement en console) —
pratique pour vérifier que tout s'affiche avant d'avoir les clés Supabase en main.

## 3. Déployer sur Vercel

1. Pousse le projet sur un dépôt Git (GitHub/GitLab...).
2. Sur [vercel.com](https://vercel.com), importe le dépôt.
3. Ajoute les deux mêmes variables d'environnement (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) dans les réglages du projet Vercel.
4. Déploie. Chaque tablette (borne comme équipe) ouvre simplement l'URL Vercel dans son navigateur.

## Fonctionnement

- **Borne cliente** (`/`) : les clients composent leur commande.
- **Espace équipe** : bouton "Espace équipe" en bas à droite de l'écran d'accueil, protégé par un
  code à 4 chiffres (par défaut `0505`, modifiable sans redéploiement depuis
  Logistique → Maintenance → Code d'accès équipe).
- Toutes les tablettes ouvertes sur l'URL se synchronisent automatiquement via Supabase Realtime —
  plus besoin de bouton "Actualiser".
- Remise à zéro quotidienne (créneaux, ruptures, stock desserts, anciennes commandes) : automatique
  chaque nuit via le job `pg_cron` défini dans `supabase/schema.sql`. Un bouton de secours reste
  disponible dans Logistique → Maintenance.

## Compromis de sécurité assumé

Il n'y a pas de comptes utilisateurs : l'accès en lecture/écriture à Supabase est ouvert à la clé
publique (`anon`), et la seule protection de l'espace équipe est le code à 4 chiffres côté
interface. C'est adapté à un outil interne sur les tablettes du restaurant (aucune donnée de
paiement stockée), mais à ne pas reproduire tel quel pour une app grand public. Voir les
commentaires dans `supabase/schema.sql`.

## Structure du projet

```
app/            Next.js App Router (layout, styles globaux, page d'entrée)
components/     Écrans borne + espace équipe (portage 1:1 de borne-casa-di-nathano.jsx)
components/team/  Écrans de l'espace équipe (cuisine, salle, logistique)
lib/            Données statiques du menu, logique métier pure, accès Supabase (hooks temps réel + mutations)
supabase/       Schéma SQL à exécuter dans le projet Supabase
```
