"use client";

// Espace « Casa communication » — déploiement dédié (NEXT_PUBLIC_APP_MODE=communication).
// Même connexion personnelle que l'espace Direction (comptes `managers`).

import { useEffect, useRef, useState } from "react";
import { signOutManager, useManagerSession } from "@/lib/managerAuth";
import { completeMetaConnect, useSocialAccounts } from "@/lib/communication";
import DirectionLogin from "../direction/DirectionLogin";
import PostsBoard from "./PostsBoard";
import AssetLibrary from "./AssetLibrary";
import AccountsPanel from "./AccountsPanel";

const TABS = [
  { id: "posts", label: "📝 Posts" },
  { id: "assets", label: "🖼️ Visuels" },
  { id: "accounts", label: "🔗 Comptes" },
];

export default function CommunicationApp() {
  const { session, loading } = useManagerSession();
  const [tab, setTab] = useState("posts");
  const [notice, setNotice] = useState(null);
  const { rows: accounts, reload: reloadAccounts } = useSocialAccounts();
  const handledReturn = useRef(false);

  // Retour de la page de connexion Facebook : /?meta_code=…&meta_state=… (ou ?meta_error=…)
  useEffect(() => {
    if (!session || handledReturn.current) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("meta_code");
    const error = params.get("meta_error");
    if (!code && !error) return;
    handledReturn.current = true;
    const state = params.get("meta_state");
    window.history.replaceState(null, "", window.location.pathname);
    setTab("accounts");
    if (error) {
      setNotice({ kind: "error", text: error });
      return;
    }
    setNotice({ kind: "info", text: "Connexion en cours…" });
    completeMetaConnect(code, state)
      .then((res) => {
        setNotice({ kind: "info", text: `✓ ${res.accounts.length} compte(s) connecté(s). Indique maintenant l'enseigne de chacun.` });
        reloadAccounts();
      })
      .catch((err) => setNotice({ kind: "error", text: err.message || String(err) }));
  }, [session, reloadAccounts]);

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
      {tab === "posts" && <PostsBoard accounts={accounts} />}
      {tab === "assets" && <AssetLibrary />}
      {tab === "accounts" && <AccountsPanel accounts={accounts} reload={reloadAccounts} notice={notice} />}
    </div>
  );
}
