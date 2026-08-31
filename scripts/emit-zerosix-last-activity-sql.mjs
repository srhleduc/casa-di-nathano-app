// LOCAL uniquement. Génère un fichier .sql qui réalimente
// loyalty_customers.last_activity_at à partir de la colonne « Dernier passage »
// (à défaut « Contact créé le ») de l'export clients Zerosix, pour que le job
// loyalty-purge-inactifs (18 mois) tienne compte de la vraie dernière visite.
//
// Ne produit que des UPDATE ciblés par téléphone : aucun risque de réécraser
// solde_points / nom / date_anniversaire ni de recréer un compte supprimé.
// À exécuter ensuite dans Supabase -> SQL Editor.
//
// Usage : node scripts/emit-zerosix-last-activity-sql.mjs
// Sortie : "exports zerosix/zerosix-last-activity.sql" (dossier gitignoré)

import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const SRC = path.join(process.cwd(), "exports zerosix", "exports_6361-clients-29082026.xlsx");
const OUT = path.join(process.cwd(), "exports zerosix", "zerosix-last-activity.sql");
const SHEET = "Contacts";
const COL = { MOBILE: 2, CONTACT_CREE_LE: 17, DERNIER_PASSAGE: 28 };

function canonicalLoyaltyPhone(raw) {
  let s = String(raw || "").replace(/[\s.\-()]/g, "");
  if (s.startsWith("+33")) s = "0" + s.slice(3);
  else if (s.startsWith("0033")) s = "0" + s.slice(4);
  else if (s.startsWith("+590")) s = "0" + s.slice(4);
  else if (s.startsWith("+594")) s = "0" + s.slice(4);
  return /^0[1-9]\d{8}$/.test(s) ? s : null;
}

function excelSerialToTimestamp(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  const dc = xlsx.SSF.parse_date_code(n);
  if (!dc || !dc.y) return null;
  const p = (x) => String(x).padStart(2, "0");
  return `${dc.y}-${p(dc.m)}-${p(dc.d)}T${p(dc.H || 0)}:${p(dc.M || 0)}:${p(Math.floor(dc.S || 0))}Z`;
}

if (!fs.existsSync(SRC)) {
  console.error(`Fichier introuvable : ${SRC}`);
  process.exit(1);
}

const wb = xlsx.readFile(SRC, { cellDates: false });
const rows = xlsx.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1, raw: true, defval: null });
const data = rows.slice(1).filter((r) => r && r.some((c) => c !== null && c !== ""));

const lines = [];
let withPassage = 0;
let withCreation = 0;
let skipped = 0;
const seen = new Set();

for (const r of data) {
  const phone = canonicalLoyaltyPhone(r[COL.MOBILE]);
  if (!phone || seen.has(phone)) {
    skipped++;
    continue;
  }
  seen.add(phone);
  let ts = excelSerialToTimestamp(r[COL.DERNIER_PASSAGE]);
  if (ts) {
    withPassage++;
  } else {
    ts = excelSerialToTimestamp(r[COL.CONTACT_CREE_LE]);
    if (ts) withCreation++;
  }
  if (!ts) {
    skipped++;
    continue;
  }
  lines.push(`update loyalty_customers set last_activity_at = '${ts}' where phone = '${phone}';`);
}

const header =
  `-- Réalimentation de loyalty_customers.last_activity_at depuis l'export Zerosix.\n` +
  `-- ${lines.length} comptes : ${withPassage} via « Dernier passage », ${withCreation} via « Contact créé le ».\n` +
  `-- ${skipped} ligne(s) ignorée(s) (numéro non exploitable ou aucune date). Généré le ${new Date().toISOString()}.\n\n`;

fs.writeFileSync(OUT, header + lines.join("\n") + "\n");
console.log(header.trim());
console.log(`\nÉcrit : ${OUT}`);
