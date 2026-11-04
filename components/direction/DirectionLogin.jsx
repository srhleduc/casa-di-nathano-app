"use client";

import { useState } from "react";
import { signInManager } from "@/lib/managerAuth";

export default function DirectionLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signInManager(email, password);
    setLoading(false);
    if (error) setError("Email ou mot de passe incorrect.");
  }

  return (
    <div className="kiosk-root--pin px-8">
      <span className="text-5xl mb-6">🧑‍💼</span>
      <h1 className="display-font text-3xl font-semibold mb-8">Espace Direction</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="username"
          className="rounded-xl px-4 py-4 text-lg outline-none"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          autoComplete="current-password"
          className="rounded-xl px-4 py-4 text-lg outline-none"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
        {error && <p className="text-[#C0392B] text-sm font-bold">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="tap-scale rounded-full py-4 text-lg font-bold disabled:opacity-50"
          style={{ background: "#C0392B", color: "#fff5ea" }}
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
