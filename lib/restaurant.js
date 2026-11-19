"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase, ensureSignedIn } from "./supabaseClient";

// Identifiant du restaurant que sert CE déploiement (un projet Vercel par
// restaurant). Absent/vide sur le déploiement Direction, qui n'est rattaché
// à aucun restaurant en particulier.
const ENV_RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || null;

// Restaurant visé par les ÉCRITURES. Sur la borne/équipe c'est celui du
// déploiement (inchangé). Dans l'espace Direction, quand un gérant entre dans
// un restaurant pour y agir comme l'équipe, on y met ce restaurant (voir
// setDirectionRestaurant) : toutes les fonctions d'écriture de lib/data.js,
// qui lisent RESTAURANT_ID, ciblent alors le bon établissement. Export "live"
// (ES module) : les importeurs voient la valeur à jour.
export let RESTAURANT_ID = ENV_RESTAURANT_ID;
export function setDirectionRestaurant(id) {
  RESTAURANT_ID = id || ENV_RESTAURANT_ID;
}
// Vrai quand la Direction agit dans un restaurant (déploiement sans restaurant).
export function isDirectionActing() {
  return !ENV_RESTAURANT_ID && Boolean(RESTAURANT_ID);
}

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

const FALLBACK_RESTAURANT = { id: ENV_RESTAURANT_ID, name: "Casa Di Nathano", city: "", phone: "" };

// Sans argument : restaurant de CE déploiement (borne/équipe). Avec un id
// explicite (Direction) : ce restaurant précis, peu importe le déploiement.
export function useRestaurant(explicitId) {
  const id = explicitId || ENV_RESTAURANT_ID;
  const [restaurant, setRestaurant] = useState(id === ENV_RESTAURANT_ID ? FALLBACK_RESTAURANT : { id, name: "", city: "", phone: "" });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    supabase
      .from("restaurants")
      .select("id, name, city, accent_color, phone, notification_sound_url")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) {
          setRestaurant({
            id: data.id,
            name: data.name,
            city: data.city,
            accentColor: data.accent_color,
            phone: data.phone,
            notificationSoundUrl: data.notification_sound_url,
          });
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
      .select("id, name, city, accent_color, google_review_url, notification_sound_url")
      .order("name")
      .then(({ data }) => {
        if (!cancelled && data) {
          setRestaurants(
            data.map((r) => ({
              id: r.id,
              name: r.name,
              city: r.city,
              accentColor: r.accent_color,
              googleReviewUrl: r.google_review_url,
              notificationSoundUrl: r.notification_sound_url,
            }))
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return restaurants;
}
