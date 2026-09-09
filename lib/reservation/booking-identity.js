// Identification d'un client sur /reserver pour retrouver sa réservation
// (modifier / annuler) sans compte : téléphone + nom, correspondance souple.
// Pur, sans I/O.

// Ne garde que les chiffres ; +33X / 0033X → 0X ; renvoie les 9 derniers
// chiffres (tolère les formats "06 12 34 56 78", "+33 6 12...", etc.).
export function normalizePhone(s) {
  let d = String(s || "").replace(/\D/g, "");
  if (d.startsWith("0033")) d = "0" + d.slice(4);
  else if (d.startsWith("33") && d.length >= 11) d = "0" + d.slice(2);
  return d.slice(-9);
}

const STOPWORDS = new Set(["ou", "et", "de", "du", "des", "la", "le", "les", "d", "l", "a", "aux", "chez"]);

// Minuscules, sans accents, découpé en mots significatifs (≥ 2 lettres,
// hors mots-outils). "Sarah Dufour" → ["sarah","dufour"] ;
// "Dufour ou Tellier" → ["dufour","tellier"].
export function nameTokens(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

// true si le nom saisi partage au moins un mot avec le nom de la réservation.
// false si le nom saisi n'a aucun mot exploitable.
export function nameMatches(bookedName, typedName) {
  const typed = nameTokens(typedName);
  if (typed.length === 0) return false;
  const booked = new Set(nameTokens(bookedName));
  return typed.some((w) => booked.has(w));
}

// Réservations À VENIR d'un client, d'après téléphone + nom.
// `nowWall` : "YYYY-MM-DDTHH:MM:SS" heure murale locale (même repère que
// requested_at, cf. buildRequestedAtISO). On compare des chaînes ISO.
// Renvoie { matches, phoneOnly } — phoneOnly = le téléphone matche une résa
// future mais aucun nom ne correspond (→ message d'aide).
export function findUpcomingReservations(reservations, { phone, name, nowWall } = {}) {
  const wantPhone = normalizePhone(phone);
  const futureConfirmed = (reservations || []).filter(
    (r) => r && r.status === "confirmed" && String(r.requestedAt || "") > String(nowWall || "")
  );
  const phoneHits = wantPhone
    ? futureConfirmed.filter((r) => normalizePhone(r.customerPhone) === wantPhone)
    : [];
  const matches = phoneHits
    .filter((r) => nameMatches(r.customerName, name))
    .slice()
    .sort((a, b) => String(a.requestedAt).localeCompare(String(b.requestedAt)));
  return { matches, phoneOnly: matches.length === 0 && phoneHits.length > 0 };
}
