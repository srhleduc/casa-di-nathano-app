"use client";

// App livreur : accès par email/mot de passe personnel, limité aux livraisons
// des restaurants (voir supabase/migrations_manual/delivery_drivers.sql). Le
// livreur ne voit ni la caisse, ni la Direction — la RLS ne lui renvoie que
// les commandes en livraison, et sa seule écriture est le changement de statut.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { signInManager, signOutManager, useManagerSession } from "@/lib/managerAuth";
import { useDriverDeliveries, setDriverDeliveryStatus } from "@/lib/data";
import { useRestaurantsList } from "@/lib/restaurant";
import { isOrderPaid, isOrderActiveToday } from "@/lib/business";
import { eur } from "@/lib/menu";
import GroupedItemList from "../GroupedItemList";
import WaveHeader from "../WaveHeader";
import { groupByWave } from "@/lib/deliveryWaves";

const KITCHEN_PENDING = ["attente", "preparation", "prete"];

function mapsUrl(o) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.deliveryAddress || "")}`;
}
function telUrl(phone) {
  return `tel:${(phone || "").replace(/[\s.\-()]/g, "")}`;
}
function timeOf(o) {
  return o.scheduledTime || new Date(o.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signInManager(email, password);
    setLoading(false);
    if (error) setError("Email ou mot de passe incorrect.");
  }

  const field = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };
  return (
    <div className="kiosk-root--pin px-8">
      <span className="text-5xl mb-6">🛵</span>
      <h1 className="display-font text-3xl font-semibold mb-8">Livraisons</h1>
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-4">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" className="rounded-xl px-4 py-4 text-lg outline-none" style={field} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" autoComplete="current-password" className="rounded-xl px-4 py-4 text-lg outline-none" style={field} />
        {error && <p className="text-[#C0392B] text-sm font-bold">{error}</p>}
        <button type="submit" disabled={loading} className="tap-scale rounded-full py-4 text-lg font-bold disabled:opacity-50" style={{ background: "#C0392B", color: "#fff5ea" }}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

function Card({ order, restaurantName, children }) {
  const paid = isOrderPaid(order);
  return (
    <div className="rounded-2xl border border-[#3a2b1f] bg-[#211712] p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="display-font text-xl font-bold">{order.name}</div>
        <div className="text-xs font-bold rounded-full px-2 py-1" style={{ background: "#3a2b1f", color: "#E8B23D" }}>
          {restaurantName} · {order.deliveryWave ? `départ ${order.deliveryWave}` : timeOf(order)}
        </div>
      </div>
      <div className="rounded-xl px-3 py-3 my-3" style={{ background: "#1c3a52" }}>
        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#9fd0f5" }}>📍 Adresse</div>
        <div className="font-bold text-[#f5ebdd] leading-snug">{order.deliveryAddress}</div>
        {order.deliveryInstructions && <div className="text-sm mt-1" style={{ color: "#cfe6fa" }}>ℹ️ {order.deliveryInstructions}</div>}
        <div className="flex gap-2 mt-3">
          <a href={mapsUrl(order)} target="_blank" rel="noopener noreferrer" className="tap-scale flex-1 text-center rounded-lg py-3 text-sm font-bold" style={{ background: "#2b5a82", color: "#fff" }}>🗺️ Itinéraire</a>
          {order.deliveryPhone && (
            <a href={telUrl(order.deliveryPhone)} className="tap-scale flex-1 text-center rounded-lg py-3 text-sm font-bold" style={{ background: "#2b5a82", color: "#fff" }}>📞 Appeler</a>
          )}
        </div>
      </div>
      <GroupedItemList items={order.items} className="mb-3" />
      {order.note && <div className="text-sm text-[#a88f78] mb-3">📝 {order.note}</div>}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#a88f78] text-sm">{paid ? "💰 Déjà payée" : "À encaisser"}</span>
        <span className="font-bold text-xl text-[#E8B23D]">{eur(order.total)}</span>
      </div>
      {children}
    </div>
  );
}

function Section({ title, count, children }) {
  if (!count) return null;
  return (
    <div className="mb-6">
      <div className="font-bold mb-3">
        {title} ({count})
      </div>
      {children}
    </div>
  );
}

function Board({ onSignOut }) {
  const { orders, loading } = useDriverDeliveries();
  const restaurants = useRestaurantsList();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const nameOf = (id) => restaurants.find((r) => r.id === id)?.name || "";

  const deliveries = orders.filter((o) => o.deliveryStatus && o.deliveryStatus !== "annulee" && isOrderActiveToday(o));
  const pending = deliveries.filter((o) => o.deliveryStatus === "a_livrer" && KITCHEN_PENDING.includes(o.status));
  const ready = deliveries.filter((o) => o.deliveryStatus === "a_livrer" && !KITCHEN_PENDING.includes(o.status));
  const enRoute = deliveries.filter((o) => o.deliveryStatus === "en_route");
  const done = deliveries.filter((o) => o.deliveryStatus === "livree");

  async function set(o, status) {
    setBusyId(o.id);
    setError(null);
    try {
      await setDriverDeliveryStatus(o.id, status);
    } catch (err) {
      console.error(err);
      setError("Impossible de mettre à jour. Vérifiez la connexion.");
    }
    setBusyId(null);
  }

  const btn = (label, bg, color, onClick, o) => (
    <button onClick={onClick} disabled={busyId === o.id} className="tap-scale w-full rounded-xl py-4 text-lg font-bold disabled:opacity-50" style={{ background: bg, color }}>
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#1a120b] text-[#f5ebdd] px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="display-font text-2xl font-semibold">🛵 Livraisons</h1>
        <button onClick={onSignOut} className="text-sm text-[#a88f78] underline">Déconnexion</button>
      </div>
      {error && <p className="text-[#C0392B] text-sm font-bold mb-3">{error}</p>}
      {loading && <p className="text-[#8a7561]">Chargement…</p>}
      {!loading && deliveries.length === 0 && <p className="text-[#8a7561]">Aucune livraison pour l&apos;instant.</p>}

      <Section title="🟢 Prêtes à livrer" count={ready.length}>
        {groupByWave(ready).map((group) => (
          <div key={group.time || "none"} className="mb-4">
            {(group.time || ready.some((o) => o.deliveryWave)) && <WaveHeader group={group} readyOrders={group.orders} />}
            {group.orders.map((o) => (
              <Card key={o.id} order={o} restaurantName={nameOf(o.restaurantId)}>
                {btn("🛵 Je pars livrer", "#C0392B", "#fff5ea", () => set(o, "en_route"), o)}
              </Card>
            ))}
          </div>
        ))}
      </Section>
      <Section title="🛵 En route" count={enRoute.length}>
        {enRoute.map((o) => (
          <Card key={o.id} order={o} restaurantName={nameOf(o.restaurantId)}>
            {btn("✅ Livrée", "#204a3a", "#a8e8c8", () => set(o, "livree"), o)}
            <button onClick={() => set(o, "a_livrer")} className="tap-scale w-full mt-2 text-sm font-semibold text-[#a88f78]">↩ Remettre dans « Prêtes »</button>
          </Card>
        ))}
      </Section>
      <Section title="🔴 En préparation" count={pending.length}>
        {pending.map((o) => (
          <Card key={o.id} order={o} restaurantName={nameOf(o.restaurantId)}>
            <div className="text-center text-sm text-[#a88f78]">En cuisine — elle passera dans « Prêtes » à la sortie.</div>
          </Card>
        ))}
      </Section>
      <Section title="✅ Livrées aujourd'hui" count={done.length}>
        {done.map((o) => (
          <Card key={o.id} order={o} restaurantName={nameOf(o.restaurantId)}>
            {!isOrderPaid(o) && <div className="text-center text-sm font-bold mb-2" style={{ color: "#E8B23D" }}>💰 À remettre en Caisse</div>}
            <button onClick={() => set(o, "en_route")} className="tap-scale w-full text-sm font-semibold text-[#a88f78]">↩ Remettre « En route »</button>
          </Card>
        ))}
      </Section>
    </div>
  );
}

export default function LivreurApp() {
  const { session, loading } = useManagerSession();
  const [isDriver, setIsDriver] = useState(undefined);

  useEffect(() => {
    if (!session) {
      setIsDriver(undefined);
      return;
    }
    let cancelled = false;
    supabase
      .from("drivers")
      .select("name")
      .eq("auth_uid", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsDriver(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (loading || (session && isDriver === undefined)) {
    return (
      <div className="kiosk-root--pin">
        <p className="text-[#8a7561] text-sm">Connexion…</p>
      </div>
    );
  }
  if (!session) return <Login />;
  if (!isDriver) {
    return (
      <div className="kiosk-root--pin px-8 text-center">
        <p className="mb-4">Ce compte n&apos;a pas d&apos;accès livreur.</p>
        <button onClick={signOutManager} className="underline text-[#a88f78]">Se déconnecter</button>
      </div>
    );
  }
  return <Board onSignOut={signOutManager} />;
}
