// Parseur local (pas branché à l'appli) pour les factures Danioli.
//
// Format observé (constant sur les factures test, y compris à cheval sur
// un saut de page) : chaque ligne produit commence par un code article à
// 6 chiffres, suivi de la désignation libre, puis Quantité (3 décimales),
// Montant HT (2 décimales), P.U. Net HT (3 décimales), et en option une
// quantité d'alcool pur + un code TVA (1 chiffre : 0=0%, 1=20%, 2=5.5%)
// pour les produits alcoolisés (bières, vins, limoncello...).
//   301413 Tomates Pélées S. Marzano 3/1 12,000 89,40  7,450 2
//   404020 Bière Nazionale Blonde 33 cl (Baladin) 12,000 28,20  2,350 0,26  1
//
// Usage : node scripts/parse-danioli.mjs

import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const DIR = path.join(process.cwd(), "factures-fournisseurs", "danioli");

// code / désignation / qté,3déc / montant,2déc / PU net,3déc / reste optionnel
const PRODUCT_LINE = /^(\d{6})\s+(.+?)\s+(\d+,\d{3})\s+(\d+,\d{2})\s+(\d+,\d{3})(?:\s+(.*))?$/;
const VAT_LABEL = { 0: "0%", 1: "20%", 2: "5.5%" };

function parseInvoiceText(text, fileName) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  // Filename FC<code client>_<n° facture>.pdf
  const invoiceNumber = (fileName.match(/FC\d+_(\d+)/) || [null, null])[1];

  const rows = [];
  for (const line of lines) {
    const m = line.match(PRODUCT_LINE);
    if (!m) continue;
    const [, code, label, qty, montant, puNet, rest] = m;
    // Le reste (optionnel) contient le code TVA en dernier — le reconnaître
    // seulement s'il s'agit bien d'un chiffre 0/1/2 isolé.
    const restParts = (rest || "").trim().split(/\s+/).filter(Boolean);
    const vatCode = restParts.find((p) => /^[012]$/.test(p));
    rows.push({
      invoiceFile: fileName,
      invoiceNumber,
      code,
      productLabel: label.trim(),
      quantity: parseFloat(qty.replace(",", ".")),
      totalHT: parseFloat(montant.replace(",", ".")),
      unitPriceNetHT: parseFloat(puNet.replace(",", ".")),
      vatPct: vatCode !== undefined ? VAT_LABEL[vatCode] : null,
    });
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
    console.log("Aucune facture Danioli déposée pour l'instant.");
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
    const rows = parseInvoiceText(text, file);
    allRows.push(...rows);
    const totalRecalc = rows.reduce((s, r) => s + r.totalHT, 0);
    console.log(`${file} : ${rows.length} ligne(s), total HT recalculé = ${totalRecalc.toFixed(2)}`);
  }

  console.log("");
  console.table(
    allRows.map((r) => ({
      Facture: r.invoiceNumber,
      Code: r.code,
      Produit: r.productLabel,
      Qté: r.quantity,
      "Total HT": r.totalHT,
      "PU Net HT": r.unitPriceNetHT,
      TVA: r.vatPct,
    }))
  );
  console.log(`\n${allRows.length} ligne(s) produit extraite(s) sur ${pdfFiles.length} facture(s).`);
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
