"use client";

import { useManagerSession } from "@/lib/managerAuth";
import DirectionLogin from "./DirectionLogin";
import DirectionDashboard from "./DirectionDashboard";

export default function DirectionApp() {
  const { session, loading } = useManagerSession();

  if (loading) {
    return (
      <div className="kiosk-root--pin">
        <p className="text-[#8a7561] text-sm">Connexion…</p>
      </div>
    );
  }

  if (!session) return <DirectionLogin />;

  return <DirectionDashboard />;
}
