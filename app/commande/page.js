"use client";

import AuthGate from "@/components/AuthGate";
import TakeawayOrder from "@/components/TakeawayOrder";

export default function Page() {
  return (
    <AuthGate>
      <TakeawayOrder />
    </AuthGate>
  );
}
