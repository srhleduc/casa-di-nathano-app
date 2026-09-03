// LOCAL uniquement. Enregistre (ou met à jour) l'URL de callback Google Wallet
// sur la classe casa_loyalty via callbackOptions.url. À relancer si l'URL
// change. Idempotent : un PATCH avec la même URL ne fait rien de plus.
//
// Le callback est défini AU NIVEAU CLASSE (une seule URL, partagée par les
// deux restaurants — base fidélité commune).
//
// Usage : node scripts/register-wallet-callback.mjs
// Lit GOOGLE_WALLET_SA_KEY dans .env.local.

import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(process.cwd() + "/package.json");
const jwt = require("jsonwebtoken");

const CLASS_ID = "3388000000023181954.casa_loyalty";
const CALLBACK_URL = "https://casa-di-nathano-app.vercel.app/api/wallet/callback";
const WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";

const env = Object.fromEntries(
  fs
    .readFileSync(process.cwd() + "/.env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if (v.length >= 2 && (v[0] === "'" || v[0] === '"') && v[v.length - 1] === v[0]) v = v.slice(1, -1);
      return [l.slice(0, i).trim(), v];
    })
);

const sa = JSON.parse(env.GOOGLE_WALLET_SA_KEY);

async function accessToken() {
  const iat = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    },
    sa.private_key,
    { algorithm: "RS256" }
  );
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("OAuth KO : " + JSON.stringify(j));
  return j.access_token;
}

const token = await accessToken();
const H = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

// L'API Wallet refuse un PATCH sur une classe déjà "approved" sans reviewStatus
// explicite ("Invalid review status APPROVED. Use UNDER_REVIEW instead."). On
// repasse donc reviewStatus à UNDER_REVIEW : Google continue de servir la
// dernière version approuvée aux passes existants pendant qu'il re-valide le
// changement (ajout du callback).
const patch = await fetch(`${WALLET_API}/loyaltyClass/${encodeURIComponent(CLASS_ID)}`, {
  method: "PATCH",
  headers: H,
  body: JSON.stringify({
    reviewStatus: "UNDER_REVIEW",
    callbackOptions: { url: CALLBACK_URL },
  }),
});
console.log("PATCH loyaltyClass ->", patch.status);
if (!patch.ok) {
  console.error(await patch.text());
  process.exit(1);
}

const check = await fetch(`${WALLET_API}/loyaltyClass/${encodeURIComponent(CLASS_ID)}`, { headers: H });
const cls = await check.json();
console.log("callbackOptions =", JSON.stringify(cls.callbackOptions || null));
