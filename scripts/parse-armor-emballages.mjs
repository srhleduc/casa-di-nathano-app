// Parseur local (pas branché à l'appli) pour les factures Armor Emballages.
//
// Particularités du format :
// - Une facture regroupe PLUSIEURS blocs "Type de commande" (une livraison
//   chacun), chacun avec son propre en-tête de colonnes — même produit
//   (même référence) peut apparaître dans plusieurs blocs, ce sont bien des
//   lignes distinctes (livraisons séparées), pas des doublons à fusionner.
// - La désignation (Libellé) peut se couper sur 2 voire 3 lignes ; la/les
//   ligne(s) suivante(s) sans chiffres de fin de ligne sont rattachées au
//   produit précédent tant qu'elles ne sont pas un marqueur de structure
//   connu (en-tête, section taxes, totaux...).
// - Format d'une ligne produit :
//     <référence><espace><libellé...> <qté>,00 <unité> <prix un.>,XXXX
//       [<remise>% <PU net>,XXXX <montant>,XX]
//   Le bloc remise/PU net/montant est absent quand tout est à 0 (ex. cartons
//   fournis gratuitement) ; le montant vaut alors 0.
//
// Usage : node scripts/parse-armor-emballages.mjs

import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const DIR = path.join(process.cwd(), "factures-fournisseurs", "armor-emballages");

// Les grandes quantités/montants utilisent l'espace comme séparateur de
// milliers (ex. "9 000,00", "2 061,00") — d'où \d[\d\s]* plutôt que \d+.
// Le bloc remise (%) et le bloc PU net/Montant sont chacun indépendamment
// optionnels (une ligne peut avoir l'un sans l'autre).
const NUM = "\\d[\\d\\s]*,\\d{2,4}";
const PRODUCT_LINE = new RegExp(`^(.+?)\\s+(${NUM})\\s+([A-ZÀ-Ü]+)\\s+(${NUM})(?:\\s+(\\d+)%)?(?:\\s+(${NUM})\\s+(${NUM}))?$`);
const toNum = (s) => parseFloat(s.replace(/\s/g, "").replace(",", "."));

const NON_PRODUCT_STARTS = [
  "Type de commande",
  "SO N°",
  "Référence Libellé",
  "Taxes",
  "Date d'échéance",
  "Mode de règlement",
  "Remise",
  "Total",
  "Conditions",
  "N° de TVA",
  "CREDIT",
  "Page",
  "www",
  "Facture",
  "Référence FA",
  "Devise",
  "Code client",
  "Téléphone",
  "Si vous réglez",
  "Pour contacter",
  "Facturé à",
  "Expédié à",
  "Montant réglé",
  "Reste à régler",
];

function isNonProductLine(line) {
  return (
    NON_PRODUCT_STARTS.some((prefix) => line.startsWith(prefix)) ||
    line.startsWith("Suite") || // "Suite… Page 1 de 2"
    /^-- \d+ of \d+ --$/.test(line) || // marqueur de page ajouté par extract-invoices.mjs
    /^[A-Z]{1,3}\s+[\d\s]+,\d{2}\s+\d+%\s+[\d\s]+,\d{2}$/.test(line) // ligne "TN 2 178,49 20% 435,70" (récap taxes)
  );
}

function parseInvoiceText(text, fileName) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(PRODUCT_LINE);
    if (m) {
      const [, prefix, qtyStr, unit, prixUnStr, remStr, puNetStr, montantStr] = m;
      const tokens = prefix.split(/\s+/);
      const reference = tokens[0];
      const label = tokens.slice(1).join(" ");
      const qty = toNum(qtyStr);
      const prixUn = toNum(prixUnStr);
      const puNet = puNetStr ? toNum(puNetStr) : prixUn;
      const montant = montantStr ? toNum(montantStr) : 0;
      current = {
        invoiceFile: fileName,
        reference,
        productLabel: label,
        quantity: qty,
        unit,
        unitPriceNetHT: puNet,
        totalHT: montant,
        remisePct: remStr ? parseInt(remStr, 10) : 0,
      };
      rows.push(current);
      continue;
    }
    if (current && !isNonProductLine(line)) {
      current.productLabel += " " + line;
    } else if (isNonProductLine(line)) {
      current = null; // sortie du bloc produit courant, plus de rattachement possible
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
    console.log("Aucune facture Armor Emballages déposée pour l'instant.");
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
    const printedMatch = text.match(/Total HT\s*:\s*([\d\s]+,\d{2})/);
    const printed = printedMatch ? toNum(printedMatch[1]) : null;
    console.log(
      `${file} : ${rows.length} ligne(s) produit, total recalculé = ${totalRecalc.toFixed(2)}` +
        (printed !== null ? ` (imprimé "Total HT" = ${printed.toFixed(2)}, écart = ${(printed - totalRecalc).toFixed(2)})` : " (total imprimé introuvable)")
    );
  }

  console.log("");
  console.table(
    allRows.map((r) => ({
      Facture: r.invoiceFile,
      Réf: r.reference,
      Produit: r.productLabel,
      Qté: r.quantity,
      Unité: r.unit,
      "PU Net HT": r.unitPriceNetHT,
      "Total HT": r.totalHT,
    }))
  );
  console.log(`\n${allRows.length} ligne(s) produit extraite(s) sur ${pdfFiles.length} facture(s).`);
}

main().catch((err) => {
  console.error("Erreur :", err);
  process.exit(1);
});
