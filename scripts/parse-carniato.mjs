// Parseur local (pas branché à l'appli) pour les factures Carniato — le
// format le plus dense des 6 fournisseurs (document d'accompagnement fiscal
// accises alcool). Colonnes par produit, dans l'ordre observé :
//   CODE [2 chiffres régie collés, ex "01"] DESIGNATION CONTENANCE(ex 0,75L)
//   CARTONS PAR PRIX_TARIF LITRES_TOTAL DROITS(par unité) QUANTITE(bouteilles)
//   PU_NET CODE_TVA(ex A2) MONTANT_HT EAN
// Exemple : 5798 01SOAVE CLASSICO BOLLA DOC 0,75 2 6 5,25 9,00 0,03 12 5,25 A2 63,37 8 008960 687011
//
// La désignation se coupe parfois sur 2 lignes physiques (ex. "...VENEZIA"
// puis "DOC 0,75 5 6..." sur la ligne suivante) à un point imprévisible —
// plutôt que de gérer la coupure ligne par ligne, on aplatit tout le texte
// en une seule chaîne et on fait correspondre un motif global dessus : les
// sauts de ligne originaux n'ont alors plus d'importance.
//
// Montant HT ≈ quantité x (PU net + droits) — vérifié sur plusieurs lignes
// (léger écart d'arrondi possible, ~0,10 €). "PARTICIPATION AU TRANSPORT"
// et autres frais n'ont pas cette forme (pas de code/contenance) et ne sont
// donc jamais capturés comme produit.
//
// Usage : node scripts/parse-carniato.mjs

import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const DIR = path.join(process.cwd(), "factures-fournisseurs", "carniato");

// Le bloc contenance+litres+droits n'existe que pour les produits soumis
// aux accises (vin, bière...) — absent pour un "PACK" promo par exemple.
// P.U. net peut aussi être le mot "GRATUIT" (offert) plutôt qu'un prix.
const RECORD = new RegExp(
  [
    "(\\d{4,6})\\s+", // code produit
    "(?:\\d{2})?", // code régie collé, ex "01" (optionnel, pas d'espace avant la désignation)
    // La désignation DOIT commencer par une lettre (jamais un chiffre) —
    // sinon un fragment de code-barres EAN peut se faire passer pour un
    // nouveau produit et corrompre la ligne suivante.
    "([A-ZÀ-Ü][A-ZÀ-Ü0-9 '#+\\/&.\\-]*?)\\s+",
    "(?:(\\d[,.]\\d{2}\\s?L?)\\s+)?", // contenance, ex "0,75" / "0,75L" / "0,75 L" / "0.33 L" (optionnelle)
    "(\\d+)\\s+", // nombre de cartons
    "(?:[A-Z]\\d?\\s+)?", // indicateur régie isolé parfois présent (ex "R"), ignoré
    "(\\d+)\\s+", // bouteilles par carton
    "(\\d+,\\d{2})\\s+", // prix tarif
    "(?:(\\d+,\\d{2})\\s+(\\d+,\\d{2})\\s+)?", // litres total + droits par unité (optionnels, ensemble)
    "(\\d+)\\s+", // quantité
    "(\\d+,\\d{2}|GRATUIT)\\s+", // P.U. net, ou GRATUIT pour un article offert
    "([A-Z]\\d)\\s+", // code TVA, ex A2
    "(\\d+,\\d{2})", // montant HT
  ].join("")
);

function parseInvoiceText(text, fileName) {
  const flat = text.replace(/\s+/g, " ");
  const rows = [];
  let rest = flat;
  let offset = 0;
  let m;
  while ((m = RECORD.exec(rest.slice(offset)))) {
    const [full, code, label, contenance, cartons, par, prixTarif, litres, droits, qty, puNet, tvaCode, montant] = m;
    const quantity = parseInt(qty, 10);
    const puNetVal = puNet === "GRATUIT" ? 0 : parseFloat(puNet.replace(",", "."));
    const droitsVal = droits ? parseFloat(droits.replace(",", ".")) : 0;
    const montantVal = parseFloat(montant.replace(",", "."));
    const expected = Math.round(quantity * (puNetVal + droitsVal) * 100) / 100;
    rows.push({
      invoiceFile: fileName,
      code,
      productLabel: label.trim(),
      contenance: contenance ? contenance.replace(/\s/g, "") : null,
      cartons: parseInt(cartons, 10),
      parCarton: parseInt(par, 10),
      quantity,
      unitPriceNetHT: puNetVal,
      droits: droitsVal,
      tvaCode,
      totalHT: montantVal,
      uncertain: Math.abs(montantVal - expected) > 0.15,
    });
    offset += m.index + full.length;
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
    console.log("Aucune facture Carniato déposée pour l'instant.");
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
    // Rapprochement partiel : la ligne "TOTAL <droits> <marchandises> ..."
    // de la VENTILATION DES VENTES additionne droits+marchandises pour
    // chaque code TVA — on compare seulement à la somme des lignes produit
    // (les frais annexes type transport ne sont, eux, jamais capturés ici).
    const ventilationMatch = text.match(/TOTAL\s+(\d+,\d{2})\s+(\d+,\d{2})\s+(\d+,\d{2})/);
    const printed = ventilationMatch ? parseFloat(ventilationMatch[2].replace(",", ".")) + parseFloat(ventilationMatch[1].replace(",", ".")) : null;
    console.log(
      `${file} : ${rows.length} ligne(s) produit, total recalculé = ${totalRecalc.toFixed(2)}` +
        (printed !== null
          ? ` (marchandises+droits imprimé = ${printed.toFixed(2)}, écart = ${(printed - totalRecalc).toFixed(2)})`
          : " (ventilation introuvable)")
    );
  }

  console.log("");
  console.table(
    allRows.map((r) => ({
      Facture: r.invoiceFile,
      Code: r.code,
      Produit: r.productLabel,
      Contenance: r.contenance,
      Qté: r.quantity,
      "PU Net HT": r.unitPriceNetHT,
      Droits: r.droits,
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
