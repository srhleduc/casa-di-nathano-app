"use client";

// Espace Direction → comptes livreurs : création, liste, suppression.
// Passe par /api/livreurs (clé service_role côté serveur uniquement).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const INPUT_STYLE = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };
const PRIMARY_BTN = { background: "#C0392B", color: "#fff5ea" };

async function api(method, path = "", body) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`/api/livreurs${path}`, {
    method,
    headers: { Authorization: `Bearer ${data.session?.access_token || ""}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Erreur.");
  return json;
}

export default function DriversAdmin() {
  const [drivers, setDrivers] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setDrivers((await api("GET")).drivers);
      setError(null);
    } catch (e) {
      setError(e.message);
      setDrivers([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("POST", "", form);
      setForm({ name: "", email: "", password: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  async function remove(d) {
    if (!window.confirm(`Supprimer l'accès de ${d.name} ? Il ne pourra plus se connecter.`)) return;
    try {
      await api("DELETE", `?id=${encodeURIComponent(d.id)}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="px-6 py-4 max-w-xl">
      <p className="text-[#a88f78] text-sm mb-4">
        Les livreurs se connectent à l&apos;app « Livraison » avec leur email et leur mot de passe. Ils voient uniquement les livraisons des deux restaurants.
      </p>
      {error && <p className="text-[#C0392B] text-sm font-bold mb-3">{error}</p>}

      <div className="font-bold mb-2">Livreurs ({drivers?.length ?? 0})</div>
      {drivers === null && <p className="text-[#8a7561] text-sm">Chargement…</p>}
      {drivers?.length === 0 && <p className="text-[#8a7561] text-sm mb-2">Aucun livreur pour l&apos;instant.</p>}
      {drivers?.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#3a2b1f] bg-[#211712] px-4 py-3 mb-2">
          <div>
            <div className="font-bold">{d.name}</div>
            <div className="text-xs text-[#a88f78]">{d.email}</div>
          </div>
          <button onClick={() => remove(d)} className="tap-scale text-sm font-bold text-[#C0392B]">Supprimer</button>
        </div>
      ))}

      <form onSubmit={create} className="flex flex-col gap-3 mt-6">
        <div className="font-bold">Ajouter un livreur</div>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Prénom" className="rounded-xl px-4 py-3 outline-none" style={INPUT_STYLE} />
        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" autoComplete="off" className="rounded-xl px-4 py-3 outline-none" style={INPUT_STYLE} />
        <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mot de passe (8 caractères min.)" autoComplete="off" className="rounded-xl px-4 py-3 outline-none" style={INPUT_STYLE} />
        <button type="submit" disabled={saving} className="tap-scale rounded-full py-3 font-bold disabled:opacity-50" style={PRIMARY_BTN}>
          {saving ? "Création…" : "Créer le compte"}
        </button>
      </form>
    </div>
  );
}
