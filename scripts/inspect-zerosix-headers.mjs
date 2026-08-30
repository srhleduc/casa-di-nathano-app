// Jetable — inspection des exports Zerosix (dossier local "exports zerosix/",
// jamais uploadé). Imprime, pour chaque .xlsx : la ligne d'en-tête, le type
// détecté par colonne, et 3 lignes d'exemple. Sert uniquement à figer le
// mapping des colonnes avant d'écrire scripts/migrate-zerosix-loyalty.mjs.
//
// Usage : node scripts/inspect-zerosix-headers.mjs

import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const DIR = path.join(process.cwd(), "exports zerosix");

const files = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".xlsx"));

for (const file of files) {
  const wb = xlsx.readFile(path.join(DIR, file), { cellDates: true });
  console.log("\n\n======================================================");
  console.log(file);
  console.log("======================================================");
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    const dataRows = rows.filter((r) => r && r.some((c) => c !== null && c !== ""));
    console.log(`\n--- feuille "${sheetName}" — ${dataRows.length} ligne(s) non vide(s) ---`);
    if (dataRows.length === 0) continue;
    const header = dataRows[0];
    console.log("EN-TÊTE :");
    header.forEach((h, i) => {
      const sample = dataRows.slice(1, 6).map((r) => r[i]).find((v) => v !== null && v !== "");
      console.log(`  [${i}] ${JSON.stringify(h)}  ex: ${JSON.stringify(sample)} (${typeof sample})`);
    });
    console.log("\n3 PREMIÈRES LIGNES DE DONNÉES :");
    for (const r of dataRows.slice(1, 4)) console.log("  " + JSON.stringify(r));
  }
}
