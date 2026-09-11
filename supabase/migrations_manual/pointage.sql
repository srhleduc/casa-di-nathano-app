-- =====================================================================
-- MODULE POINTAGE (remplace Skello) — badgeuse PIN + gestion du personnel
-- Phase 1 : structure. Additif pur — aucune ligne existante modifiée,
-- aucun code applicatif ne s'en sert encore.
--
-- À exécuter une fois dans Supabase → SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Référentiel du personnel. PIN unique par établissement (pas globalement :
-- deux salariés de Riec et Quimperlé peuvent avoir le même code).
-- ---------------------------------------------------------------------
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id text not null references restaurants (id),
  full_name text not null,
  pin_code text not null,
  contract_type text not null default 'cdi'
    check (contract_type in ('cdi', 'cdd', 'extra', 'apprenti')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists staff_pin_per_restaurant
  on staff (restaurant_id, pin_code)
  where active = true;

alter table staff enable row level security;

drop policy if exists "staff_select" on staff;
drop policy if exists "staff_write" on staff;
create policy "staff_select" on staff for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "staff_write" on staff for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

alter publication supabase_realtime add table staff;

-- ---------------------------------------------------------------------
-- Pointages. Jamais modifiés après coup (voir plus bas : aucune policy
-- update/delete n'est créée, RLS activée les refuse donc par défaut).
-- Une correction passe uniquement par pointage_corrections.
-- ---------------------------------------------------------------------
create type pointage_type as enum (
  'arrivee',
  'pause_debut',
  'pause_fin',
  'depart'
);

create table if not exists pointage_entries (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id),
  restaurant_id text not null references restaurants (id),
  type pointage_type not null,
  occurred_at timestamptz not null default now(),
  method text not null default 'tablette_pin'
    check (method in ('tablette_pin', 'mobile_app')),
  -- Champs optionnels, non utilisés pour l'instant (RGPD : minimisation des
  -- données — à activer plus tard si besoin réel, jamais en continu).
  photo_url text,
  geoloc jsonb,
  device_id text,
  created_at timestamptz not null default now()
);

create index if not exists pointage_entries_staff_date
  on pointage_entries (staff_id, occurred_at desc);

create index if not exists pointage_entries_restaurant_date
  on pointage_entries (restaurant_id, occurred_at desc);

alter table pointage_entries enable row level security;

drop policy if exists "pointage_entries_select" on pointage_entries;
drop policy if exists "pointage_entries_insert" on pointage_entries;
create policy "pointage_entries_select" on pointage_entries for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "pointage_entries_insert" on pointage_entries for insert to authenticated with check (restaurant_id = my_restaurant_id());

alter publication supabase_realtime add table pointage_entries;

-- ---------------------------------------------------------------------
-- Régularisations manuelles d'un pointage — trace qui a corrigé, quand, et
-- pourquoi (art. L.3171-4 : la preuve des heures travaillées incombe à
-- l'employeur). Table créée dès maintenant, pas d'écran ce tour-ci.
-- ---------------------------------------------------------------------
create table if not exists pointage_corrections (
  id uuid primary key default gen_random_uuid(),
  original_entry_id uuid references pointage_entries (id),
  staff_id uuid not null references staff (id),
  restaurant_id text not null references restaurants (id),
  corrected_by text not null,
  reason text not null,
  corrected_occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table pointage_corrections enable row level security;

drop policy if exists "pointage_corrections_select" on pointage_corrections;
drop policy if exists "pointage_corrections_insert" on pointage_corrections;
create policy "pointage_corrections_select" on pointage_corrections for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "pointage_corrections_insert" on pointage_corrections for insert to authenticated with check (restaurant_id = my_restaurant_id() or is_manager());

notify pgrst, 'reload schema';
