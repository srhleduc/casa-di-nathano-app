"use client";

import AuthGate from "@/components/AuthGate";
import ServiceATable from "@/components/ServiceATable";

export default function Page() {
  return (
    <AuthGate>
      <ServiceATable />
    </AuthGate>
  );
}
