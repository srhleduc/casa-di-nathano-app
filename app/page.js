"use client";

import AuthGate from "@/components/AuthGate";
import Kiosk from "@/components/Kiosk";
import DirectionApp from "@/components/direction/DirectionApp";

const IS_DIRECTION = process.env.NEXT_PUBLIC_APP_MODE === "direction";

export default function Page() {
  if (IS_DIRECTION) return <DirectionApp />;

  return (
    <AuthGate>
      <Kiosk />
    </AuthGate>
  );
}
