"use client";

import AuthGate from "@/components/AuthGate";
import Kiosk from "@/components/Kiosk";

export default function Page() {
  return (
    <AuthGate>
      <Kiosk />
    </AuthGate>
  );
}
