// Outil local (pas branché à l'appli) : lit les factures PDF déposées sous
// factures-fournisseurs/<fournisseur>/ et affiche le texte brut extrait de
// chacune, pour identifier ensemble le format de chaque fournisseur avant
// d'automatiser l'extraction produit/quantité/prix (base de la Phase 2 du
// module Approvisionnement).
//
// Usage : node scripts/extract-invoices.mjs [nom-du-sous-dossier]
//   node scripts/extract-invoices.mjs            -> tous les fournisseurs
//   node scripts/extract-invoices.mjs sysco      -> uniquement factures-fournisseurs/sysco/

import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const ROOT = path.join(process.cwd(), "factures-fournisseurs");
const onlySupplier = process.argv[2];

async function extractOne(filePath) {
  const data = fs.readFileSync(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function main() {
  if (!fs.existsSync(ROOT)) {
    console.error(`Dossier introuvable : ${ROOT}`);
    process.exit(1);
  }

  const supplierDirs = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => !onlySupplier || d.name === onlySupplier);

  if (supplierDirs.length === 0) {
    console.log(onlySupplier ? `Aucun sous-dossier "${onlySupplier}" sous factures-fournisseurs/.` : "Aucun sous-dossier fournisseur trouvé.");
    return;
  }

  for (const dir of supplierDirs) {
    const supplierPath = path.join(ROOT, dir.name);
    const pdfFiles = fs.readdirSync(supplierPath).filter((f) => f.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      console.log(`\n=== ${dir.name} — aucune facture déposée pour l'instant ===`);
      continue;
    }
    for (const file of pdfFiles) {
      const filePath = path.join(supplierPath, file);
      console.log(`\n${"=".repeat(70)}`);
      console.log(`FOURNISSEUR : ${dir.name}  —  FICHIER : ${file}`);
      console.log("=".repeat(70));
      try {
        const text = await extractOne(filePath);
        console.log(text.trim());
      } catch (err) {
        console.error(`Échec de l'extraction pour ${file} :`, err.message);
      }
    }
  }
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
