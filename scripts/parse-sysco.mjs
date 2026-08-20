// Parseur local (pas branché à l'appli) pour les factures Sysco.
//
// Format observé (une ligne par produit, colonnes bien tassées) :
//   <cartons> [sous-cart ex "0BC"] <type ex "SI N"/"FI T"> <code 5 chiffres>
//   <désignation libre> <état S/H/F/A> <qté>,000 <unité ex BC/KG>
//   <PU net>,000 <code TVA 1 chiffre> <montant HT>
//
// Exemple :
//   1 0BC SI N 77537 C/G PISTACHIO MVPK BC1.385KG-2.4L X2 S 2,000 BC 18,000 1 36,00
//
// Le préfixe (cartons/sous-cart/type) est trop variable pour être capturé
// précisément — on ancre plutôt sur la partie FIABLE en fin de ligne (état,
// qté, unité, PU net, TVA, montant) via un motif générique, puis on retrouve
// le code produit comme le premier nombre à 5 chiffres isolé dans ce qui
// reste, la désignation étant tout ce qui suit ce code.
// Montant HT = PU net x quantité (vérifié, aucune surprise type "Droits"
// contrairement à France Boissons).
//
// "Participation aux frais énergétiques X" est un frais fixe (pas un
// produit) qu'on additionne séparément pour le rapprochement du total.
//
// Usage : node scripts/parse-sysco.mjs

import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const DIR = path.join(process.cwd(), "factures-fournisseurs", "sysco");

const TAIL_LINE = /^(.*?)\s+([SHFA])\s+(\d+,\d{3})\s+([A-Z]+)\s+(\d+,\d{3})\s+(\d)\s+(\d+,\d{2})$/;
const CODE_IN_PREFIX = /(?:^|\s)(\d{5})(?:\s|$)/;

function parseInvoiceText(text, fileName) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = [];

  for (const line of lines) {
    const m = line.match(TAIL_LINE);
    if (!m) continue;
    const [, prefix, etat, qtyStr, unit, puNetStr, tvaCode, montantStr] = m;
    const codeMatch = prefix.match(CODE_IN_PREFIX);
    if (!codeMatch) continue; // pas une vraie ligne produit (ex. ligne de total qui coïncide par hasard)
    const code = codeMatch[1];
    const label = prefix.slice(codeMatch.index + codeMatch[0].length).trim() || prefix.slice(0, codeMatch.index).trim();

    const qty = parseFloat(qtyStr.replace(",", "."));
    const puNet = parseFloat(puNetStr.replace(",", "."));
    const montant = parseFloat(montantStr.replace(",", "."));
    const expected = Math.round(qty * puNet * 100) / 100;
    rows.push({
      invoiceFile: fileName,
      code,
      productLabel: label,
      etat,
      quantity: qty,
      unit,
      unitPriceNetHT: puNet,
      totalHT: montant,
      tvaCode,
      uncertain: Math.abs(montant - expected) > 0.05,
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
    console.log("Aucune facture Sysco déposée pour l'instant.");
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
    const feeMatch = text.match(/Participation aux frais énergétiques\s+([\d,]+)/);
    const fee = feeMatch ? parseFloat(feeMatch[1].replace(",", ".")) : 0;
    // "TOTAL H.T." de la facture = somme des BASE H.T. par code TVA, sur les
    // lignes "<code TVA> <taux%> <base HT> <montant TVA>" qui précèdent
    // "TOTAL T.V.A." — la colonne TOTAL H.T. individuelle ne s'imprime pas
    // sur toutes les lignes après l'aplatissement du texte.
    const tvaRows = [...text.matchAll(/^(\d)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)(?:\s+[\d,]+)?$/gm)];
    const printed = tvaRows.length ? tvaRows.reduce((s, m) => s + parseFloat(m[3].replace(",", ".")), 0) : null;
    const grandTotal = totalRecalc + fee;
    console.log(
      `${file} : ${rows.length} ligne(s) produit, total recalculé = ${totalRecalc.toFixed(2)}` +
        (fee ? ` + ${fee.toFixed(2)} frais énergétiques` : "") +
        ` = ${grandTotal.toFixed(2)}` +
        (printed !== null ? ` (imprimé TOTAL H.T. = ${printed.toFixed(2)}, écart = ${(printed - grandTotal).toFixed(2)})` : " (total imprimé introuvable)")
    );
  }

  console.log("");
  console.table(
    allRows.map((r) => ({
      Facture: r.invoiceFile,
      Code: r.code,
      Produit: r.productLabel,
      État: r.etat,
      Qté: r.quantity,
      Unité: r.unit,
      "PU Net HT": r.unitPriceNetHT,
      "Total HT": r.totalHT,
      TVA: r.tvaCode,
      "⚠️": r.uncertain ? "à vérifier" : "",
    }))
  );
  const uncertainCount = allRows.filter((r) => r.uncertain).length;
  console.log(`\n${allRows.length} ligne(s) produit extraite(s) sur ${pdfFiles.length} facture(s), dont ${uncertainCount} à vérifier manuellement.`);
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
