"use client";

// Authentification de l'espace Direction — contrairement à la borne/l'équipe
// (compte fixe connecté automatiquement), chaque gérant se connecte avec son
// propre email/mot de passe personnel (cahier des charges : sécurité renforcée
// pour cet espace qui donne accès au chiffre d'affaires des deux enseignes).

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

export async function signInManager(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error };
}

export async function signOutManager() {
  await supabase.auth.signOut();
}

export function useManagerSession() {
  const [session, setSession] = useState(undefined); // undefined = pas encore vérifié

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setSession(data.session ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!cancelled) setSession(newSession);
    });
    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return { session, loading: session === undefined };
}
