"use client";

import AuthGate from "@/components/AuthGate";
import ReservationBooking from "@/components/ReservationBooking";

export default function Page() {
  return (
    <AuthGate>
      <ReservationBooking />
    </AuthGate>
  );
}
