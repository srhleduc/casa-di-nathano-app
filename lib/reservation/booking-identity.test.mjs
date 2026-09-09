// Tests identification client /reserver. Lancer : node lib/reservation/booking-identity.test.mjs
import { normalizePhone, nameTokens, nameMatches, findUpcomingReservations } from "./booking-identity.js";

let passed = 0;
let failed = 0;
function ok(cond, name) {
  if (cond) passed++;
  else {
    failed++;
    console.error("  ✗ " + name);
  }
}

// --- normalizePhone ---
ok(normalizePhone("06 12 34 56 78") === "612345678", "espaces retirés, 9 chiffres");
ok(normalizePhone("+33 6 12 34 56 78") === "612345678", "+33 → 0X puis 9 derniers");
ok(normalizePhone("0033612345678") === "612345678", "0033 → 0X");
ok(normalizePhone("06.12.34.56.78") === normalizePhone("0612345678"), "séparateurs indifférents");
ok(normalizePhone("") === "" && normalizePhone(null) === "", "vide toléré");

// --- nameTokens ---
ok(JSON.stringify(nameTokens("Sarah Dufour")) === JSON.stringify(["sarah", "dufour"]), "prénom + nom");
ok(JSON.stringify(nameTokens("Dufour ou Tellier")) === JSON.stringify(["dufour", "tellier"]), "« ou » retiré");
ok(JSON.stringify(nameTokens("Éléonore d'Arc")) === JSON.stringify(["eleonore", "arc"]), "accents + apostrophe");

// --- nameMatches ---
ok(nameMatches("Dufour", "Sarah Dufour"), "prénom + nom valide un nom seul");
ok(nameMatches("Dufour ou Tellier", "tellier"), "l'un des deux noms d'un couple");
ok(nameMatches("Dufour ou Tellier", "DUFOUR"), "casse indifférente");
ok(!nameMatches("Dufour", "Martin"), "nom totalement différent → non");
ok(!nameMatches("Dufour", ""), "nom vide → non");
ok(!nameMatches("Dufour", "  "), "espaces seuls → non");

// --- findUpcomingReservations ---
{
  const rows = [
    { id: "a", customerName: "Dufour", customerPhone: "06 12 34 56 78", status: "confirmed", requestedAt: "2026-09-20T19:00:00" },
    { id: "b", customerName: "Dufour", customerPhone: "0612345678", status: "confirmed", requestedAt: "2026-09-10T12:30:00" }, // passée
    { id: "c", customerName: "Dupont ou Martin", customerPhone: "06 99 99 99 99", status: "confirmed", requestedAt: "2026-09-25T20:00:00" },
    { id: "d", customerName: "Dufour", customerPhone: "0612345678", status: "cancelled", requestedAt: "2026-09-21T19:00:00" },
  ];
  const now = "2026-09-15T14:00:00";

  const r1 = findUpcomingReservations(rows, { phone: "+33612345678", name: "sarah dufour", nowWall: now });
  ok(r1.matches.length === 1 && r1.matches[0].id === "a", "futur + confirmé + tel + nom → 1 (passée/annulée exclues)");

  const r2 = findUpcomingReservations(rows, { phone: "0612345678", name: "Martin", nowWall: now });
  ok(r2.matches.length === 0 && r2.phoneOnly === true, "bon tel, mauvais nom → phoneOnly");

  const r3 = findUpcomingReservations(rows, { phone: "0699999999", name: "martin", nowWall: now });
  ok(r3.matches.length === 1 && r3.matches[0].id === "c", "couple « Dupont ou Martin » retrouvé par « martin »");

  const r4 = findUpcomingReservations(rows, { phone: "0102030405", name: "Dufour", nowWall: now });
  ok(r4.matches.length === 0 && r4.phoneOnly === false, "téléphone inconnu → rien, pas phoneOnly");
}

console.log(`\nbooking-identity: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
