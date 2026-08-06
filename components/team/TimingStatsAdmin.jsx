"use client";

import { useOrders } from "@/lib/data";
import { isOrderActiveToday, formatDurationPrecise } from "@/lib/business";

function average(list) {
  if (list.length === 0) return null;
  return list.reduce((s, v) => s + v, 0) / list.length;
}

function StatCard({ label, value, count }) {
  return (
    <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-5">
      <div className="text-xs text-[#a88f78] uppercase font-bold mb-2">{label}</div>
      {value === null ? (
        <div className="text-[#8a7561]">Pas encore de donnée</div>
      ) : (
        <div className="display-font text-2xl font-bold text-[#E8B23D]">{formatDurationPrecise(value)}</div>
      )}
      <div className="text-xs text-[#8a7561] mt-1">
        {count} commande{count > 1 ? "s" : ""}
      </div>
    </div>
  );
}

export default function TimingStatsAdmin() {
  const { orders } = useOrders();
  const today = orders.filter((o) => isOrderActiveToday(o) && !o.isTest);

  const ovenDurations = today.filter((o) => o.ovenDoneAt).map((o) => o.ovenDoneAt - o.createdAt);
  const finitionDurations = today.filter((o) => o.finitionDoneAt).map((o) => o.finitionDoneAt - (o.ovenDoneAt || o.createdAt));
  const totalDurations = today.filter((o) => o.finitionDoneAt).map((o) => o.finitionDoneAt - o.createdAt);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <p className="text-[#a88f78] mb-6 text-sm">
        Moyennes calculées sur les commandes du jour (hors mode test), à chaque étape déjà passée. Purement informatif —
        aucune alerte, personne n'est chronométré en direct pour être mis sous pression.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="🔥 Temps moyen au four" value={average(ovenDurations)} count={ovenDurations.length} />
        <StatCard label="🥗 Temps moyen en finition" value={average(finitionDurations)} count={finitionDurations.length} />
        <StatCard label="⏱ Temps total moyen (envoi → prête pour le service)" value={average(totalDurations)} count={totalDurations.length} />
      </div>
    </div>
  );
}
