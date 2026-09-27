-- Garde-fou serveur contre le double-décompte des créneaux click & collect.
--
-- Contexte (bug du 27/09/2026, Casa Di Luigi) : deux commandes indépendantes
-- se sont vues attribuer le même créneau 19:30 (capacité 4) sans jamais être
-- signalées comme "créneau plein" — l'une des deux commandes a été prise
-- depuis un écran dont la liste des créneaux était périmée (slotId d'un
-- ancien créneau déjà remplacé), donc invisible du calcul de remplissage
-- fait côté navigateur. Jusqu'ici, rien côté serveur ne revérifiait qu'un
-- créneau référencé par une commande existe encore et a effectivement de la
-- place : create_takeaway_order (click & collect) et l'insert direct
-- (borne/équipe) faisaient une confiance aveugle à slot_allocations tel
-- qu'envoyé par le client.
--
-- Ce trigger revalide chaque écriture d'orders (insert, ou update qui touche
-- slot_allocations/slot_forced) quelle que soit la porte d'entrée :
--   1. chaque slotId référencé doit exister dans `slots` pour ce restaurant ;
--   2. la quantité totale déjà utilisée par les AUTRES commandes actives
--      (hors "servie", hors commandes de test) + celle de cette commande ne
--      doit pas dépasser la capacité du créneau, sauf si slot_forced = true
--      (le forçage volontaire, déjà utilisé côté équipe, reste possible).
--
-- Les commandes de test (is_test = true) ne sont jamais bloquées : elles ne
-- comptent déjà pas dans le remplissage réel (voir lib/business.js,
-- realUsedForSlot), donc pas de raison de les soumettre à la capacité.

create or replace function check_slot_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alloc jsonb;
  v_slot_id uuid;
  v_qty integer;
  v_capacity integer;
  v_slot_exists boolean;
  v_other_used integer;
  by_slot jsonb := '{}'::jsonb;
  k text;
begin
  if new.is_test then
    return new;
  end if;
  if new.slot_allocations is null or jsonb_array_length(new.slot_allocations) = 0 then
    return new;
  end if;

  -- Regroupe les qty par slotId (une commande peut en théorie référencer
  -- plusieurs fois le même créneau, même si l'app ne le fait pas).
  for alloc in select * from jsonb_array_elements(new.slot_allocations)
  loop
    k := alloc->>'slotId';
    if k is null then
      raise exception 'Créneau invalide : allocation sans slotId';
    end if;
    by_slot := jsonb_set(
      by_slot, array[k],
      to_jsonb(coalesce((by_slot->>k)::integer, 0) + coalesce((alloc->>'qty')::integer, 0))
    );
  end loop;

  for k, v_qty in select * from jsonb_each_text(by_slot)
  loop
    begin
      v_slot_id := k::uuid;
    exception when invalid_text_representation then
      raise exception 'Créneau invalide : identifiant % illisible', k;
    end;

    select capacity, true into v_capacity, v_slot_exists
    from slots
    where id = v_slot_id and restaurant_id = new.restaurant_id;

    if not found then
      raise exception 'Ce créneau n''existe plus (il a peut-être été régénéré) — merci de recharger la page et de choisir à nouveau un horaire.';
    end if;

    select coalesce(sum((a->>'qty')::integer), 0) into v_other_used
    from orders o, jsonb_array_elements(o.slot_allocations) a
    where o.restaurant_id = new.restaurant_id
      and o.status <> 'servie'
      and not o.is_test
      and o.id <> new.id
      and (a->>'slotId') = v_slot_id::text;

    if (coalesce(v_other_used, 0) + v_qty) > v_capacity and not coalesce(new.slot_forced, false) then
      raise exception 'Créneau complet (% pizza(s) déjà prévues sur % places) — confirmation de forçage requise.', coalesce(v_other_used, 0), v_capacity;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_check_slot_capacity on orders;
create trigger trg_check_slot_capacity
  before insert or update of slot_allocations, slot_forced on orders
  for each row
  execute function check_slot_capacity();
