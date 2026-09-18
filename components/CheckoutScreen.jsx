"use client";

import { eur, noteIcon } from "@/lib/menu";
import { lineUnitPrice, tableDisplayName, TAKEAWAY_SERVICE_TYPE, isTakeawayLike, isValidPhoneFr } from "@/lib/business";
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
  // Sélecteur multi-tables (prise de commande serveuse, sur place uniquement).
  // Absent sur la borne / le click & collect → l'ancien champ texte est conservé.
  tables,
  selectedTableIds,
  toggleTableId,
  otherTableLabel,
  setOtherTableLabel,
  // Table déjà connue (lien client /sat) : affichage figé, pas de saisie.
  fixedTableLabel,
  // Note libre par article (flux équipe uniquement) — `setItemNote(index, value)`.
  // Absent côté client (borne / click & collect).
  setItemNote,
  // Paiement anticipé (flux équipe uniquement) — le client règle dès la prise
  // de commande, une autre personne vient récupérer plus tard. Absent sur la
  // borne client et le click & collect (props non fournies).
  paidUpfront,
  setPaidUpfront,
  // Engagement client (click & collect uniquement) — absent sur la borne/équipe.
  requireCommitment,
  phone,
  setPhone,
  commitmentAccepted,
  setCommitmentAccepted,
  onOpenCgv,
}) {
  const options = serviceTypeOptions || DEFAULT_OPTIONS;
  const nameOk = !requireCommitment || (tableName || "").trim().length > 0;
  const phoneOk = !requireCommitment || isValidPhoneFr(phone);
  const commitmentOk = !requireCommitment || commitmentAccepted === true;
  const canConfirm = cart.length > 0 && nameOk && phoneOk && commitmentOk;
  return (
    <div className="flex-1 flex flex-col px-6 py-6 overflow-y-auto">
      <button onClick={onBack} className="text-sm font-semibold mb-6 self-start tap-scale" style={{ color: "var(--color-text-subtle)" }}>
        ← Continuer mes achats
      </button>
      <h2 className="display-font text-3xl font-semibold mb-6">Ma commande</h2>

      <div className="flex-1 flex flex-col gap-3 mb-6">
        {cart.map((i, idx) => (
          <div
            key={i.id + "-" + (i.note || "") + "-" + (i.modifiers || []).map((m) => m.name).join(",") + "-" + idx}
            className="flex flex-col gap-2 rounded-xl border px-4 py-3"
            style={{ borderColor: "var(--color-border)", background: "var(--color-surface-card)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">{i.name}</div>
                {i.note && (
                  <div className="text-xs pl-3" style={{ color: "var(--color-accent-gold)" }}>
                    ↳ {noteIcon(i.name, i.note)} {i.note}
                  </div>
                )}
                {(i.modifiers || []).map((m, mi) => {
                  const isRemoved = m.name.startsWith("Sans ");
                  const label = isRemoved ? m.name.slice(5) : m.name.replace(/^Supplément /, "");
                  return (
                    <div key={mi} className="text-xs pl-3 flex items-center gap-1.5">
                      <span className="font-bold" style={{ color: isRemoved ? "var(--color-danger)" : "var(--color-success)" }}>
                        {isRemoved ? "−" : "+"}
                      </span>
                      <span style={{ color: "var(--color-text-muted)" }}>
                        {label}
                        {m.price > 0 ? ` (+${eur(m.price)})` : ""}
                      </span>
                    </div>
                  );
                })}
                <div className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>{eur(lineUnitPrice(i))} / unité</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => changeQty(i.id, i.note, i.modifiers, -1, i.itemNote)} className="tap-scale w-9 h-9 rounded-full text-xl font-bold" style={{ background: "var(--color-border)" }}>
                  −
                </button>
                <span className="w-6 text-center font-bold">{i.qty}</span>
                <button onClick={() => changeQty(i.id, i.note, i.modifiers, 1, i.itemNote)} className="tap-scale w-9 h-9 rounded-full text-xl font-bold" style={{ background: "var(--color-border)" }}>
                  +
                </button>
              </div>
            </div>
            {setItemNote && (
              <input
                value={i.itemNote || ""}
                onChange={(e) => setItemNote(idx, e.target.value)}
                placeholder="📝 Note pour ce produit (ex. bien cuite, sans oignon)…"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-warning)" }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mb-6">
        <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Type de commande</div>
        <div className="flex flex-wrap gap-3">
          {options.map((opt) => {
            const isSelected = serviceType === opt;
            return (
              <button
                key={opt}
                onClick={() => setServiceType(opt)}
                className="tap-scale flex-1 min-w-[160px] rounded-xl py-4 px-2 font-bold border-2 flex items-center justify-center gap-2 text-center"
                style={
                  isSelected
                    ? { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "var(--color-text-alt)" }
                    : { background: "var(--color-surface-card)", borderColor: "var(--color-border)", color: "var(--color-text-muted)" }
                }
              >
                {isSelected && <span>✓</span>}
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {fixedTableLabel && !isTakeawayLike(serviceType) ? (
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Table</div>
          <div
            className="rounded-xl px-4 py-4 text-lg font-bold"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          >
            {fixedTableLabel}
          </div>
        </div>
      ) : tables && !isTakeawayLike(serviceType) ? (
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Numéro de table</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {tables.map((t) => {
              const on = (selectedTableIds || []).includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTableId(t.id)}
                  className="tap-scale rounded-full px-4 py-2 font-bold border-2 text-sm"
                  style={on ? { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "var(--color-text-alt)" } : { borderColor: "var(--color-border)", color: "var(--color-text-subtle)" }}
                >
                  {on ? "✓ " : ""}{tableDisplayName(t)}
                </button>
              );
            })}
            {tables.length === 0 && (
              <span className="text-sm" style={{ color: "var(--color-text-faint)" }}>Aucune table enregistrée — utilise le champ ci-dessous.</span>
            )}
          </div>
          <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Autre / texte libre</div>
          <input
            value={otherTableLabel || ""}
            onChange={(e) => setOtherTableLabel(e.target.value)}
            placeholder="Ex. Terrasse 3, table d'appoint…"
            className="w-full rounded-xl px-4 py-4 text-lg outline-none"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          />
        </div>
      ) : (
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>
            {!isTakeawayLike(serviceType) ? "Numéro de table" : "Ton nom (pour t'appeler)"}
          </div>
          <input
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder={!isTakeawayLike(serviceType) ? "Ex. 12" : "Ex. Julie"}
            className="w-full rounded-xl px-4 py-4 text-lg outline-none"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          />
        </div>
      )}

      {requireCommitment && (
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Numéro de téléphone</div>
          <p className="text-sm mb-2 leading-relaxed" style={{ color: "var(--color-text-faint)" }}>
            Sert à vous joindre si besoin au sujet de cette commande, et à la rattacher à votre carte de fidélité si vous en avez une. Jamais utilisé pour du démarchage.
          </p>
          <input
            value={phone || ""}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Ex. 06 12 34 56 78"
            className="w-full rounded-xl px-4 py-4 text-lg outline-none"
            style={{
              background: "var(--color-surface-card)",
              border: `1px solid ${phone && !isValidPhoneFr(phone) ? "var(--color-accent)" : "var(--color-border)"}`,
              color: "var(--color-text)",
            }}
          />
          {phone && !isValidPhoneFr(phone) && (
            <p className="text-sm mt-2" style={{ color: "var(--color-danger)" }}>Numéro invalide — format attendu : 06 12 34 56 78</p>
          )}

          <label className="flex items-start gap-3 mt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={commitmentAccepted === true}
              onChange={(e) => setCommitmentAccepted(e.target.checked)}
              className="mt-1 w-5 h-5 shrink-0"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <span className="text-sm leading-relaxed" style={{ color: "var(--color-text-subtle)" }}>
              En validant votre commande, vous vous engagez à venir la récupérer sur le créneau choisi. Toute commande non retirée reste due.
            </span>
          </label>

          <p className="text-sm mt-3">
            <button type="button" onClick={onOpenCgv} className="underline underline-offset-2 font-semibold tap-scale" style={{ color: "var(--color-accent-gold)" }}>
              Conditions générales de vente
            </button>
            <span style={{ color: "var(--color-text-faint)" }}> — {CGV_NO_SHOW_CLAUSE}</span>
          </p>
        </div>
      )}

      {setNote && (
        <div className="mb-8">
          <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-warning)" }}>
            📝 Note pour l'équipe (facultatif)
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex. Allergie noix, client pressé, anniversaire…"
            rows={2}
            className="w-full rounded-xl px-4 py-3 text-base outline-none resize-none"
            style={{ background: "var(--color-surface-card)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
          />
        </div>
      )}

      {setPaidUpfront && (
        <div className="mb-6">
          <div className="text-sm font-bold uppercase tracking-wide mb-2" style={{ color: "var(--color-text-muted)" }}>Règlement</div>
          <button
            onClick={() => setPaidUpfront(!paidUpfront)}
            className="tap-scale w-full rounded-xl py-4 px-4 font-bold border-2 flex items-center justify-center gap-2 text-center"
            style={
              paidUpfront
                ? { background: "var(--color-accent)", borderColor: "var(--color-accent)", color: "var(--color-text-alt)" }
                : { background: "var(--color-surface-card)", borderColor: "var(--color-border)", color: "var(--color-text-muted)" }
            }
          >
            {paidUpfront ? "✓ " : ""}💰 Déjà réglée par le client
          </button>
          <p className="text-xs mt-2 leading-relaxed" style={{ color: "var(--color-text-faint)" }}>
            À activer si le client paie maintenant et qu'une autre personne vient récupérer la commande.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <span className="text-xl font-bold">Total</span>
        <span className="display-font text-3xl font-bold" style={{ color: "var(--color-accent-gold)" }}>{eur(total)}</span>
      </div>
      <button onClick={onConfirm} disabled={!canConfirm} className="tap-scale rounded-full py-6 text-2xl font-bold disabled:opacity-40" style={{ background: "var(--color-accent)", color: "var(--color-text-alt)" }}>
        {pizzaCount > 0 && serviceType === TAKEAWAY_SERVICE_TYPE ? "Choisir mon créneau →" : "Valider ma commande →"}
      </button>
      {requireCommitment && !canConfirm && cart.length > 0 && (
        <p className="text-center text-sm mt-3" style={{ color: "var(--color-danger)" }}>
          Renseignez votre nom, un numéro de téléphone valide et cochez l'engagement pour valider.
        </p>
      )}
      <p className="text-center text-sm mt-4" style={{ color: "var(--color-text-faint)" }}>Le règlement se fait en caisse, après validation.</p>
    </div>
  );
}
