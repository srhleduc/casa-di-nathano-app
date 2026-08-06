"use client";

import { useAuthReady } from "@/lib/restaurant";

// Bloque l'affichage le temps que ce déploiement se connecte avec le compte
// fixe de son restaurant — sans ça, les tout premiers appels Supabase
// partiraient non authentifiés et seraient refusés par les règles de sécurité.
export default function AuthGate({ children }) {
  const { ready, error } = useAuthReady();

  if (error) {
    return (
      <div className="kiosk-root--pin text-center px-8">
        <p className="text-[#E8B23D] font-bold mb-2">Connexion impossible</p>
        <p className="text-[#a88f78] text-sm max-w-sm">
          Vérifie la connexion internet de cet appareil, ou préviens l'équipe technique si le problème persiste.
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="kiosk-root--pin">
        <p className="text-[#8a7561] text-sm">Connexion…</p>
      </div>
    );
  }

  return children;
}
