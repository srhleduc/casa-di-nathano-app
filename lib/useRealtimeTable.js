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
  // Un upsert en masse (ex. régénération des créneaux du jour) déclenche un
  // event Realtime par ligne modifiée, donc potentiellement des dizaines de
  // reload() concurrents — sans garde, une réponse plus ancienne qui traîne
  // peut écraser en dernier le state avec une vue partielle/obsolète. On ne
  // garde que la réponse du reload() le plus récemment LANCÉ, quel que soit
  // l'ordre dans lequel les requêtes répondent.
  const latestRequestId = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    let query = supabase.from(table).select("*");
    if (eqColumn) query = query.eq(eqColumn, eqValue);
    if (orderColumn) query = query.order(orderColumn, { ascending: orderAscending });
    const { data, error } = await query;
    if (requestId !== latestRequestId.current) return; // une requête plus récente a déjà répondu
    if (!error && data) setRows(data.map((r) => mapRowRef.current(r)));
    setLoading(false);
  }, [table, orderColumn, orderAscending, eqColumn, eqValue]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await reload();
    })();

    // Un upsert en masse fait arriver les events Realtime un par un, étalés
    // sur plusieurs secondes — sans regroupement, chaque event relance son
    // propre reload(), et une action rapprochée (ex. cliquer "Générer" une
    // deuxième fois) se retrouve à attendre la fin de la rafale de la
    // précédente au lieu de son propre reload() explicite (voir garde
    // latestRequestId ci-dessus). On absorbe la rafale en un seul reload(),
    // déclenché une fois les events calmés.
    let debounceTimer = null;
    const channel = supabase
      .channel(`realtime:${table}:${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (cancelled) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!cancelled) reload();
        }, 400);
      })
      .subscribe();

    // Filet de sécurité : la connexion Realtime peut se couper en silence
    // (tablette qui se met en veille, wifi qui flanche un instant) sans que
    // le canal ne déclenche d'erreur visible — l'écran continue de tourner
    // avec un état figé, potentiellement des heures. C'est ce qui a permis à
    // deux commandes indépendantes de réserver le même créneau le 27/09/2026
    // (Casa Di Luigi) : l'une des deux venait d'un écran resté ouvert avec
    // une liste de créneaux périmée. On ne peut pas fiabiliser le direct à
    // 100 %, donc on complète par (1) un sondage périodique et (2) un
    // rafraîchissement quand l'onglet redevient visible/actif, pour qu'un
    // écran ne reste jamais durablement désynchronisé de la base.
    const pollInterval = setInterval(() => {
      if (!cancelled) reload();
    }, 30000);
    function onVisible() {
      if (!cancelled && document.visibilityState === "visible") reload();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      supabase.removeChannel(channel);
    };
  }, [reload, table, instanceId]);

  return { rows, loading, reload };
}
