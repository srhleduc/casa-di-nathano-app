"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

// Hook générique : charge une table Postgres et reste à jour en direct via
// Supabase Realtime (insert/update/delete), sans rafraîchissement manuel.
// C'est la pièce qui remplace la synchronisation absente de l'ancienne
// version (stockage d'artefact, rechargement manuel par bouton "🔄").
//
// Sur tout changement, on recharge la table entière plutôt que de fusionner
// la ligne modifiée : ces tables restent petites (le volume d'un service de
// pizzeria), donc la fiabilité d'une seule source de vérité l'emporte sur le
// gain de perf d'un merge incrémental.
export function useRealtimeTable({ table, mapRow, orderColumn, orderAscending = true, eq }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapRowRef = useRef(mapRow);
  mapRowRef.current = mapRow;
  // Plusieurs composants (borne + différents écrans équipe) peuvent appeler ce
  // hook pour la même table en même temps — chaque instance a besoin de son
  // propre canal Realtime, sinon Supabase refuse le deuxième abonnement sur
  // un nom de canal déjà utilisé.
  const instanceId = useId();
  const eqColumn = eq?.column;
  const eqValue = eq?.value;

  const reload = useCallback(async () => {
    let query = supabase.from(table).select("*");
    if (eqColumn) query = query.eq(eqColumn, eqValue);
    if (orderColumn) query = query.order(orderColumn, { ascending: orderAscending });
    const { data, error } = await query;
    if (!error && data) setRows(data.map((r) => mapRowRef.current(r)));
    setLoading(false);
  }, [table, orderColumn, orderAscending, eqColumn, eqValue]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await reload();
    })();

    const channel = supabase
      .channel(`realtime:${table}:${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (!cancelled) reload();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [reload, table, instanceId]);

  return { rows, loading, reload };
}
