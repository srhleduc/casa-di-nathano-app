// Migration Zerosix -> loyalty_customers. LOCAL uniquement : lit le dossier
// "exports zerosix/" (jamais uploade) et peuple la base clients fidelite avec
// les SOLDES DE POINTS ACTUELS (pas de reset). Aucune insertion dans
// loyalty_movements (decision : soldes seulement pour demarrer).
//
// Mapping (feuille "Contacts" de exports_6361-clients-*.xlsx) :
//   phone            <- [2]  Mobile           (canonicalise en 0XXXXXXXXX)
//   nom              <- [5]+[6] Prenom + Nom
//   date_anniversaire<- [8]  Date de naissance (serie Excel -> YYYY-MM-DD)
//   solde_points     <- [34] Solde de points   (max(0, round))
// Les numeros non francais (belges, suisses, malformes) sont ignores et
// listes en fin de rapport.
//
// Usage :
//   node scripts/migrate-zerosix-loyalty.mjs --dry-run   (n'ecrit rien)
//   node scripts/migrate-zerosix-loyalty.mjs             (upsert reel)
//
// Prerequis : APPRO_SEED_EMAIL / APPRO_SEED_PASSWORD (compte de service),
// comme scripts/seed-appro-catalog.mjs.

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import xlsx from "xlsx";

const DRY_RUN = process.argv.includes("--dry-run");
const SRC = path.join(process.cwd(), "exports zerosix", "exports_6361-clients-29082026.xlsx");
const SHEET = "Contacts";

// Colonnes (0-based) dans la feuille "Contacts".
const COL = { MOBILE: 2, PRENOM: 5, NOM: 6, DOB: 8, SOLDE: 34 };

// Copie autonome de lib/business.js -> canonicalLoyaltyPhone (source de
// verite cote app). Garde les deux identiques si l'un change.
function canonicalLoyaltyPhone(raw) {
  let s = String(raw || "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("+33")) s = "0" + s.slice(3);
  else if (s.startsWith("0033")) s = "0" + s.slice(4);
  else if (s.startsWith("+590")) s = "0" + s.slice(4); // Guadeloupe
  else if (s.startsWith("+594")) s = "0" + s.slice(4); // Guyane
  return /^0[1-9]\d{8}$/.test(s) ? s : null;
}

// Serie Excel entiere -> "YYYY-MM-DD" via le parseur SheetJS (gere l'epoch
// 1899-12-30 et le bug de l'annee bissextile 1900). null si pas exploitable.
function excelSerialToDate(v) {
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const dc = xlsx.SSF.parse_date_code(n);
  if (!dc || !dc.y) return null;
  return `${dc.y}-${String(dc.m).padStart(2, "0")}-${String(dc.d).padStart(2, "0")}`;
}

function readEnvLocal() {
  const env = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const pick = (k) => env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim();
  const url = pick("NEXT_PUBLIC_SUPABASE_URL");
  const anon = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY absents de .env.local");
    process.exit(1);
  }
  // Compte de service : variables d'env, sinon repli sur .env.local (gitignoré).
  const email = process.env.APPRO_SEED_EMAIL || pick("APPRO_SEED_EMAIL");
  const password = process.env.APPRO_SEED_PASSWORD || pick("APPRO_SEED_PASSWORD");
  return { url, anon, email, password };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Fichier introuvable : ${SRC}`);
    process.exit(1);
  }

  const wb = xlsx.readFile(SRC, { cellDates: false });
  const ws = wb.Sheets[SHEET];
  if (!ws) {
    console.error(`Feuille "${SHEET}" absente du classeur.`);
    process.exit(1);
  }
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const data = rows.slice(1).filter((r) => r && r.some((c) => c !== null && c !== ""));

  const byPhone = new Map(); // phone -> { phone, nom, date_anniversaire, solde_points }
  const skipped = []; // { mobile, nom, solde }
  let dupCollapsed = 0;

  for (const r of data) {
    const phone = canonicalLoyaltyPhone(r[COL.MOBILE]);
    const nom = [r[COL.PRENOM], r[COL.NOM]].map((s) => String(s || "").trim()).filter(Boolean).join(" ") || null;
    const solde = Math.max(0, Math.round(Number(r[COL.SOLDE]) || 0));

    if (!phone) {
      skipped.push({ mobile: String(r[COL.MOBILE] || "").trim(), nom, solde });
      continue;
    }

    const rec = { phone, nom, date_anniversaire: excelSerialToDate(r[COL.DOB]), solde_points: solde };
    if (byPhone.has(phone)) {
      // Doublon dans le fichier : on garde la ligne au solde le plus eleve.
      dupCollapsed++;
      const prev = byPhone.get(phone);
      byPhone.set(phone, rec.solde_points >= prev.solde_points ? { ...prev, ...rec } : { ...rec, ...prev });
    } else {
      byPhone.set(phone, rec);
    }
  }

  const records = [...byPhone.values()];
  const withPoints = records.filter((r) => r.solde_points > 0).length;
  const withBday = records.filter((r) => r.date_anniversaire).length;

  console.log("=== Migration Zerosix -> loyalty_customers ===");
  console.log(`Lignes lues            : ${data.length}`);
  console.log(`Clients a importer     : ${records.length}  (${withPoints} avec points > 0, ${withBday} avec anniversaire)`);
  console.log(`Doublons fusionnes     : ${dupCollapsed}`);
  console.log(`Ignores (num non FR)   : ${skipped.length}`);
  for (const s of skipped) console.log(`   - ${s.mobile}  ${s.nom || "(sans nom)"}  ${s.solde} pts`);

  console.log("\nEchantillon (10 premiers) :");
  for (const r of records.slice(0, 10)) console.log("  ", JSON.stringify(r));

  if (DRY_RUN) {
    console.log("\n--dry-run : rien n'a ete ecrit.");
    return;
  }

  const { url, anon, email, password } = readEnvLocal();
  if (!email || !password) {
    console.error(
      "\nCompte de service manquant. Ajoute dans .env.local (gitignoré) :\n" +
        "  APPRO_SEED_EMAIL=...\n  APPRO_SEED_PASSWORD=...\n" +
        "ou exporte APPRO_SEED_EMAIL / APPRO_SEED_PASSWORD dans l'environnement."
    );
    process.exit(1);
  }

  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error("AUTH ERROR", authErr);
    process.exit(1);
  }

  let done = 0;
  for (const part of chunk(records, 500)) {
    const { error } = await supabase.from("loyalty_customers").upsert(part, { onConflict: "phone" });
    if (error) {
      console.error(`\nUPSERT ERROR (apres ${done} lignes)`, error);
      process.exit(1);
    }
    done += part.length;
    console.log(`  upsert ${done}/${records.length}`);
  }
  console.log(`\nTermine : ${done} clients upsertes.`);
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
