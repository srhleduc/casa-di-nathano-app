// Gestion des comptes livreurs depuis la Direction (liste / création / suppression).
//
// Seule route de l'app qui utilise la clé service_role (SUPABASE_SERVICE_ROLE_KEY,
// variable serveur — jamais exposée au navigateur) : créer un compte d'authentification
// exige l'API d'administration. Garde-fou : l'appelant doit être connecté ET être
// un gérant (is_manager() vérifié avec SON jeton) avant toute action.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function authorize(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) return { error: NextResponse.json({ error: "Configuration manquante." }, { status: 500 }) };
  if (!service) {
    return { error: NextResponse.json({ error: "Clé service_role non configurée sur ce déploiement (SUPABASE_SERVICE_ROLE_KEY)." }, { status: 501 }) };
  }
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return { error: NextResponse.json({ error: "Non connecté." }, { status: 401 }) };

  const asCaller = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isManager, error } = await asCaller.rpc("is_manager");
  if (error || isManager !== true) return { error: NextResponse.json({ error: "Réservé à la Direction." }, { status: 403 }) };

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return { admin };
}

export async function GET(request) {
  const { admin, error } = await authorize(request);
  if (error) return error;
  const { data: rows, error: e1 } = await admin.from("drivers").select("auth_uid, name, created_at").order("created_at");
  if (e1) return NextResponse.json({ error: "Lecture impossible (script delivery_drivers.sql exécuté ?)." }, { status: 500 });
  const drivers = [];
  for (const r of rows || []) {
    const { data } = await admin.auth.admin.getUserById(r.auth_uid);
    drivers.push({ id: r.auth_uid, name: r.name, email: data?.user?.email || "" });
  }
  return NextResponse.json({ drivers });
}

export async function POST(request) {
  const { admin, error } = await authorize(request);
  if (error) return error;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const name = String(body?.name || "").trim().slice(0, 60);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!name) return NextResponse.json({ error: "Prénom requis." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Email invalide." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Mot de passe : 8 caractères minimum." }, { status: 400 });

  const { data, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createErr || !data?.user) {
    const exists = /already|registered|exists/i.test(createErr?.message || "");
    return NextResponse.json({ error: exists ? "Cet email a déjà un compte." : "Création du compte impossible." }, { status: exists ? 409 : 500 });
  }
  const { error: insErr } = await admin.from("drivers").insert({ auth_uid: data.user.id, name });
  if (insErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: "Enregistrement du livreur impossible (script delivery_drivers.sql exécuté ?)." }, { status: 500 });
  }
  return NextResponse.json({ driver: { id: data.user.id, name, email } });
}

export async function DELETE(request) {
  const { admin, error } = await authorize(request);
  if (error) return error;
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const { data: row } = await admin.from("drivers").select("auth_uid").eq("auth_uid", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Livreur introuvable." }, { status: 404 });
  await admin.from("drivers").delete().eq("auth_uid", id);
  // Le compte d'authentification n'est supprimé que s'il ne sert à rien d'autre.
  const [{ data: m }, { data: a }] = await Promise.all([
    admin.from("managers").select("auth_uid").eq("auth_uid", id).maybeSingle(),
    admin.from("restaurant_accounts").select("auth_uid").eq("auth_uid", id).maybeSingle(),
  ]);
  if (!m && !a) await admin.auth.admin.deleteUser(id);
  return NextResponse.json({ ok: true });
}
