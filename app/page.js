"use client";

import AuthGate from "@/components/AuthGate";
import Kiosk from "@/components/Kiosk";
import DirectionApp from "@/components/direction/DirectionApp";
import CommunicationApp from "@/components/communication/CommunicationApp";

const IS_DIRECTION = process.env.NEXT_PUBLIC_APP_MODE === "direction";
const IS_COMMUNICATION = process.env.NEXT_PUBLIC_APP_MODE === "communication";

export default function Page() {
  if (IS_DIRECTION) return <DirectionApp />;
  if (IS_COMMUNICATION) return <CommunicationApp />;

  return (
    <AuthGate>
      <Kiosk />
    </AuthGate>
  );
}
