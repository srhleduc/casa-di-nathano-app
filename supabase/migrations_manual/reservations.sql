-- =====================================================================
-- Module « Tables / Réservation » — Phase 1 : schéma
--
-- Moteur de réservation + optimisation de salle (cahier des charges
-- Casa_Moteur_Reservation_Optimisation_Salle). Une seule base Supabase
-- partagée par les 3 déploiements : cloisonnement par restaurant_id text
-- ('riec' / 'quimperle') + RLS (my_restaurant_id() / is_manager()), comme
-- tout le reste du schéma. La table `tables` (créée pour le SAT) est
-- ÉTENDUE, pas dupliquée.
--
-- À coller dans Supabase → SQL Editor. Purement additif : nouvelles tables
-- + colonnes nullables sur `tables`. Aucun code applicatif ne s'en sert
-- encore (livré aux phases suivantes).
-- =====================================================================

-- ---- Plans de salle quadrillés -------------------------------------------
-- cells = jsonb, tableau 2D de codes : empty / S (siège) / P (passage) /
-- T (table 70x70) / D (porte) / W (zone travail-attente). Une table 70x70
-- occupe 2x2 cases à cell_size_cm = 35. Plusieurs plans nommés par resto.
create table if not exists room_layouts (id uuid primary key default gen_random_uuid(), restaurant_id text not null references restaurants (id), name text not null default 'Salle', grid_rows int not null default 10, grid_cols int not null default 10, cell_size_cm int not null default 35, cells jsonb not null default '[]'::jsonb, updated_at timestamptz not null default now(), unique (restaurant_id, name));

-- ---- `tables` (SAT) : extension géométrie + capacité + combinaisons ------
-- Colonnes nullables : une table SAT existante n'est pas encore placée.
alter table tables add column if not exists layout_id uuid references room_layouts (id) on delete set null;
alter table tables add column if not exists grid_row int;
alter table tables add column if not exists grid_col int;
alter table tables add column if not exists capacity_base int not null default 2;
alter table tables add column if not exists usually_combined_with uuid[] not null default '{}';
alter table tables add column if not exists combinable_with uuid[] not null default '{}';
alter table tables add column if not exists non_combinable_with uuid[] not null default '{}';

-- ---- Combinaisons de tables valides (précalculées ou à la volée) ---------
create table if not exists table_combinations (id uuid primary key default gen_random_uuid(), restaurant_id text not null references restaurants (id), table_ids uuid[] not null, capacity int not null, is_usual boolean not null default true, penalty_score int not null default 0, created_at timestamptz not null default now());

-- ---- Réservations -------------------------------------------------------
create table if not exists reservations (id uuid primary key default gen_random_uuid(), restaurant_id text not null references restaurants (id), customer_name text, customer_phone text, party_size int not null, requested_at timestamptz not null, estimated_duration_minutes int not null default 90, status text not null default 'confirmed' check (status in ('confirmed', 'seated', 'completed', 'cancelled', 'no_show')), arrived_at timestamptz, departed_at timestamptz, note text, source text not null default 'client', created_at timestamptz not null default now());

-- ---- Affectation table(s) <-> réservation -------------------------------
-- restaurant_id dénormalisé pour aligner la RLS sur le reste du schéma.
create table if not exists reservation_table_assignments (reservation_id uuid not null references reservations (id) on delete cascade, table_id uuid not null references tables (id) on delete cascade, restaurant_id text not null references restaurants (id), assigned_manually boolean not null default false, primary key (reservation_id, table_id));

-- ---- Contraintes de circulation (connectivité + largeur) --------------
-- endpoint_a / endpoint_b = jsonb {row, col} sur la grille du layout.
create table if not exists circulation_constraints (id uuid primary key default gen_random_uuid(), restaurant_id text not null references restaurants (id), layout_id uuid references room_layouts (id) on delete cascade, name text not null, endpoint_a jsonb not null, endpoint_b jsonb not null, min_width_cells int not null default 2, priority text not null default 'obligatoire' check (priority in ('obligatoire', 'fortement_recommande', 'preferable')), created_at timestamptz not null default now());

-- ---- Services par défaut (1er, 2e, 3e...) -----------------------------
create table if not exists service_templates (id uuid primary key default gen_random_uuid(), restaurant_id text not null references restaurants (id), service_number int not null, label text, default_start_time time not null, default_end_time time not null, max_covers int, active_by_default boolean not null default true, unique (restaurant_id, service_number));

-- ---- Ajustements ponctuels par date (dont services auto-générés) ------
create table if not exists service_overrides (id uuid primary key default gen_random_uuid(), restaurant_id text not null references restaurants (id), date date not null, service_number int not null, start_time time not null, end_time time not null, max_covers int, is_active boolean not null default true, auto_generated boolean not null default false, unique (restaurant_id, date, service_number));

-- ---- Réglages réservation par restaurant -----------------------------
create table if not exists reservation_settings (restaurant_id text primary key references restaurants (id), earliest_service_time time not null default '18:00', latest_service_time time not null default '22:30', safety_margin_minutes int not null default 15, slot_granularity_minutes int not null default 15, online_booking_enabled boolean not null default false);

-- ---- RLS -------------------------------------------------------------
alter table room_layouts enable row level security;
alter table table_combinations enable row level security;
alter table reservations enable row level security;
alter table reservation_table_assignments enable row level security;
alter table circulation_constraints enable row level security;
alter table service_templates enable row level security;
alter table service_overrides enable row level security;
alter table reservation_settings enable row level security;

drop policy if exists "room_layouts_select" on room_layouts;
drop policy if exists "room_layouts_write" on room_layouts;
create policy "room_layouts_select" on room_layouts for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "room_layouts_write" on room_layouts for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

drop policy if exists "table_combinations_select" on table_combinations;
drop policy if exists "table_combinations_write" on table_combinations;
create policy "table_combinations_select" on table_combinations for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "table_combinations_write" on table_combinations for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

drop policy if exists "reservations_select" on reservations;
drop policy if exists "reservations_write" on reservations;
create policy "reservations_select" on reservations for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "reservations_write" on reservations for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

drop policy if exists "reservation_table_assignments_select" on reservation_table_assignments;
drop policy if exists "reservation_table_assignments_write" on reservation_table_assignments;
create policy "reservation_table_assignments_select" on reservation_table_assignments for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "reservation_table_assignments_write" on reservation_table_assignments for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

drop policy if exists "circulation_constraints_select" on circulation_constraints;
drop policy if exists "circulation_constraints_write" on circulation_constraints;
create policy "circulation_constraints_select" on circulation_constraints for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "circulation_constraints_write" on circulation_constraints for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

drop policy if exists "service_templates_select" on service_templates;
drop policy if exists "service_templates_write" on service_templates;
create policy "service_templates_select" on service_templates for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "service_templates_write" on service_templates for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

drop policy if exists "service_overrides_select" on service_overrides;
drop policy if exists "service_overrides_write" on service_overrides;
create policy "service_overrides_select" on service_overrides for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "service_overrides_write" on service_overrides for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

drop policy if exists "reservation_settings_select" on reservation_settings;
drop policy if exists "reservation_settings_write" on reservation_settings;
create policy "reservation_settings_select" on reservation_settings for select to authenticated using (restaurant_id = my_restaurant_id() or is_manager());
create policy "reservation_settings_write" on reservation_settings for all to authenticated using (restaurant_id = my_restaurant_id()) with check (restaurant_id = my_restaurant_id());

-- ---- Realtime ------------------------------------------------------
alter publication supabase_realtime add table room_layouts;
alter publication supabase_realtime add table table_combinations;
alter publication supabase_realtime add table reservations;
alter publication supabase_realtime add table reservation_table_assignments;
alter publication supabase_realtime add table circulation_constraints;
alter publication supabase_realtime add table service_templates;
alter publication supabase_realtime add table service_overrides;

-- ---- Amorces ------------------------------------------------------
insert into reservation_settings (restaurant_id) values ('riec'), ('quimperle') on conflict (restaurant_id) do nothing;
insert into room_layouts (restaurant_id, name) values ('riec', 'Salle'), ('quimperle', 'Salle') on conflict (restaurant_id, name) do nothing;

notify pgrst, 'reload schema';
