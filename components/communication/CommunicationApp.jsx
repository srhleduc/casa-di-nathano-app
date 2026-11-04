"use client";

// Espace « Casa communication » — déploiement dédié (NEXT_PUBLIC_APP_MODE=communication).
// Même connexion personnelle que l'espace Direction (comptes `managers`).

import { useState } from "react";
import { signOutManager, useManagerSession } from "@/lib/managerAuth";
import DirectionLogin from "../direction/DirectionLogin";
import PostsBoard from "./PostsBoard";
import AssetLibrary from "./AssetLibrary";

const TABS = [
  { id: "posts", label: "📝 Posts" },
  { id: "assets", label: "🖼️ Visuels" },
];

export default function CommunicationApp() {
  const { session, loading } = useManagerSession();
  const [tab, setTab] = useState("posts");

  if (loading) {
    return (
      <div className="kiosk-root--pin">
        <p className="text-[#8a7561] text-sm">Connexion…</p>
      </div>
    );
  }
  if (!session) return <DirectionLogin title="Casa communication" icon="📣" />;

  return (
    <div className="kiosk-root--team">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#3a2b1f]">
        <span className="display-font text-xl font-semibold">📣 Casa communication</span>
        <button onClick={signOutManager} className="text-[#c9b8a4] text-sm font-semibold px-4 py-2 rounded-full border border-[#4a3826] tap-scale">
          Se déconnecter
        </button>
      </div>
      <div className="flex gap-3 px-6 py-4 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2 ${tab === t.id ? "border-[#C0392B] bg-[#2c1c14]" : "border-[#3a2b1f]"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "posts" && <PostsBoard />}
      {tab === "assets" && <AssetLibrary />}
    </div>
  );
}
