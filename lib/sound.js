"use client";

// Petit bip/carillon généré en direct (oscillateurs Web Audio) — pas de
// fichier audio à héberger. Utilisé pour signaler un évènement à ne pas
// manquer sur les écrans équipe (ex. commande autonome — voir TeamSpace).

let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  // Les navigateurs suspendent l'AudioContext tant qu'aucun geste utilisateur
  // n'a eu lieu sur la page — au moment où ce module sert (écran équipe),
  // le code PIN vient d'être saisi, donc un geste a déjà eu lieu.
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(ctx, freq, start, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

// Carillon deux notes ("ding-dong") — commande autonome (click & collect ou
// ajout /sat) qu'une équipe occupée pourrait manquer sans repère sonore.
export function playAutonomousOrderChime() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  tone(ctx, 880, now, 0.18);
  tone(ctx, 660, now + 0.2, 0.22);
}
