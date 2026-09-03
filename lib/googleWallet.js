// Google Wallet — helpers SERVEUR UNIQUEMENT (ne jamais importer côté client :
// lit la clé du compte de service GOOGLE_WALLET_SA_KEY).
//
// Deux usages :
//   - buildSaveUrl()        : lien "Save to Google Wallet" (JWT skinny signé,
//                             aucun appel REST — Google crée/màj l'objet au clic)
//   - patchLoyaltyPoints()  : PATCH REST sur un objet déjà existant pour
//                             resynchroniser le solde affiché sur la carte.
//
// Aucune dépendance lourde : le token OAuth du PATCH est obtenu via un
// JWT-bearer signé avec `jsonwebtoken` (déjà installé).

import jwt from "jsonwebtoken";

const ISSUER_ID = "3388000000023181954";
const CLASS_ID = `${ISSUER_ID}.casa_loyalty`;
const POINTS_LABEL = "Points";
const PROGRAM_HEADER = "Casa Fidélité";
// Palier = 1 bon de 5 € tous les 150 points, cumulable. Règle définie côté
// base par loyalty_reward_palier_150() dans supabase/schema.sql : on ne fait
// que la relire ici (floor(solde / 150)) pour détecter un franchissement.
const POINTS_PER_REWARD = 150;
const OAUTH_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";

// Google n'accepte que [A-Za-z0-9._-] dans l'identifiant d'objet. Les UUID
// Supabase passent tels quels ; on assainit par prudence.
function safeId(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, "_");
}

export function walletObjectId(customerId) {
  return `${ISSUER_ID}.casa_loyalty_${safeId(customerId)}`;
}

function getServiceAccount() {
  const raw = process.env.GOOGLE_WALLET_SA_KEY;
  if (!raw) throw new Error("GOOGLE_WALLET_SA_KEY absente");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_WALLET_SA_KEY n'est pas un JSON valide");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_WALLET_SA_KEY : client_email ou private_key manquant");
  }
  return parsed;
}

function buildLoyaltyObject({ customerId, nom, soldePoints }) {
  return {
    id: walletObjectId(customerId),
    classId: CLASS_ID,
    state: "ACTIVE",
    accountName: nom || "Client Casa",
    accountId: String(customerId),
    loyaltyPoints: {
      label: POINTS_LABEL,
      balance: { int: Number(soldePoints) || 0 },
    },
    barcode: {
      type: "QR_CODE",
      value: String(customerId),
      alternateText: String(customerId),
    },
  };
}

// Lien "Ajouter à Google Wallet". L'objet est décrit inline (JWT skinny) :
// aucun appel réseau ici, Google crée l'objet s'il n'existe pas ou le met à
// jour au moment du clic.
export function buildSaveUrl({ customerId, nom, soldePoints }) {
  const sa = getServiceAccount();
  const claims = {
    iss: sa.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [],
    payload: {
      loyaltyObjects: [buildLoyaltyObject({ customerId, nom, soldePoints })],
    },
  };
  const token = jwt.sign(claims, sa.private_key, { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}

// --- PATCH REST : resynchronise le solde sur un objet déjà ajouté ----------

let cachedToken = null; // { value, expiresAt }

async function getIssuerAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.value;
  }
  const sa = getServiceAccount();
  const iat = Math.floor(now / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: OAUTH_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    },
    sa.private_key,
    { algorithm: "RS256" }
  );

  const res = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth Google ${res.status}: ${await safeText(res)}`);
  }
  const json = await res.json();
  cachedToken = {
    value: json.access_token,
    expiresAt: now + (json.expires_in || 3600) * 1000,
  };
  return cachedToken.value;
}

// Renvoie 'ok' (solde poussé), 'skipped' (objet inexistant = pass jamais
// ajouté) ou 'error' (loggé). Ne lève jamais : l'appelant est fire-and-forget.
export async function patchLoyaltyPoints(customerId, soldePoints) {
  try {
    const token = await getIssuerAccessToken();
    const objectId = walletObjectId(customerId);
    const res = await fetchWithTimeout(
      `${WALLET_API}/loyaltyObject/${encodeURIComponent(objectId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loyaltyPoints: {
            label: POINTS_LABEL,
            balance: { int: Number(soldePoints) || 0 },
          },
        }),
      }
    );
    if (res.ok) return "ok";
    if (res.status === 404) return "skipped"; // objet pas encore créé côté Google
    console.error(
      `[wallet] PATCH ${objectId} → ${res.status}: ${await safeText(res)}`
    );
    return "error";
  } catch (err) {
    console.error("[wallet] patchLoyaltyPoints:", err?.message || err);
    return "error";
  }
}

// --- Notifications Wallet (loyaltyobject.addMessage) ----------------------
// Distinct du PATCH ci-dessus : addMessage pousse une vraie notification au
// client (bandeau + message dans la carte), là où le PATCH ne fait que
// rafraîchir silencieusement le solde affiché.

// Ajoute un message à l'objet fidélité du client. Réutilisable pour les deux
// cas (changement de solde / déblocage de bon). Mêmes garanties que
// patchLoyaltyPoints : 'ok' | 'skipped' (client sans Wallet) | 'error',
// ne lève jamais.
export async function addWalletMessage(customerId, header, body) {
  try {
    const token = await getIssuerAccessToken();
    const objectId = walletObjectId(customerId);
    const res = await fetchWithTimeout(
      `${WALLET_API}/loyaltyObject/${encodeURIComponent(objectId)}/addMessage`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: { header, body } }),
      }
    );
    if (res.ok) return "ok";
    if (res.status === 404) return "skipped"; // objet pas encore créé côté Google
    console.error(
      `[wallet] addMessage ${objectId} → ${res.status}: ${await safeText(res)}`
    );
    return "error";
  } catch (err) {
    console.error("[wallet] addWalletMessage:", err?.message || err);
    return "error";
  }
}

// Nombre de bons palier franchis en passant de `prevSolde` à `newSolde`.
// Relit la règle floor(solde / 150) de loyalty_reward_palier_150().
function rewardsUnlocked(prevSolde, newSolde) {
  const before = Math.floor((Number(prevSolde) || 0) / POINTS_PER_REWARD);
  const after = Math.floor((Number(newSolde) || 0) / POINTS_PER_REWARD);
  return Math.max(0, after - before);
}

// Point d'entrée unique après un gain de points, à brancher aux mêmes endroits
// que patchLoyaltyPoints (commande / caisse / ajout manuel). Fait le PATCH
// silencieux du solde PUIS envoie AU PLUS UN message :
//   - déblocage de bon si un multiple de 150 vient d'être franchi (prioritaire) ;
//   - sinon, message court "Nouveau solde" si le solde a changé.
// Jamais les deux (pas de double notification pour un même événement).
// Fire-and-forget côté appelant ; ne lève jamais.
export async function syncWalletAfterPointsChange(customerId, newSolde, pointsAdded = 0) {
  const patch = await patchLoyaltyPoints(customerId, newSolde);
  // Client sans Wallet : rien à notifier (échec silencieux attendu).
  if (patch === "skipped") return { patch, message: "skipped" };

  const prevSolde = Number(newSolde) - (Number(pointsAdded) || 0);
  const unlocked = rewardsUnlocked(prevSolde, newSolde);

  let message = "none";
  if (unlocked > 0) {
    const bons = unlocked === 1 ? "un bon de 5 €" : `${unlocked} bons de 5 €`;
    message = await addWalletMessage(
      customerId,
      PROGRAM_HEADER,
      `Bravo ! Vous avez débloqué ${bons}`
    );
  } else if (Number(newSolde) !== prevSolde) {
    message = await addWalletMessage(
      customerId,
      PROGRAM_HEADER,
      `Nouveau solde : ${Number(newSolde)} points`
    );
  }
  return { patch, message };
}

// --- utilitaires ----------------------------------------------------------

async function fetchWithTimeout(url, options, ms = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "(corps illisible)";
  }
}
