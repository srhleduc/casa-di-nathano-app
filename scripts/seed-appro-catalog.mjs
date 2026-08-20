// Peuple appro_products avec le vrai catalogue, à partir des ~344 lignes
// déjà extraites et validées des 5 fournisseurs (Grain du Ponant, Sysco,
// Danioli, Armor Emballages, France Boissons — Carniato mis de côté).
// Dédupliqué par nom de produit + fournisseur. Les 12 produits déjà en base
// restent inchangés ; tout nom déjà présent (quel que soit le fournisseur)
// est ignoré plutôt que dupliqué.
//
// Certains parseurs n'ont pas capturé de colonne "unité" explicite (Grain
// du Ponant, Danioli, France Boissons — le format ne l'imprime pas
// séparément) : on retombe sur "pièce" par défaut pour ces produits-là,
// à corriger au cas par cas depuis l'écran Approvisionnement si besoin.
//
// Usage : node scripts/seed-appro-catalog.mjs

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { parseInvoiceText as parseGrainDuPonant } from "./parse-grain-du-ponant.mjs";
import { parseInvoiceText as parseSysco } from "./parse-sysco.mjs";
import { parseInvoiceText as parseDanioli } from "./parse-danioli.mjs";
import { parseInvoiceText as parseFranceBoissons } from "./parse-france-boissons.mjs";
import { parseInvoiceText as parseArmorEmballages } from "./parse-armor-emballages.mjs";
import { PDFParse } from "pdf-parse";

const ROOT = path.join(process.cwd(), "factures-fournisseurs");

const SOURCES = [
  { dir: "grain-du-ponant", supplier: "Grain du Ponant", parse: parseGrainDuPonant, defaultUnit: "pièce" },
  { dir: "sysco", supplier: "Sysco", parse: parseSysco, defaultUnit: null },
  { dir: "danioli", supplier: "Danioli", parse: parseDanioli, defaultUnit: "pièce" },
  { dir: "armor-emballages", supplier: "Armor Emballages", parse: parseArmorEmballages, defaultUnit: null },
  { dir: "france-boissons", supplier: "France Boissons", parse: parseFranceBoissons, defaultUnit: "pièce" },
];

async function extractText(filePath) {
  const data = fs.readFileSync(filePath);
  const parser = new PDFParse({ data });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}

async function main() {
  const envLocal = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const url = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
  const anonKey = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim();
  const supabase = createClient(url, anonKey);

  const email = process.env.APPRO_SEED_EMAIL;
  const password = process.env.APPRO_SEED_PASSWORD;
  if (!email || !password) {
    console.error("Définis APPRO_SEED_EMAIL et APPRO_SEED_PASSWORD (compte de service) avant de lancer ce script.");
    process.exit(1);
  }
  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error("AUTH ERROR", authErr);
    process.exit(1);
  }

  // 1. Extraction + dédup par (nom, fournisseur)
  const candidates = new Map(); // key: "fournisseur::nom" -> { name, unit, supplier }
  for (const source of SOURCES) {
    const dirPath = path.join(ROOT, source.dir);
    if (!fs.existsSync(dirPath)) continue;
    const pdfFiles = fs.readdirSync(dirPath).filter((f) => f.toLowerCase().endsWith(".pdf"));
    for (const file of pdfFiles) {
      const text = await extractText(path.join(dirPath, file));
      const rows = source.parse(text, file);
      for (const row of rows) {
        const name = (row.productLabel || "").trim();
        if (!name) continue;
        const unit = row.unit || source.defaultUnit || "pièce";
        const key = `${source.supplier}::${name}`;
        if (!candidates.has(key)) candidates.set(key, { name, unit, supplier: source.supplier });
      }
    }
  }
  console.log(`${candidates.size} produit(s) unique(s) identifié(s) après dédup (nom + fournisseur) sur ${SOURCES.length} fournisseurs.`);

  // 2. Résolution des fournisseurs + détection des noms déjà en base
  const supplierNames = [...new Set([...candidates.values()].map((c) => c.supplier))];
  const { data: suppliers, error: supErr } = await supabase.from("appro_suppliers").select("id, name").in("name", supplierNames);
  if (supErr) { console.error("SUPPLIERS FETCH ERROR", supErr); process.exit(1); }
  const supplierIdByName = Object.fromEntries(suppliers.map((s) => [s.name, s.id]));
  for (const name of supplierNames) {
    if (!supplierIdByName[name]) { console.error(`Fournisseur introuvable en base : "${name}" — arrêt.`); process.exit(1); }
  }

  const { data: existingProducts, error: prodErr } = await supabase.from("appro_products").select("name");
  if (prodErr) { console.error("PRODUCTS FETCH ERROR", prodErr); process.exit(1); }
  const existingNames = new Set(existingProducts.map((p) => p.name));

  // 3. Insertion
  let created = 0;
  let skipped = 0;
  const perSupplier = {};
  for (const { name, unit, supplier } of candidates.values()) {
    perSupplier[supplier] = perSupplier[supplier] || { created: 0, skipped: 0 };
    if (existingNames.has(name)) {
      skipped++;
      perSupplier[supplier].skipped++;
      continue;
    }
    const { error } = await supabase.from("appro_products").insert({ name, unit, primary_supplier_id: supplierIdByName[supplier] });
    if (error) { console.error(`INSERT ERROR (${name})`, error); process.exit(1); }
    existingNames.add(name); // évite un doublon si le même nom existe chez 2 fournisseurs testés dans la même passe
    created++;
    perSupplier[supplier].created++;
  }

  console.log("");
  for (const [supplier, counts] of Object.entries(perSupplier)) {
    console.log(`${supplier} : ${counts.created} créé(s), ${counts.skipped} déjà présent(s) (ignoré)`);
  }
  console.log(`\n${created} produit(s) créé(s), ${skipped} ignoré(s) (déjà en base).`);
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
