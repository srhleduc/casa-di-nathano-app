// Parseur local (pas branché à l'appli) pour les factures France Boissons.
//
// Format observé : 2 ou 3 lignes par produit —
//   <code> <désignation> <colis> <cols> <PU HTT>
//   [Rem/majo article % ... | Remise commerciale article ...]   <- optionnelle
//   Prix net <PU net> [<extra: consignes/droits...>] <Montant net HT> <TVA code>
//
// Exemple :
//   10074 EVIAN VC 12X100CL 1 12 1,3036
//   Rem/majo article % 19.00-% 1,303 -0,248
//   Prix net 1,0561 12,67 4,20 4,20 5
//
// "Cols" (2e nombre après la désignation) = quantité totale d'unités reçues.
// Le dernier nombre de la ligne "Prix net" est toujours le code TVA, celui
// juste avant est toujours le montant net HT — quel que soit le nombre de
// valeurs intermédiaires (consignes, droits...), qu'on ignore pour l'instant.
//
// Note : les lignes "Frais administratifs X Y" (frais fixes, pas un produit)
// ne sont pas capturées ici — elles expliquent un petit écart entre la somme
// recalculée et le "Montant HT" imprimé sur la facture.
//
// Usage : node scripts/parse-france-boissons.mjs

import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import { pathToFileURL } from "node:url";

const DIR = path.join(process.cwd(), "factures-fournisseurs", "france-boissons");

// Deux formes observées : la plupart des produits ont "Colis" ET "Cols"
// (ex. 1 carton de 12 = 12 unités), mais certains (ex. LA FRENCH GINGER
// BEER, MAJORATION LOGISTIQUE) n'ont qu'une seule quantité — on essaie la
// forme à 2 nombres en premier, la forme à 1 nombre en repli.
const HEADER_LINE_COLIS_COLS = /^(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+([\d,]+)$/;
const HEADER_LINE_QTY_ONLY = /^(\d+)\s+(.+?)\s+(\d+)\s+([\d,]+)$/;
const PRIX_NET_LINE = /^Prix net\s+([\d,]+)\s+(.+)$/;

export function parseInvoiceText(text, fileName) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const rows = [];
  let pending = null; // { code, label, colis, cols, puHtt }

  for (const line of lines) {
    const headerMatch5 = line.match(HEADER_LINE_COLIS_COLS);
    const headerMatch4 = !headerMatch5 ? line.match(HEADER_LINE_QTY_ONLY) : null;
    const prixNetMatch = line.match(PRIX_NET_LINE);

    if (prixNetMatch && pending) {
      const puNet = parseFloat(prixNetMatch[1].replace(",", "."));
      const restTokens = prixNetMatch[2].trim().split(/\s+/);
      const tvaCode = restTokens[restTokens.length - 1];
      const numericTokens = restTokens.slice(0, -1).map((t) => parseFloat(t.replace(",", ".")));
      // Le nombre de valeurs entre PU net et le code TVA varie : une "Droits"
      // (éco-participation) par unité s'ajoute parfois à PU net avant
      // multiplication par la quantité, et une consigne (PU + montant) peut
      // suivre le vrai montant net HT. On teste chaque position candidate
      // avec les deux hypothèses (avec/sans droits précédents) plutôt que de
      // supposer une position fixe — ça s'est révélé faux pour les fûts.
      const expectedNoDroits = Math.round(puNet * pending.cols * 100) / 100;
      let montantNetHT;
      let uncertain = false;
      for (let i = 0; i < numericTokens.length; i++) {
        const candidate = numericTokens[i];
        if (Math.abs(candidate - expectedNoDroits) <= 0.05) {
          montantNetHT = candidate;
          break;
        }
        if (i > 0) {
          const expectedWithDroits = Math.round((puNet + numericTokens[i - 1]) * pending.cols * 100) / 100;
          if (Math.abs(candidate - expectedWithDroits) <= 0.05) {
            montantNetHT = candidate;
            break;
          }
        }
      }
      if (montantNetHT === undefined) {
        montantNetHT = numericTokens[numericTokens.length - 1];
        uncertain = true;
      }
      rows.push({
        invoiceFile: fileName,
        code: pending.code,
        productLabel: pending.label,
        quantity: pending.cols,
        unitPriceNetHT: puNet,
        totalHT: montantNetHT,
        tvaCode,
        uncertain,
      });
      pending = null;
      continue;
    }

    if (headerMatch5) {
      // Une nouvelle ligne "code désignation colis cols PU" écrase toute
      // ligne "pending" non résolue (design produit sans ligne Prix net
      // associée trouvée avant — ne devrait pas arriver sur ce format).
      const [, code, label, colis, cols, puHtt] = headerMatch5;
      pending = { code, label: label.trim(), colis: parseInt(colis, 10), cols: parseInt(cols, 10), puHtt: parseFloat(puHtt.replace(",", ".")) };
    } else if (headerMatch4) {
      const [, code, label, qty, puHtt] = headerMatch4;
      pending = { code, label: label.trim(), colis: parseInt(qty, 10), cols: parseInt(qty, 10), puHtt: parseFloat(puHtt.replace(",", ".")) };
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
    console.log("Aucune facture France Boissons déposée pour l'instant.");
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
    // "Frais administratifs" est un frais fixe (pas un produit avec
    // quantité/unité), volontairement exclu du tableau produits mais compté
    // ici pour que le rapprochement avec le total imprimé soit complet.
    // Certains PDF (noms au pluriel, ex. "Factures mai 2026") regroupent en
    // fait PLUSIEURS factures à la suite — on additionne alors chaque
    // "Frais administratifs"/"Montant HT" rencontré.
    const adminFeeTotal = [...text.matchAll(/Frais administratifs\s+([\d,]+)/g)].reduce((s, m) => s + parseFloat(m[1].replace(",", ".")), 0);
    const printedMatches = [...text.matchAll(/Montant HT\s+([\d\s]+,\d{2})/g)];
    const printedTotal = printedMatches.reduce((s, m) => s + parseFloat(m[1].replace(/\s/g, "").replace(",", ".")), 0);
    const nbFactures = printedMatches.length;
    const grandTotal = totalRecalc + adminFeeTotal;
    console.log(
      `${file} (${nbFactures} facture${nbFactures > 1 ? "s" : ""}) : ${rows.length} ligne(s) produit, total recalculé = ${totalRecalc.toFixed(2)}` +
        (adminFeeTotal ? ` + ${adminFeeTotal.toFixed(2)} frais admin.` : "") +
        ` = ${grandTotal.toFixed(2)} (imprimé "Montant HT" cumulé = ${printedTotal.toFixed(2)}, écart = ${(printedTotal - grandTotal).toFixed(2)})`
    );
  }

  console.log("");
  console.table(
    allRows.map((r) => ({
      Facture: r.invoiceFile,
      Code: r.code,
      Produit: r.productLabel,
      Qté: r.quantity,
      "PU Net HT": r.unitPriceNetHT,
      "Total HT": r.totalHT,
      TVA: r.tvaCode,
      "⚠️": r.uncertain ? "à vérifier" : "",
    }))
  );
  const uncertainCount = allRows.filter((r) => r.uncertain).length;
  console.log(`\n${allRows.length} ligne(s) produit extraite(s) sur ${pdfFiles.length} facture(s), dont ${uncertainCount} à vérifier manuellement.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Erreur :", err);
    process.exit(1);
  });
}
