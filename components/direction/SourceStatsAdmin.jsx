"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrders, fetchSourceStats } from "@/lib/data";
import { isOrderActiveToday, sourceBreakdown } from "@/lib/business";
import { useRestaurantsList } from "@/lib/restaurant";

const inputStyle = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() {
  return ymd(new Date());
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}
function pct(n, d) {
  if (!d) return "—";
  return `${Math.round((n / d) * 1000) / 10} %`;
}

// Une carte "en direct" pour un périmètre (un restaurant, ou le total).
function LiveCard({ title, b }) {
  const autoLines = b.linesSat + b.linesCC;
  return (
    <div className="rounded-2xl border border-[#3a2b1f] bg-[#211712] p-5">
      <div className="display-font text-lg font-bold mb-3">{title}</div>
      {b.linesTotal === 0 ? (
        <div className="text-[#8a7561] text-sm">Aucune commande aujourd'hui.</div>
      ) : (
        <>
          <div className="flex items-end justify-between mb-1">
            <span className="text-xs text-[#a88f78] uppercase font-bold">Lignes saisies par le client</span>
            <span className="display-font text-3xl font-bold text-[#E8B23D]">{pct(autoLines, b.linesTotal)}</span>
          </div>
          <div className="text-xs text-[#8a7561] mb-4">
            {autoLines}/{b.linesTotal} lignes · 📲 SAT {b.linesSat} · 🛍️ click &amp; collect {b.linesCC} · serveuse {b.linesServeuse}
          </div>
          <div className="flex items-end justify-between mb-1">
            <span className="text-xs text-[#a88f78] uppercase font-bold">Commandes avec au moins une ligne client</span>
            <span className="display-font text-2xl font-bold">{pct(b.ordersAuto, b.ordersTotal)}</span>
          </div>
          <div className="text-xs text-[#8a7561]">
            {b.ordersAuto}/{b.ordersTotal} commandes
          </div>
        </>
      )}
    </div>
  );
}

export default function SourceStatsAdmin() {
  const { orders } = useOrders();
  const restaurants = useRestaurantsList();

  const [start, setStart] = useState(daysAgoStr(29));
  const [end, setEnd] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!start || !end) return;
    let cancelled = false;
    setLoading(true);
    fetchSourceStats(start, end)
      .then((r) => !cancelled && setRows(r))
      .catch((err) => console.error(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [start, end]);

  // --- en direct (aujourd'hui) ---
  const todayOrders = useMemo(() => orders.filter((o) => !o.isTest && isOrderActiveToday(o)), [orders]);
  const liveByRestaurant = restaurants.map((r) => ({
    r,
    b: sourceBreakdown(todayOrders.filter((o) => o.restaurantId === r.id)),
  }));
  const liveTotal = sourceBreakdown(todayOrders);

  // --- historique agrégé sur la période, par restaurant ---
  const histByRestaurant = restaurants.map((r) => {
    const rr = rows.filter((x) => x.restaurant_id === r.id);
    const agg = rr.reduce(
      (a, x) => ({
        linesTotal: a.linesTotal + x.lines_total,
        linesServeuse: a.linesServeuse + x.lines_serveuse,
        linesSat: a.linesSat + x.lines_sat,
        linesCC: a.linesCC + x.lines_click_and_collect,
        ordersTotal: a.ordersTotal + x.orders_total,
        ordersAuto: a.ordersAuto + x.orders_with_autonomy,
        days: a.days + 1,
      }),
      { linesTotal: 0, linesServeuse: 0, linesSat: 0, linesCC: 0, ordersTotal: 0, ordersAuto: 0, days: 0 }
    );
    return { r, agg };
  });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-6 max-w-3xl">
        Part des commandes prises par le client lui-même — <b>📲 SAT</b> (à table pendant le service) et{" "}
        <b>🛍️ click &amp; collect</b> (lien <span className="font-mono">/commande</span>) — par rapport à la saisie
        serveuse. Le « en direct » se remet à zéro chaque nuit ; l'historique est archivé avant la purge (03:50).
      </p>

      <div className="display-font text-xl font-bold mb-3">En direct — aujourd'hui</div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
        {liveByRestaurant.map(({ r, b }) => (
          <LiveCard key={r.id} title={r.name} b={b} />
        ))}
        {restaurants.length > 1 && <LiveCard title="Total enseigne" b={liveTotal} />}
      </div>

      <div className="display-font text-xl font-bold mb-3">Historique</div>
      <div className="flex flex-wrap items-end gap-4 mb-5">
        <label className="text-xs text-[#a88f78] uppercase font-bold">
          Du
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="block mt-1 rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </label>
        <label className="text-xs text-[#a88f78] uppercase font-bold">
          Au
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="block mt-1 rounded-lg px-3 py-2 text-sm" style={inputStyle} />
        </label>
        {loading && <span className="text-sm text-[#8a7561]">Chargement…</span>}
      </div>

      {rows.length === 0 && !loading ? (
        <p className="text-[#8a7561] text-sm">
          Aucune donnée archivée sur cette période. L'archive commence au premier passage nocturne du job après la mise
          en place du reporting.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {histByRestaurant.map(({ r, agg }) => {
            const rr = rows.filter((x) => x.restaurant_id === r.id);
            if (rr.length === 0) return null;
            const autoLines = agg.linesSat + agg.linesCC;
            return (
              <div key={r.id}>
                <div className="font-bold mb-2">
                  {r.name} — <span className="text-[#E8B23D]">{pct(autoLines, agg.linesTotal)}</span> de lignes client sur{" "}
                  {agg.days} jour{agg.days > 1 ? "s" : ""} ({pct(agg.ordersAuto, agg.ordersTotal)} des commandes)
                </div>
                <div className="overflow-x-auto rounded-xl border border-[#3a2b1f]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[#a88f78] text-xs uppercase">
                        <th className="text-left font-bold px-3 py-2">Jour</th>
                        <th className="text-right font-bold px-3 py-2">Lignes client</th>
                        <th className="text-right font-bold px-3 py-2">📲 SAT</th>
                        <th className="text-right font-bold px-3 py-2">🛍️ C&amp;C</th>
                        <th className="text-right font-bold px-3 py-2">Serveuse</th>
                        <th className="text-right font-bold px-3 py-2">Cmd. client</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rr.map((x) => (
                        <tr key={x.date} className="border-t border-[#3a2b1f]">
                          <td className="px-3 py-2">{x.date}</td>
                          <td className="text-right px-3 py-2 font-bold text-[#E8B23D]">
                            {pct(x.lines_sat + x.lines_click_and_collect, x.lines_total)}
                          </td>
                          <td className="text-right px-3 py-2">{x.lines_sat}</td>
                          <td className="text-right px-3 py-2">{x.lines_click_and_collect}</td>
                          <td className="text-right px-3 py-2 text-[#a88f78]">{x.lines_serveuse}</td>
                          <td className="text-right px-3 py-2">{pct(x.orders_with_autonomy, x.orders_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
