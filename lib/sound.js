"use client";

// Petit bip/carillon généré en direct (oscillateurs Web Audio) — pas de
// fichier audio à héberger. Utilisé pour signaler un évènement à ne pas
// manquer sur les écrans équipe (ex. commande autonome — voir TeamSpace).

let audioCtx = null;
// url -> Promise<AudioBuffer|null> (null si le fichier n'a pas pu être décodé).
const customSoundBuffers = new Map();

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

// À appeler depuis un vrai geste utilisateur (ex. saisie du code PIN équipe)
// pour créer/débloquer l'AudioContext pendant qu'un geste est encore actif —
// les navigateurs bloquent silencieusement la création/le resume() d'un
// AudioContext hors geste utilisateur, et playAutonomousOrderChime() est lui
// déclenché bien plus tard par un évènement realtime (donc hors geste).
export function primeAudioContext() {
  getAudioContext();
}

// Précharge et décode un son personnalisé (importé depuis l'espace Direction —
// voir NotificationSoundAdmin) dès qu'on connaît son URL, pour qu'il soit déjà
// prêt en mémoire le jour où une commande arrive — le décoder à la volée
// ajouterait un aller-retour réseau avant de pouvoir jouer le son.
export function preloadCustomSound(url) {
  if (!url || customSoundBuffers.has(url)) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  customSoundBuffers.set(
    url,
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .catch((err) => {
        console.error("Son de notification personnalisé illisible, retour au carillon par défaut", err);
        customSoundBuffers.delete(url);
        return null;
      })
  );
}

function playBuiltinChime(ctx) {
  const now = ctx.currentTime;
  tone(ctx, 880, now, 0.18);
  tone(ctx, 660, now + 0.2, 0.22);
}

// Carillon "commande autonome" (click & collect ou ajout /sat) qu'une équipe
// occupée pourrait manquer sans repère sonore. Joue le son personnalisé de
// l'établissement s'il en a un ; sinon (ou en cas d'échec) le carillon
// par défaut.
export async function playAutonomousOrderChime(customSoundUrl) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (customSoundUrl) {
    preloadCustomSound(customSoundUrl);
    const buffer = await customSoundBuffers.get(customSoundUrl);
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(ctx.currentTime);
      return;
    }
  }
  playBuiltinChime(ctx);
}
