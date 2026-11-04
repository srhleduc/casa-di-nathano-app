// Retour de la page de connexion Facebook (OAuth). Cette route ne fait que renvoyer
// le code vers l'application : l'échange contre les jetons se fait côté Supabase
// (Edge Function meta-connect), là où se trouve la clé secrète de l'app Meta.

import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const target = new URL("/", request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (code) {
    target.searchParams.set("meta_code", code);
    if (state) target.searchParams.set("meta_state", state);
  } else {
    target.searchParams.set("meta_error", searchParams.get("error_description") || searchParams.get("error") || "Connexion annulée.");
  }
  return NextResponse.redirect(target);
}
