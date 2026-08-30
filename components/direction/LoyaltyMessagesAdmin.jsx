"use client";

// Espace Direction → Messages fidélité. Le patron paramètre le texte des SMS
// fidélité (un générique est proposé par défaut, modifiable). L'envoi effectif
// via l'API OVH sera branché en phase G ; ici on ne fait que stocker les textes.

import { useEffect, useState } from "react";
import { useLoyaltyMessageTemplates, upsertLoyaltyMessageTemplate } from "@/lib/data";

const INPUT_STYLE = { background: "#140d08", border: "1px solid #3a2b1f", color: "#f5ebdd" };
const PRIMARY_BTN = { background: "#C0392B", color: "#fff5ea" };

// Ordre d'affichage + textes génériques par défaut (doivent rester alignés
// avec le seed de supabase/schema.sql). `vars` = placeholders pertinents.
const TEMPLATES = [
  {
    key: "bienvenue",
    label: "Message de bienvenue",
    when: "Envoyé une fois, à la création du compte fidélité du client.",
    vars: ["{restaurant}", "{prenom}"],
    body: "Bienvenue chez {restaurant} ! Votre carte de fidelite est active : 1 point par euro depense, et un bon de 5 EUR tous les 150 points. A tres vite !",
  },
  {
    key: "avis_google",
    label: "Demande d'avis Google (après 3 passages)",
    when: "Envoyé une fois, quand le client atteint 3 passages. Pensez à coller votre lien Google dans le texte.",
    vars: ["{restaurant}", "{prenom}"],
    body: "Merci de votre visite chez {restaurant} ! Si vous avez passe un bon moment, votre avis Google compte beaucoup pour nous : [collez ici votre lien Google]. Merci !",
  },
  {
    key: "anniversaire",
    label: "Message d'anniversaire",
    when: "Envoyé le jour de l'anniversaire du client, avec le bon de 5 €.",
    vars: ["{restaurant}", "{prenom}", "{code}", "{expiration}"],
    body: "Joyeux anniversaire de la part de {restaurant} ! Pour feter ca, un bon de 5 EUR vous attend (code {code}), valable jusqu'au {expiration}. A bientot !",
  },
  {
    key: "recompense_150",
    label: "Bon de 5 € — palier 150 points",
    when: "Envoyé quand le client franchit un multiple de 150 points, avec le bon de 5 €.",
    vars: ["{restaurant}", "{prenom}", "{code}", "{expiration}"],
    body: "Bravo {prenom} ! Vous avez atteint 150 points chez {restaurant} : un bon de 5 EUR est a vous (code {code}), valable jusqu'au {expiration}. Merci de votre fidelite !",
  },
];

const PREVIEW_VALUES = {
  "{restaurant}": "Casa Di Nathano",
  "{prenom}": "Marie",
  "{code}": "CASA-4F2A9C",
  "{expiration}": "21/09/2026",
};

function render(body) {
  return Object.entries(PREVIEW_VALUES).reduce((s, [k, v]) => s.split(k).join(v), body || "");
}

export default function LoyaltyMessagesAdmin() {
  const { templates, loading } = useLoyaltyMessageTemplates();
  const byKey = Object.fromEntries(templates.map((t) => [t.key, t]));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-6 max-w-3xl">
        Textes des SMS fidélité. Un message générique est proposé par défaut ; modifiez-le à votre convenance et enregistrez.
        Les variables entre accolades sont remplacées à l&apos;envoi. L&apos;envoi automatique par SMS sera activé
        ultérieurement — pour l&apos;instant seuls les textes sont enregistrés.
      </p>

      {loading && <p className="text-[#8a7561]">Chargement…</p>}

      <div className="flex flex-col gap-5 max-w-3xl">
        {TEMPLATES.map((tpl) => (
          <TemplateCard key={tpl.key} tpl={tpl} saved={byKey[tpl.key]} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ tpl, saved }) {
  const [body, setBody] = useState(saved?.body ?? tpl.body);
  const [enabled, setEnabled] = useState(saved?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // 'ok' | 'err' | null
  const [touched, setTouched] = useState(false);

  // Synchronise depuis la base tant que l'utilisateur n'a pas commencé à éditer.
  useEffect(() => {
    if (touched) return;
    if (saved) {
      setBody(saved.body);
      setEnabled(saved.enabled);
    }
  }, [saved, touched]);

  const dirty = touched && (body !== (saved?.body ?? tpl.body) || enabled !== (saved?.enabled ?? true));
  const isDefault = body.trim() === tpl.body.trim();

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      await upsertLoyaltyMessageTemplate({ key: tpl.key, label: tpl.label, body, enabled });
      setStatus("ok");
      setTouched(false);
    } catch (err) {
      console.error(err);
      setStatus("err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#3a2b1f] bg-[#211712] p-4">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="font-bold">{tpl.label}</div>
        <label className="flex items-center gap-2 text-xs font-bold shrink-0 text-[#a88f78]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setTouched(true);
              setEnabled(e.target.checked);
            }}
          />
          {enabled ? "Actif" : "Désactivé"}
        </label>
      </div>
      <div className="text-xs text-[#8a7561] mb-3">{tpl.when}</div>

      <textarea
        value={body}
        onChange={(e) => {
          setTouched(true);
          setBody(e.target.value);
          setStatus(null);
        }}
        rows={4}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={INPUT_STYLE}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[#8a7561]">
        <span>{body.length} caractères{body.length > 160 ? ` (~${Math.ceil(body.length / 153)} SMS)` : ""}</span>
        <span>Variables : {tpl.vars.join("  ")}</span>
        {isDefault && <span className="text-[#7fb069]">texte par défaut</span>}
      </div>

      <div className="mt-3 rounded-lg border border-[#2a1f16] bg-[#140d08] px-3 py-2 text-sm text-[#c9b8a4]">
        <div className="text-[10px] uppercase font-bold text-[#8a7561] mb-1">Aperçu</div>
        {render(body)}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="tap-scale rounded-lg px-4 py-2 font-bold text-sm disabled:opacity-40"
          style={PRIMARY_BTN}
        >
          Enregistrer
        </button>
        {!isDefault && (
          <button
            onClick={() => {
              setTouched(true);
              setBody(tpl.body);
              setStatus(null);
            }}
            className="tap-scale rounded-lg px-4 py-2 font-bold text-sm border-2 border-[#3a2b1f]"
          >
            Réinitialiser au texte par défaut
          </button>
        )}
        {status === "ok" && !dirty && <span className="text-xs font-bold text-[#7fb069]">Enregistré ✓</span>}
        {status === "err" && <span className="text-xs font-bold text-[#e88a8a]">Échec de l&apos;enregistrement</span>}
      </div>
    </div>
  );
}
