"use client";

// Page client PUBLIQUE — le client consulte son solde de points et ajoute sa
// carte Google Wallet lui-même. Vérification légère (téléphone + nom de
// famille) côté /api/mon-compte, pas de vraie auth. Direction artistique
// reprise de l'app (Fraunces / Manrope, fond dégradé chaud, terracotta + or).

import { useState } from "react";

const PAGE_BG =
  "radial-gradient(ellipse at 50% -10%, #3a2013 0%, #1a120b 55%, #120c07 100%)";
const CARD = { background: "#211712", border: "1px solid #3a2b1f" };
const INPUT = {
  background: "#140d08",
  border: "1px solid #3a2b1f",
  color: "#f5ebdd",
};
const PRIMARY = {
  background: "#C0392B",
  color: "#fff5ea",
  boxShadow: "0 10px 24px rgba(192,57,43,0.35)",
};

export default function MonComptePage() {
  const [phone, setPhone] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { soldePoints, saveUrl }

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch("/api/mon-compte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, lastName }),
      });
      if (res.status === 429) {
        setStatus("error");
        setError("Trop de tentatives. Réessayez dans quelques minutes.");
        return;
      }
      const data = await res.json();
      if (res.ok && data.found) {
        setResult({ soldePoints: data.soldePoints, saveUrl: data.saveUrl });
        setStatus("idle");
        return;
      }
      if (res.ok && data.found === false) {
        setStatus("error");
        setError("Numéro de téléphone ou nom incorrect.");
        return;
      }
      setStatus("error");
      setError("Une erreur est survenue. Réessayez.");
    } catch {
      setStatus("error");
      setError("Une erreur est survenue. Réessayez.");
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setStatus("idle");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: PAGE_BG,
        color: "#f5ebdd",
        fontFamily: "var(--font-manrope), sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <header style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 4 }}>🌿</div>
          <h1
            className="display-font"
            style={{ fontSize: 30, fontWeight: 600, margin: "0 0 6px" }}
          >
            Ma carte fidélité
          </h1>
          <p style={{ color: "#c9b8a4", fontSize: 14, margin: 0 }}>
            1 point par euro dépensé · un bon de 5 € tous les 150 points
          </p>
        </header>

        <div style={{ ...CARD, borderRadius: 20, padding: 22 }}>
          {result ? (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#a88f78",
                  fontWeight: 700,
                }}
              >
                Votre solde
              </div>
              <div
                className="display-font"
                style={{ fontSize: 52, fontWeight: 700, color: "#E8B23D", lineHeight: 1.1 }}
              >
                {result.soldePoints}
              </div>
              <div style={{ color: "#c9b8a4", fontSize: 14, marginBottom: 22 }}>
                point{result.soldePoints > 1 ? "s" : ""}
              </div>

              <a
                href={result.saveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-scale display-font"
                style={{
                  ...PRIMARY,
                  display: "block",
                  textAlign: "center",
                  textDecoration: "none",
                  borderRadius: 999,
                  padding: "13px 20px",
                  fontSize: 17,
                  fontStyle: "italic",
                  fontWeight: 700,
                }}
              >
                Ajouter à Google Wallet
              </a>

              <button
                onClick={reset}
                style={{
                  marginTop: 16,
                  background: "none",
                  border: "none",
                  color: "#8a7561",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Rechercher un autre compte
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={labelStyle}>Téléphone</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  required
                  style={{ ...INPUT, borderRadius: 10, padding: "11px 12px", fontSize: 16, outline: "none" }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={labelStyle}>Nom de famille</span>
                <input
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Leduc"
                  required
                  style={{ ...INPUT, borderRadius: 10, padding: "11px 12px", fontSize: 16, outline: "none" }}
                />
              </label>

              {error && (
                <p style={{ color: "#e88a8a", fontSize: 13, margin: 0 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="tap-scale display-font"
                style={{
                  ...PRIMARY,
                  borderRadius: 999,
                  padding: "13px 20px",
                  fontSize: 17,
                  fontStyle: "italic",
                  fontWeight: 700,
                  border: "none",
                  cursor: status === "loading" ? "default" : "pointer",
                  opacity: status === "loading" ? 0.6 : 1,
                }}
              >
                {status === "loading" ? "Recherche…" : "Voir mes points"}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", color: "#5a4a3a", fontSize: 12, marginTop: 18 }}>
          Casa — programme de fidélité
        </p>
      </div>
    </main>
  );
}

const labelStyle = {
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#a88f78",
  fontWeight: 700,
};
