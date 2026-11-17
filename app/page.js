"use client";

import AuthGate from "@/components/AuthGate";
import Kiosk from "@/components/Kiosk";
import DirectionApp from "@/components/direction/DirectionApp";
import LivreurApp from "@/components/livreur/LivreurApp";

const IS_DIRECTION = process.env.NEXT_PUBLIC_APP_MODE === "direction";

const IS_LIVREUR = process.env.NEXT_PUBLIC_APP_MODE === "livreur";

export default function Page() {
  if (IS_LIVREUR) return <LivreurApp />;
  if (IS_DIRECTION) return <DirectionApp />;

  return (
    <AuthGate>
      <Kiosk />
    </AuthGate>
  );
}
