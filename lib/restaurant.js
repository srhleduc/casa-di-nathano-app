"use client";

import { useEffect, useState } from "react";
import { supabase, ensureSignedIn } from "./supabaseClient";

// Identifiant du restaurant que sert CE déploiement (un projet Vercel par
// restaurant). Absent/vide sur le déploiement Direction, qui n'est rattaché
// à aucun restaurant en particulier.
export const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || null;

// Attend que la connexion automatique (compte fixe du restaurant) soit
// établie avant de laisser le reste de l'app charger des données — sinon
// les toutes premières requêtes partiraient encore non authentifiées.
export function useAuthReady() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    ensureSignedIn()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error };
}

// Nom/ville affichés à l'écran — viennent de la table `restaurants`, plus
// rien n'est codé en dur (Casa Di Nathano vs Casa Di Luigi selon le déploiement).
const FALLBACK_RESTAURANT = { id: RESTAURANT_ID, name: "Casa Di Nathano", city: "" };

export function useRestaurant() {
  const [restaurant, setRestaurant] = useState(FALLBACK_RESTAURANT);

  useEffect(() => {
    if (!RESTAURANT_ID) return;
    let cancelled = false;
    supabase
      .from("restaurants")
      .select("id, name, city, accent_color")
      .eq("id", RESTAURANT_ID)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setRestaurant({ id: data.id, name: data.name, city: data.city, accentColor: data.accent_color });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return restaurant;
}
