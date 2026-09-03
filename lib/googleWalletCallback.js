// Vérification de signature des callbacks Google Wallet (save / del) —
// SERVEUR UNIQUEMENT. Schéma "ECv2SigningOnly" : signature seule, pas de
// chiffrement. Tink n'existe pas pour Node.js, donc implémentation manuelle
// avec le module crypto natif (ECDSA P-256 / SHA-256, signatures DER).
//
// Chaîne de confiance :
//   1. clés racine Google (pay.google.com/gp/m/issuer/keys, cache ~1 h)
//      signent une "clé intermédiaire" éphémère fournie dans le callback ;
//   2. la clé intermédiaire signe le message.
// Bytes à signer = concat "length-prefixed" : pour chaque chaîne,
//   int32LE(longueur en octets) suivi des octets UTF-8.

import crypto from "node:crypto";

const KEYS_URL = "https://pay.google.com/gp/m/issuer/keys";
const SENDER_ID = "GooglePayPasses";
const PROTOCOL = "ECv2SigningOnly";
const ISSUER_ID = "3388000000023181954"; // = recipientId pour la vérif du message
const KEY_TTL_MS = 60 * 60 * 1000;

let keyCache = null; // { keys, fetchedAt }

async function getGoogleRootKeys() {
  const now = Date.now();
  if (keyCache && now - keyCache.fetchedAt < KEY_TTL_MS) return keyCache.keys;
  const res = await fetch(KEYS_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`clés Google ${res.status}`);
  const json = await res.json();
  keyCache = { keys: Array.isArray(json.keys) ? json.keys : [], fetchedAt: now };
  return keyCache.keys;
}

// int32LE(len) || bytes, concaténés
function lengthPrefixed(...parts) {
  const chunks = [];
  for (const part of parts) {
    const bytes = Buffer.from(String(part), "utf8");
    const len = Buffer.alloc(4);
    len.writeUInt32LE(bytes.length, 0);
    chunks.push(len, bytes);
  }
  return Buffer.concat(chunks);
}

function verifyEcdsa(publicKeyDer, data, signatureB64) {
  try {
    return crypto.verify(
      "sha256",
      data,
      { key: publicKeyDer, format: "der", type: "spki", dsaEncoding: "der" },
      Buffer.from(signatureB64, "base64")
    );
  } catch {
    return false;
  }
}

// Renvoie { classId, objectId, eventType, nonce, expTimeMillis } si la
// signature est valide et le message non expiré ; lève sinon.
export async function verifyGoogleWalletCallback(rawBody) {
  let body;
  try {
    body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  } catch {
    throw new Error("corps JSON invalide");
  }

  const { signature, protocolVersion, intermediateSigningKey, signedMessage } = body || {};
  if (protocolVersion !== PROTOCOL) {
    throw new Error(`protocolVersion inattendu : ${protocolVersion}`);
  }
  if (
    !signature ||
    typeof signedMessage !== "string" ||
    !intermediateSigningKey ||
    typeof intermediateSigningKey.signedKey !== "string" ||
    !Array.isArray(intermediateSigningKey.signatures)
  ) {
    throw new Error("champs de signature manquants");
  }

  const nowMs = Date.now();
  const roots = (await getGoogleRootKeys()).filter(
    (k) =>
      (!k.protocolVersion || k.protocolVersion === PROTOCOL) &&
      (!k.keyExpiration || Number(k.keyExpiration) > nowMs)
  );
  if (roots.length === 0) throw new Error("aucune clé racine Google active");

  // 1. clé intermédiaire signée par une clé racine
  const interSigned = lengthPrefixed(SENDER_ID, PROTOCOL, intermediateSigningKey.signedKey);
  const interOk = roots.some((root) => {
    const der = Buffer.from(root.keyValue, "base64");
    return intermediateSigningKey.signatures.some((sig) => verifyEcdsa(der, interSigned, sig));
  });
  if (!interOk) throw new Error("clé intermédiaire non vérifiée");

  let signedKey;
  try {
    signedKey = JSON.parse(intermediateSigningKey.signedKey);
  } catch {
    throw new Error("signedKey illisible");
  }
  if (signedKey.keyExpiration && Number(signedKey.keyExpiration) <= nowMs) {
    throw new Error("clé intermédiaire expirée");
  }

  // 2. message signé par la clé intermédiaire
  const msgSigned = lengthPrefixed(SENDER_ID, ISSUER_ID, PROTOCOL, signedMessage);
  const interDer = Buffer.from(signedKey.keyValue, "base64");
  if (!verifyEcdsa(interDer, msgSigned, signature)) {
    throw new Error("signature du message invalide");
  }

  let msg;
  try {
    msg = JSON.parse(signedMessage);
  } catch {
    throw new Error("signedMessage illisible");
  }
  if (msg.expTimeMillis && Number(msg.expTimeMillis) <= nowMs) {
    throw new Error("message expiré");
  }

  return {
    classId: msg.classId,
    objectId: msg.objectId,
    eventType: msg.eventType,
    nonce: msg.nonce,
    expTimeMillis: msg.expTimeMillis,
  };
}
