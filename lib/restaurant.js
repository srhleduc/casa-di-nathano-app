"use client";

import { createContext, useContext, useEffect, useState } from "react";
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

// Utilisé uniquement par l'espace Direction : quand un gérant "entre" dans le
// détail d'un restaurant précis, on enveloppe cet écran dans ce contexte pour
// que useOrders/useSlots/etc. filtrent explicitement sur ce restaurant plutôt
// que de compter sur le compte connecté (un manager n'a pas de restaurant
// propre — sans ce filtre, il verrait les deux enseignes mélangées).
// Vaut toujours `null` côté borne/équipe normale : aucun changement de
// comportement là-bas, RLS scoping via le compte suffit.
export const RestaurantFilterContext = createContext(null);
export function useRestaurantFilter() {
  return useContext(RestaurantFilterContext);
}

const FALLBACK_RESTAURANT = { id: RESTAURANT_ID, name: "Casa Di Nathano", city: "" };

// Sans argument : restaurant de CE déploiement (borne/équipe). Avec un id
// explicite (Direction) : ce restaurant précis, peu importe le déploiement.
export function useRestaurant(explicitId) {
  const id = explicitId || RESTAURANT_ID;
  const [restaurant, setRestaurant] = useState(id === RESTAURANT_ID ? FALLBACK_RESTAURANT : { id, name: "", city: "" });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    supabase
      .from("restaurants")
      .select("id, name, city, accent_color")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setRestaurant({ id: data.id, name: data.name, city: data.city, accentColor: data.accent_color });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return restaurant;
}

// Liste de tous les restaurants — utilisée par l'espace Direction pour le
// tableau comparatif (rien de codé en dur : un 3e restaurant ajouté un jour
// dans la table `restaurants` apparaîtrait ici automatiquement).
export function useRestaurantsList() {
  const [restaurants, setRestaurants] = useState([]);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("restaurants")
      .select("id, name, city, accent_color")
      .order("name")
      .then(({ data }) => {
        if (!cancelled && data) {
          setRestaurants(data.map((r) => ({ id: r.id, name: r.name, city: r.city, accentColor: r.accent_color })));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return restaurants;
}
