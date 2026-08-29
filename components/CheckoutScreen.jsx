"use client";

import { eur, noteIcon } from "@/lib/menu";
import { lineUnitPrice, TAKEAWAY_SERVICE_TYPE, isTakeawayLike, isValidPhoneFr } from "@/lib/business";
import { CGV_NO_SHOW_CLAUSE } from "@/lib/cgv";

const DEFAULT_OPTIONS = ["🍽️ Sur place", "🥡 À emporter"];

export default function CheckoutScreen({
  cart,
  changeQty,
  total,
  pizzaCount,
  serviceType,
  setServiceType,
  tableName,
  setTableName,
  note,
  setNote,
  onBack,
  onConfirm,
  serviceTypeOptions,
  // Engagement client (click & collect uniquement) — absent sur la borne/équipe.
  requireCommitment,
  phone,
  setPhone,
  commitmentAccepted,
  setCommitmentAccepted,
  onOpenCgv,
}) {
  const options = serviceTypeOptions || DEFAULT_OPTIONS;
  const phoneOk = !requireCommitment || isValidPhoneFr(phone);
  const commitmentOk = !requireCommitment || commitmentAccepted === true;
  const canConfirm = cart.length > 0 && phoneOk && commitmentOk;
  return (
    <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
      <button onClick={onBack} className="text-[#c9b8a4] text-sm font-semibold mb-6 self-start tap-scale">
        ← Continuer mes achats
      </button>
      <h2 className="display-font text-3xl font-semibold mb-6">Ma commande</h2>

      <div className="flex-1 flex flex-col gap-3 mb-6">
        {cart.map((i) => (
          <div
            key={i.id + "-" + (i.note || "") + "-" + (i.modifiers || []).map((m) => m.name).join(",")}
            className="flex items-center justify-between rounded-xl border border-[#3a2b1f] bg-[#211712] px-4 py-3"
          >
            <div>
              <div className="font-bold">{i.name}</div>
              {i.note && (
                <div className="text-xs text-[#E8B23D] pl-3">
                  ↳ {noteIcon(i.name, i.note)} {i.note}
                </div>
              )}
              {(i.modifiers || []).map((m, mi) => {
                const isRemoved = m.name.startsWith("Sans ");
                const label = isRemoved ? m.name.slice(5) : m.name.replace(/^Supplément /, "");
                return (
                  <div key={mi} className="text-xs pl-3 flex items-center gap-1.5">
                    <span className="font-bold" style={{ color: isRemoved ? "#e88a8a" : "#a8e8c8" }}>
                      {isRemoved ? "−" : "+"}
                    </span>
                    <span className="text-[#a88f78]">
                      {label}
                      {m.price > 0 ? ` (+${eur(m.price)})` : ""}
                    </span>
                  </div>
                );
              })}
              <div className="text-[#a88f78] text-sm mt-1">{eur(lineUnitPrice(i))} / unité</div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => changeQty(i.id, i.note, i.modifiers, -1)} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-xl font-bold">
                −
              </button>
              <span className="w-6 text-center font-bold">{i.qty}</span>
              <button onClick={() => changeQty(i.id, i.note, i.modifiers, 1)} className="tap-scale w-9 h-9 rounded-full bg-[#3a2b1f] text-xl font-bold">
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">Type de commande</div>
        <div className="flex flex-wrap gap-3">
          {options.map((opt) => {
            const isSelected = serviceType === opt;
            return (
              <button
                key={opt}
                onClick={() => setServiceType(opt)}
                className="tap-scale flex-1 min-w-[160px] rounded-xl py-4 px-2 font-bold border-2 flex items-center justify-center gap-2 text-center"
                style={isSelected ? { background: "#C0392B", borderColor: "#C0392B", color: "#fff5ea" } : { background: "#211712", borderColor: "#3a2b1f", color: "#a88f78" }}
              >
                {isSelected && <span>✓</span>}
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">
          {!isTakeawayLike(serviceType) ? "Numéro de table" : "Ton nom (pour t'appeler)"}
        </div>
        <input
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          placeholder={!isTakeawayLike(serviceType) ? "Ex. 12" : "Ex. Julie"}
          className="w-full rounded-xl px-4 py-4 text-lg outline-none"
          style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
        />
      </div>

      {requireCommitment && (
        <div className="mb-8">
          <div className="text-sm font-bold text-[#a88f78] uppercase tracking-wide mb-2">Numéro de téléphone</div>
          <input
            value={phone || ""}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Ex. 06 12 34 56 78"
            className="w-full rounded-xl px-4 py-4 text-lg outline-none"
            style={{ background: "#211712", border: `1px solid ${phone && !isValidPhoneFr(phone) ? "#C0392B" : "#3a2b1f"}`, color: "#f5ebdd" }}
          />
          {phone && !isValidPhoneFr(phone) && (
            <p className="text-sm mt-2" style={{ color: "#e88a8a" }}>Numéro invalide — format attendu : 06 12 34 56 78</p>
          )}

          <label className="flex items-start gap-3 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={commitmentAccepted === true}
              onChange={(e) => setCommitmentAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 shrink-0 accent-[#C0392B]"
            />
            <span className="text-sm text-[#c9b8a4] leading-relaxed">
              En validant votre commande, vous vous engagez à venir la récupérer sur le créneau choisi. Toute commande non retirée reste due.
            </span>
          </label>

          <p className="text-sm mt-3">
            <button type="button" onClick={onOpenCgv} className="underline underline-offset-2 font-semibold text-[#E8B23D] tap-scale">
              Conditions générales de vente
            </button>
            <span className="text-[#8a7561]"> — {CGV_NO_SHOW_CLAUSE}</span>
          </p>
        </div>
      )}

      {setNote && (
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: "#ff5fa8" }}>
            📝 Note pour l'équipe (facultatif)
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. Allergie noix, client pressé, anniversaire…"
            rows={2}
            className="w-full rounded-xl px-4 py-3 text-base outline-none resize-none"
            style={{ background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" }}
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <span className="text-xl font-bold">Total</span>
        <span className="display-font text-3xl font-bold text-[#E8B23D]">{eur(total)}</span>
      </div>
      <button onClick={onConfirm} disabled={!canConfirm} className="tap-scale rounded-full py-6 text-2xl font-bold disabled:opacity-40" style={{ background: "#C0392B", color: "#fff5ea" }}>
        {pizzaCount > 0 && serviceType === TAKEAWAY_SERVICE_TYPE ? "Choisir mon créneau →" : "Valider ma commande →"}
      </button>
      <p className="text-center text-[#8a7561] text-sm mt-4">Le règlement se fait en caisse, après validation.</p>
    </div>
  );
}
