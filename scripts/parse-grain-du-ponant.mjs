// Parseur local (pas branché à l'appli) pour les factures Grain du Ponant —
// format le plus régulier des 6 fournisseurs, sert de premier brouillon
// avant d'attaquer les formats plus difficiles (base de la Phase 2).
//
// Format observé (constant sur les 3 factures test) :
//   Produit Désignation Qté P.U. HT % TVA Total HT   <- marqueur début de table
//   <NOM DU PRODUIT>                                  <- 1 ligne
//   [Numéro de lot : ... | Consigne : X €]            <- 0 ou 1 ligne optionnelle
//   <Qté> <PU> € <TVA%>% <Total> €                    <- ligne chiffrée
//   ... (répété par produit) ...
//   Total HT ...                                      <- marqueur fin de table
//
// Usage : node scripts/parse-grain-du-ponant.mjs

import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const DIR = path.join(process.cwd(), "factures-fournisseurs", "grain-du-ponant");

const NUMBERS_LINE = /^(\d+)\s+([\d]+[.,]\d+)\s*€\s+([\d]+[.,]\d+)%\s+([\d]+[.,]\d+)\s*€$/;
const START_MARKER = /^Produit Désignation Qté P\.U\. HT % TVA Total HT$/;
const END_MARKER = /^Total HT/;
const DATE_LINE = /Date d'édition\s*:\s*(\d{2}\/\d{2}\/\d{4})/;

function parseInvoiceText(text, fileName) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const dateMatch = text.match(DATE_LINE);
  const invoiceNumber = (fileName.match(/FA\d+/) || [null])[0];

  const startIdx = lines.findIndex((l) => START_MARKER.test(l));
  const endIdx = lines.findIndex((l, i) => i > startIdx && END_MARKER.test(l));
  if (startIdx === -1 || endIdx === -1) {
    console.error(`  ⚠️  Marqueurs de table introuvables dans ${fileName} — ligné ignorée.`);
    return [];
  }

  const rows = [];
  let buffer = [];
  for (let i = startIdx + 1; i < endIdx; i++) {
    const line = lines[i];
    const m = line.match(NUMBERS_LINE);
    if (m) {
      rows.push({
        invoiceFile: fileName,
        invoiceNumber,
        date: dateMatch ? dateMatch[1] : null,
        productLabel: buffer.join(" — "),
        quantity: parseInt(m[1], 10),
        unitPriceHT: parseFloat(m[2].replace(",", ".")),
        vatPct: parseFloat(m[3].replace(",", ".")),
        totalHT: parseFloat(m[4].replace(",", ".")),
      });
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  return rows;
}

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`Dossier introuvable : ${DIR}`);
    process.exit(1);
  }
  const pdfFiles = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  if (pdfFiles.length === 0) {
    console.log("Aucune facture Grain du Ponant déposée pour l'instant.");
    return;
  }

  const allRows = [];
  for (const file of pdfFiles) {
    const filePath = path.join(DIR, file);
    const data = fs.readFileSync(filePath);
    const parser = new PDFParse({ data });
    let text;
    try {
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
    allRows.push(...parseInvoiceText(text, file));
  }

  console.table(
    allRows.map((r) => ({
      Facture: r.invoiceNumber,
      Date: r.date,
      Produit: r.productLabel,
      Qté: r.quantity,
      "PU HT": r.unitPriceHT,
      "TVA %": r.vatPct,
      "Total HT": r.totalHT,
    }))
  );
  console.log(`\n${allRows.length} ligne(s) produit extraite(s) sur ${pdfFiles.length} facture(s).`);
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
