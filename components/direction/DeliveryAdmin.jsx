"use client";

// Espace Direction → réglages de la livraison, établissement par établissement :
// activation, position du restaurant, mode de tarif (par zone / unique / selon
// la distance), rayon, minimum de commande, livraison offerte, délai estimé.
// Les prix affichés au client et enregistrés sur les commandes sont calculés
// par la base à partir de ces réglages (voir supabase/migrations_manual/delivery.sql).

import { useEffect, useRef, useState } from "react";
import { useRestaurantsList } from "@/lib/restaurant";
import { fetchDeliveryConfig, saveDeliveryConfig, DEFAULT_DELIVERY_SETTINGS } from "@/lib/data";
import { WAVE_SECTORS, buildWaveSchedule, parseHHMM, formatTimeInput, normalizeHHMM } from "@/lib/deliveryWaves";

const PRIMARY_BTN = { background: "#C0392B", color: "#fff5ea" };
const INPUT_STYLE = { background: "#211712", border: "1px solid #3a2b1f", color: "#f5ebdd" };

const FEE_MODES = [
  { key: "zone", label: "Un tarif par zone", desc: "Par commune / code postal" },
  { key: "flat", label: "Un tarif unique", desc: "Le même prix partout, dans un rayon" },
  { key: "distance", label: "Selon la distance", desc: "Calculé automatiquement, à vol d'oiseau" },
];

const toStr = (n) => (n == null ? "" : String(n).replace(".", ","));
const toNum = (v) => {
  const t = String(v ?? "").trim().replace(",", ".");
  if (t === "") return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const newId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function toForm(config) {
  const s = config.settings;
  return {
    enabled: s.enabled,
    feeMode: s.feeMode,
    flatFee: toStr(s.flatFee),
    distancePricing: s.distancePricing,
    perKmBase: toStr(s.perKmBase),
    perKmRate: toStr(s.perKmRate),
    maxRadiusKm: toStr(s.maxRadiusKm),
    minOrder: toStr(s.minOrder),
    freeDeliveryFrom: toStr(s.freeDeliveryFrom),
    estimatedMinutes: toStr(s.estimatedMinutes),
    lat: s.lat,
    lng: s.lng,
    wavesEnabled: Boolean(s.wavesEnabled),
    waves: (config.waves || []).map((w) => ({ id: w.departTime, departTime: w.departTime, sector: w.sector, capacity: toStr(w.capacity), active: w.active })),
    wavesAvailable: Boolean(config.wavesAvailable),
    zones: config.zones.map((z) => ({ id: z.id, label: z.label, postalCode: z.postalCode, fee: toStr(z.fee), minOrder: toStr(z.minOrder), active: z.active })),
    tiers: config.tiers.map((t) => ({ id: t.id, upToKm: toStr(t.upToKm), fee: toStr(t.fee) })),
    cities: config.cities.map((c) => ({ code: c.code, label: c.label, postalCodes: c.postalCodes, distanceKm: null, mode: c.mode, radiusKm: toStr(c.radiusKm), sector: c.sector || null })),
    citiesAvailable: config.citiesAvailable,
  };
}

// Fusionne la liste de communes proposée par le service (dans le rayon) avec
// les réglages déjà enregistrés : une commune déjà réglée garde son réglage,
// une nouvelle est proposée en « toute la ville ». Une commune enregistrée mais
// devenue hors rayon reste affichée (signalée), pour ne pas perdre son réglage.
function mergeCities(existing, fetched) {
  const byCode = new Map(existing.map((c) => [c.code, c]));
  const fetchedCodes = new Set(fetched.map((f) => f.code));
  const merged = fetched.map((f) => {
    const old = byCode.get(f.code);
    return {
      code: f.code,
      label: f.nom,
      postalCodes: (f.codesPostaux || []).join(", "),
      distanceKm: f.distanceKm,
      mode: old?.mode || "all",
      radiusKm: old?.radiusKm ?? "",
      sector: old?.sector ?? null,
    };
  });
  existing.filter((c) => !fetchedCodes.has(c.code)).forEach((c) => merged.push({ ...c, outOfRange: true }));
  return merged.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
}

// Valide le formulaire et le convertit en valeurs numériques ; renvoie
// { errors } s'il y a un problème, sinon { config }.
function fromForm(f) {
  const errors = [];
  const money = (v, label, { allowEmpty = false } = {}) => {
    if (allowEmpty && String(v ?? "").trim() === "") return null;
    const n = toNum(v);
    if (Number.isNaN(n) || n < 0) {
      errors.push(`${label} : saisissez un montant valide.`);
      return 0;
    }
    return n;
  };
  const needsRadius = f.feeMode !== "zone";
  const maxRadiusKm = needsRadius ? toNum(f.maxRadiusKm) : toNum(f.maxRadiusKm) > 0 ? toNum(f.maxRadiusKm) : 5;
  if (needsRadius && !(maxRadiusKm > 0)) errors.push("Rayon maximum : saisissez une distance en km supérieure à 0.");
  const estimatedMinutes = toNum(f.estimatedMinutes);
  if (!(estimatedMinutes > 0)) errors.push("Délai estimé : saisissez un nombre de minutes.");

  const settings = {
    enabled: f.enabled,
    feeMode: f.feeMode,
    flatFee: money(f.flatFee, "Tarif unique"),
    distancePricing: f.distancePricing,
    perKmBase: money(f.perKmBase, "Prix de base"),
    perKmRate: money(f.perKmRate, "Prix au km"),
    maxRadiusKm: Number.isFinite(maxRadiusKm) && maxRadiusKm > 0 ? maxRadiusKm : 5,
    minOrder: money(f.minOrder, "Minimum de commande"),
    freeDeliveryFrom: money(f.freeDeliveryFrom, "Livraison offerte dès", { allowEmpty: true }),
    estimatedMinutes: Math.round(estimatedMinutes) || 30,
    lat: f.lat,
    lng: f.lng,
    wavesEnabled: f.wavesEnabled,
  };

  const zones = f.zones.map((z) => ({
    id: z.id,
    label: z.label.trim(),
    postalCode: z.postalCode.trim(),
    fee: money(z.fee, `Zone ${z.label || z.postalCode}`),
    minOrder: money(z.minOrder, `Minimum de la zone ${z.label || z.postalCode}`, { allowEmpty: true }),
    active: z.active,
  }));
  const tiers = f.tiers.map((t) => ({ id: t.id, upToKm: toNum(t.upToKm), fee: money(t.fee, "Tranche") }));

  if (f.feeMode === "zone") {
    zones.forEach((z) => {
      if (!z.label) errors.push("Chaque zone doit avoir un nom.");
      if (!/^\d{5}$/.test(z.postalCode)) errors.push(`Zone « ${z.label || "?"} » : le code postal doit avoir 5 chiffres.`);
    });
    const codes = zones.map((z) => z.postalCode);
    if (new Set(codes).size !== codes.length) errors.push("Deux zones ont le même code postal.");
    if (f.enabled && zones.filter((z) => z.active).length === 0) errors.push("Ajoutez au moins une zone active pour activer la livraison.");
  }
  if (f.feeMode === "distance" && f.distancePricing === "tiers") {
    tiers.forEach((t) => {
      if (!(t.upToKm > 0)) errors.push("Chaque tranche doit avoir une distance en km supérieure à 0.");
    });
    const kms = tiers.map((t) => t.upToKm);
    if (new Set(kms).size !== kms.length) errors.push("Deux tranches ont la même distance.");
    if (f.enabled && tiers.length === 0) errors.push("Ajoutez au moins une tranche de distance pour activer la livraison.");
  }
  if (f.enabled && f.feeMode !== "zone" && (f.lat == null || f.lng == null)) {
    errors.push("Renseignez l'adresse du restaurant (point de départ des distances) pour activer ce mode.");
  }
  const cities = f.cities.map((c) => ({
    code: c.code,
    label: c.label,
    postalCodes: c.postalCodes,
    mode: c.mode,
    radiusKm: c.mode === "radius" ? toNum(c.radiusKm) : null,
    sector: c.sector || null,
  }));

  const waves = f.waves.map((w) => ({
    departTime: normalizeHHMM(w.departTime),
    sector: w.sector,
    capacity: Math.round(toNum(w.capacity)),
    active: w.active,
  }));
  if (f.wavesEnabled) {
    waves.forEach((w) => {
      if (parseHHMM(w.departTime) == null) errors.push(`Départ « ${w.departTime || "?"} » : saisissez une heure valide (ex. 19:00).`);
      if (!(w.capacity > 0)) errors.push(`Départ ${w.departTime || "?"} : le nombre maximum de commandes doit être au moins 1.`);
    });
    const times = waves.map((w) => w.departTime);
    if (new Set(times).size !== times.length) errors.push("Deux départs ont la même heure.");
    if (waves.filter((w) => w.active).length === 0) errors.push("Ajoutez au moins un départ actif pour activer les départs groupés.");
  }
  if (f.feeMode === "distance") {
    cities.forEach((c) => {
      if (c.mode === "radius" && !(c.radiusKm > 0)) errors.push(`${c.label} : saisissez un rayon en km pour la limiter.`);
    });
    if (f.enabled && cities.length > 0 && cities.every((c) => c.mode === "off")) errors.push("Toutes les villes sont désactivées : activez-en au moins une.");
  }
  return errors.length
    ? { errors: [...new Set(errors)] }
    : { config: { settings, zones, tiers, cities, citiesAvailable: f.citiesAvailable, waves, wavesAvailable: f.wavesAvailable } };
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-[#a88f78] uppercase tracking-wide mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[#8a7561] mt-1">{hint}</span>}
    </label>
  );
}

function NumInput({ value, onChange, suffix, placeholder, width = "w-28" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        className={`${width} rounded-lg px-3 py-2 text-base outline-none`}
        style={INPUT_STYLE}
      />
      {suffix && <span className="text-sm text-[#a88f78]">{suffix}</span>}
    </span>
  );
}

// Recherche de l'adresse du restaurant → position GPS (point de départ des distances).
function RestaurantLocation({ lat, lng, onPick }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || (picked && q === picked)) {
      setResults([]);
      return;
    }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/adresse?q=${encodeURIComponent(q)}`);
        const json = await res.json().catch(() => ({}));
        if (mine !== seq.current) return;
        setResults(json.results || []);
        setError(res.ok ? null : "Recherche d'adresse indisponible.");
      } catch {
        if (mine === seq.current) setError("Recherche d'adresse indisponible.");
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, picked]);

  const hasPos = lat != null && lng != null;
  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Adresse du restaurant (ex. 3 rue de l'Église, Riec-sur-Belon)"
        className="w-full rounded-lg px-3 py-3 text-base outline-none"
        style={INPUT_STYLE}
      />
      {error && <p className="text-sm mt-1" style={{ color: "#e88a8a" }}>{error}</p>}
      {results.length > 0 && (
        <div className="rounded-lg mt-1 overflow-hidden" style={INPUT_STYLE}>
          {results.map((r) => (
            <button
              key={`${r.label}-${r.lat}`}
              type="button"
              onClick={() => {
                setPicked(r.label);
                setQuery(r.label);
                setResults([]);
                onPick(r.lat, r.lng);
              }}
              className="tap-scale w-full text-left px-3 py-2 text-sm border-b last:border-b-0"
              style={{ borderColor: "#3a2b1f" }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: hasPos ? "#a8e8c8" : "#E8B23D" }}>
        {hasPos ? (
          <>
            📍 Position enregistrée —{" "}
            <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="underline">
              vérifier sur la carte
            </a>
          </>
        ) : (
          "Aucune position enregistrée. Elle est nécessaire pour les modes « tarif unique » et « selon la distance »."
        )}
      </p>
    </div>
  );
}

const CITY_MODES = [
  { key: "all", label: "Toute la ville" },
  { key: "radius", label: "Rayon limité" },
  { key: "off", label: "Désactivée" },
];

// « Villes desservies » (mode selon la distance) : les communes situées dans le
// rayon maximum, avec un réglage par ville.
function CitiesSection({ form, set, hasPosition }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const citiesRef = useRef(form.cities);
  citiesRef.current = form.cities;

  const radius = toNum(form.maxRadiusKm);
  const canLoad = hasPosition && radius > 0 && form.citiesAvailable;

  useEffect(() => {
    if (!canLoad) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/communes?lat=${form.lat}&lng=${form.lng}&radius=${radius}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error || "indisponible");
        set({ cities: mergeCities(citiesRef.current, json.communes || []) });
      } catch (err) {
        if (!cancelled) setError("Impossible de charger la liste des communes pour le moment. Réessayez dans un instant.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, form.lat, form.lng, radius, reloadKey]);

  const setCity = (code, patch) => set({ cities: form.cities.map((c) => (c.code === code ? { ...c, ...patch } : c)) });
  const setAll = (mode) => set({ cities: form.cities.map((c) => ({ ...c, mode, radiusKm: mode === "radius" ? c.radiusKm || form.maxRadiusKm : c.radiusKm })) });

  if (!form.citiesAvailable) {
    return (
      <p className="text-sm" style={{ color: "#E8B23D" }}>
        La liste des villes nécessite le script delivery_cities.sql (à exécuter dans Supabase). En attendant, seule la distance maximale s&apos;applique.
      </p>
    );
  }
  if (!hasPosition) {
    return <p className="text-sm text-[#8a7561]">Renseignez l&apos;adresse du restaurant ci-dessus pour voir les villes desservies.</p>;
  }

  return (
    <div>
      <h4 className="font-bold mb-1">🏘️ Villes desservies</h4>
      <p className="text-xs text-[#8a7561] mb-3">
        Communes dans un rayon de {form.maxRadiusKm || "?"} km autour du restaurant. Pour chacune : toute la ville, un rayon limité (pour les grandes communes),
        ou désactivée. « Toute la ville » livre même au-delà du rayon maximum.
      </p>
      {loading && <p className="text-sm text-[#8a7561] mb-2">Chargement des communes…</p>}
      {error && (
        <p className="text-sm mb-2" style={{ color: "#e88a8a" }}>
          {error}{" "}
          <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="underline font-semibold">
            Réessayer
          </button>
        </p>
      )}
      {form.cities.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          <button type="button" onClick={() => setAll("all")} className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
            Tout activer
          </button>
          <button type="button" onClick={() => setAll("off")} className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
            Tout désactiver
          </button>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {/* Communes désactivées regroupées en bas ; l'ordre par distance est conservé dans chaque groupe. */}
        {[...form.cities.filter((c) => c.mode !== "off"), ...form.cities.filter((c) => c.mode === "off")].map((c) => (
          <div key={c.code} className="rounded-xl p-3" style={{ background: "#211712", border: "1px solid #3a2b1f", opacity: c.mode === "off" ? 0.6 : 1 }}>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div>
                <span className="font-bold">{c.label}</span>
                {c.postalCodes && <span className="text-xs text-[#8a7561]"> · {c.postalCodes}</span>}
              </div>
              <span className="text-xs text-[#a88f78] shrink-0">{c.distanceKm != null ? `à ${String(c.distanceKm).replace(".", ",")} km` : "hors rayon"}</span>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {CITY_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setCity(c.code, { mode: m.key, radiusKm: m.key === "radius" && !c.radiusKm ? form.maxRadiusKm : c.radiusKm })}
                  className="tap-scale rounded-full px-4 py-2 text-sm font-bold border-2"
                  style={
                    c.mode === m.key
                      ? m.key === "off"
                        ? { borderColor: "#7a3a3a", background: "#2c1818" }
                        : { borderColor: "#C0392B", background: "#2c1c14" }
                      : { borderColor: "#3a2b1f" }
                  }
                >
                  {m.label}
                </button>
              ))}
              {c.mode === "radius" && (
                <span className="inline-flex items-center gap-2">
                  <span className="text-sm text-[#a88f78]">jusqu&apos;à</span>
                  <NumInput value={c.radiusKm} onChange={(v) => setCity(c.code, { radiusKm: v })} suffix="km" width="w-16" />
                </span>
              )}
            </div>
            {form.wavesAvailable && c.mode !== "off" && (
              <div className="flex gap-2 flex-wrap items-center mt-2">
                <span className="text-xs text-[#a88f78]">Secteur de tournée :</span>
                {[{ key: null, label: "Local (tous les départs)" }, ...WAVE_SECTORS].map((sec) => (
                  <button
                    key={sec.key ?? "local"}
                    type="button"
                    onClick={() => setCity(c.code, { sector: sec.key })}
                    className="tap-scale rounded-full px-3 py-1 text-xs font-bold border-2"
                    style={(c.sector || null) === sec.key ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f" }}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {!loading && !error && form.cities.length === 0 && <p className="text-sm text-[#8a7561]">Aucune commune trouvée dans ce rayon.</p>}
      </div>
    </div>
  );
}

// « Départs groupés » : un seul livreur → des départs fixes, chacun dédié à un
// secteur (la tournée est une boucle), avec un nombre maximum de commandes.
// Un départ plein disparaît de la liste proposée au client. Le secteur de
// chaque commune se règle dans « Villes desservies ».
function WavesSection({ form, set }) {
  if (!form.wavesAvailable) {
    return (
      <section>
        <h3 className="font-bold mb-2">🕒 Départs groupés</h3>
        <p className="text-sm text-[#8a7561]">Cette option nécessite le script delivery_waves.sql (à exécuter dans Supabase).</p>
      </section>
    );
  }
  const setWave = (id, patch) => set({ waves: form.waves.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
  const sorted = [...form.waves].sort((a, b) => (parseHHMM(a.departTime) ?? 1e9) - (parseHHMM(b.departTime) ?? 1e9));
  const generate = () => {
    if (form.waves.length > 0 && !window.confirm("Remplacer les départs actuels par la grille 18h30 → 21h00 (toutes les 30 min, Est/Sud en alternance) ?")) return;
    set({ waves: buildWaveSchedule().map((w) => ({ id: w.departTime, departTime: w.departTime, sector: w.sector, capacity: String(w.capacity), active: true })) });
  };
  return (
    <section>
      <h3 className="font-bold mb-2">🕒 Départs groupés</h3>
      <button
        onClick={() => set({ wavesEnabled: !form.wavesEnabled })}
        className="tap-scale w-full rounded-xl py-3 px-4 font-bold border-2 text-left flex items-center justify-between mb-3"
        style={form.wavesEnabled ? { background: "#204a3a", borderColor: "#204a3a", color: "#a8e8c8" } : { background: "#211712", borderColor: "#3a2b1f", color: "#a88f78" }}
      >
        <span>{form.wavesEnabled ? "✅ Départs groupés activés" : "⏸️ Départs groupés désactivés"}</span>
        <span className="text-xs font-normal">{form.wavesEnabled ? "Le client choisit un départ" : "Livraison sans limite par départ"}</span>
      </button>
      <p className="text-xs text-[#8a7561] mb-3">
        Le livreur part à l&apos;heure du départ avec les commandes d&apos;un seul secteur. Chaque heure de départ doit correspondre à un créneau four existant (créneaux de 10 min).
        Une commune « Local » peut monter dans n&apos;importe quel départ.
      </p>
      <div className="flex flex-col gap-2">
        {sorted.map((w) => (
          <div key={w.id} className="rounded-xl p-3 flex flex-wrap items-center gap-3" style={{ background: "#211712", border: "1px solid #3a2b1f", opacity: w.active ? 1 : 0.55 }}>
            <input
              value={w.departTime}
              onChange={(e) => setWave(w.id, { departTime: formatTimeInput(e.target.value) })}
              onBlur={() => setWave(w.id, { departTime: normalizeHHMM(w.departTime) })}
              placeholder="19:00"
              inputMode="numeric"
              className="w-20 rounded-lg px-3 py-2 text-base font-bold outline-none"
              style={INPUT_STYLE}
            />
            <div className="flex gap-1">
              {WAVE_SECTORS.map((sec) => (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => setWave(w.id, { sector: sec.key })}
                  className="tap-scale rounded-full px-3 py-1 text-sm font-bold border-2"
                  style={w.sector === sec.key ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f" }}
                >
                  {sec.label}
                </button>
              ))}
            </div>
            <span className="inline-flex items-center gap-2">
              <span className="text-sm text-[#a88f78]">max</span>
              <NumInput value={w.capacity} onChange={(v) => setWave(w.id, { capacity: v })} suffix="commandes" width="w-14" />
            </span>
            <button type="button" onClick={() => setWave(w.id, { active: !w.active })} className="tap-scale rounded-full px-3 py-1 text-sm font-bold border-2 border-[#3a2b1f]">
              {w.active ? "Actif" : "Désactivé"}
            </button>
            <button type="button" onClick={() => set({ waves: form.waves.filter((x) => x.id !== w.id) })} aria-label={`Supprimer le départ de ${w.departTime}`} className="tap-scale w-9 h-9 rounded-full font-bold ml-auto" style={{ background: "#4a2020", color: "#e88a8a" }}>
              ✕
            </button>
          </div>
        ))}
        {form.waves.length === 0 && <p className="text-sm text-[#8a7561]">Aucun départ.</p>}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={() => set({ waves: [...form.waves, { id: `new-${Date.now()}-${form.waves.length}`, departTime: "", sector: "est", capacity: "4", active: true }] })}
          className="tap-scale rounded-full px-5 py-2 font-bold border-2 border-[#3a2b1f]"
        >
          + Ajouter un départ
        </button>
        <button type="button" onClick={generate} className="tap-scale rounded-full px-5 py-2 font-bold border-2 border-[#3a2b1f]">
          ⚡ Générer 18h30 → 21h00
        </button>
      </div>
      {form.wavesEnabled && form.cities.length > 0 && form.cities.some((c) => c.mode !== "off" && !c.sector) && (
        <p className="text-xs mt-3" style={{ color: "#E8B23D" }}>
          Communes sans secteur (considérées « Local ») : {form.cities.filter((c) => c.mode !== "off" && !c.sector).map((c) => c.label).join(", ")}.
        </p>
      )}
    </section>
  );
}

function RestaurantDelivery({ restaurant }) {
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setForm(null);
    setLoadError(null);
    setErrors([]);
    setSaved(false);
    fetchDeliveryConfig(restaurant.id)
      .then((c) => !cancelled && setForm(toForm(c)))
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoadError("Impossible de charger les réglages. Le script delivery.sql a-t-il été exécuté dans Supabase ?");
      });
    return () => {
      cancelled = true;
    };
  }, [restaurant.id]);

  if (loadError) return <p className="text-sm" style={{ color: "#e88a8a" }}>{loadError}</p>;
  if (!form) return <p className="text-sm text-[#8a7561]">Chargement…</p>;

  const set = (patch) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };
  const setZone = (id, patch) => set({ zones: form.zones.map((z) => (z.id === id ? { ...z, ...patch } : z)) });
  const setTier = (id, patch) => set({ tiers: form.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });

  async function save() {
    const res = fromForm(form);
    if (res.errors) {
      setErrors(res.errors);
      setSaved(false);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      await saveDeliveryConfig(restaurant.id, res.config);
      setSaved(true);
    } catch (err) {
      console.error(err);
      setErrors([`Échec de l'enregistrement : ${err.message || err}`]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Activation */}
      <button
        onClick={() => set({ enabled: !form.enabled })}
        className="tap-scale w-full rounded-xl py-4 px-4 font-bold border-2 text-left flex items-center justify-between"
        style={form.enabled ? { background: "#204a3a", borderColor: "#204a3a", color: "#a8e8c8" } : { background: "#211712", borderColor: "#3a2b1f", color: "#a88f78" }}
      >
        <span>{form.enabled ? "✅ Livraison activée" : "⏸️ Livraison désactivée"}</span>
        <span className="text-xs font-normal">{form.enabled ? "Les clients voient « Me faire livrer »" : "Invisible pour les clients"}</span>
      </button>

      {/* Position */}
      <section>
        <h3 className="font-bold mb-2">📍 Adresse du restaurant</h3>
        <RestaurantLocation lat={form.lat} lng={form.lng} onPick={(lat, lng) => set({ lat, lng })} />
      </section>

      {/* Mode de tarif */}
      <section>
        <h3 className="font-bold mb-2">💶 Frais de livraison</h3>
        <div className="grid gap-2 md:grid-cols-3 mb-4">
          {FEE_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => set({ feeMode: m.key })}
              className="tap-scale rounded-xl px-4 py-3 border-2 text-left"
              style={form.feeMode === m.key ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f", background: "#211712" }}
            >
              <div className="font-bold">{m.label}</div>
              <div className="text-xs text-[#8a7561]">{m.desc}</div>
            </button>
          ))}
        </div>

        {form.feeMode === "zone" && (
          <div className="flex flex-col gap-2">
            {form.zones.length === 0 && <p className="text-sm text-[#8a7561]">Aucune zone. Ajoutez les communes que vous livrez.</p>}
            {form.zones.map((z) => (
              <div key={z.id} className="rounded-xl p-3 flex flex-wrap items-end gap-3" style={{ background: "#211712", border: "1px solid #3a2b1f", opacity: z.active ? 1 : 0.55 }}>
                <Field label="Commune">
                  <input value={z.label} onChange={(e) => setZone(z.id, { label: e.target.value })} placeholder="Riec-sur-Belon" className="w-44 rounded-lg px-3 py-2 outline-none" style={INPUT_STYLE} />
                </Field>
                <Field label="Code postal">
                  <input value={z.postalCode} onChange={(e) => setZone(z.id, { postalCode: e.target.value })} inputMode="numeric" maxLength={5} placeholder="29340" className="w-24 rounded-lg px-3 py-2 outline-none" style={INPUT_STYLE} />
                </Field>
                <Field label="Frais">
                  <NumInput value={z.fee} onChange={(v) => setZone(z.id, { fee: v })} suffix="€" width="w-20" />
                </Field>
                <Field label="Minimum" hint="vide = général">
                  <NumInput value={z.minOrder} onChange={(v) => setZone(z.id, { minOrder: v })} suffix="€" width="w-20" />
                </Field>
                <button onClick={() => setZone(z.id, { active: !z.active })} className="tap-scale rounded-lg px-3 py-2 text-sm font-bold border-2 border-[#3a2b1f]">
                  {z.active ? "Active" : "En pause"}
                </button>
                <button onClick={() => set({ zones: form.zones.filter((x) => x.id !== z.id) })} aria-label="Supprimer la zone" className="tap-scale w-9 h-9 rounded-full font-bold" style={{ background: "#4a2020", color: "#e88a8a" }}>
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => set({ zones: [...form.zones, { id: newId(), label: "", postalCode: "", fee: "", minOrder: "", active: true }] })}
              className="tap-scale self-start rounded-full px-5 py-2 font-bold border-2 border-[#3a2b1f]"
            >
              + Ajouter une zone
            </button>
          </div>
        )}

        {form.feeMode === "flat" && (
          <div className="flex flex-wrap gap-6">
            <Field label="Frais de livraison">
              <NumInput value={form.flatFee} onChange={(v) => set({ flatFee: v })} suffix="€" />
            </Field>
            <Field label="Rayon maximum" hint="Au-delà, on ne livre pas">
              <NumInput value={form.maxRadiusKm} onChange={(v) => set({ maxRadiusKm: v })} suffix="km" />
            </Field>
          </div>
        )}

        {form.feeMode === "distance" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-6">
              <Field label="Rayon maximum" hint="Au-delà, on ne livre pas">
                <NumInput value={form.maxRadiusKm} onChange={(v) => set({ maxRadiusKm: v })} suffix="km" />
              </Field>
            </div>
            <div className="flex gap-2">
              {[
                { key: "tiers", label: "Par tranches" },
                { key: "per_km", label: "Base + prix au km" },
              ].map((m) => (
                <button
                  key={m.key}
                  onClick={() => set({ distancePricing: m.key })}
                  className="tap-scale rounded-full px-5 py-2 font-bold border-2"
                  style={form.distancePricing === m.key ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f" }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {form.distancePricing === "tiers" ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-[#8a7561]">Exemple : jusqu&apos;à 2 km → 2 € ; jusqu&apos;à 5 km → 4 €. Au-delà de la dernière tranche, pas de livraison.</p>
                {form.tiers.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className="text-sm text-[#a88f78]">Jusqu&apos;à</span>
                    <NumInput value={t.upToKm} onChange={(v) => setTier(t.id, { upToKm: v })} suffix="km" width="w-20" />
                    <span className="text-sm text-[#a88f78]">→</span>
                    <NumInput value={t.fee} onChange={(v) => setTier(t.id, { fee: v })} suffix="€" width="w-20" />
                    <button onClick={() => set({ tiers: form.tiers.filter((x) => x.id !== t.id) })} aria-label="Supprimer la tranche" className="tap-scale w-9 h-9 rounded-full font-bold" style={{ background: "#4a2020", color: "#e88a8a" }}>
                      ✕
                    </button>
                  </div>
                ))}
                <button onClick={() => set({ tiers: [...form.tiers, { id: newId(), upToKm: "", fee: "" }] })} className="tap-scale self-start rounded-full px-5 py-2 font-bold border-2 border-[#3a2b1f]">
                  + Ajouter une tranche
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-6">
                <Field label="Prix de base">
                  <NumInput value={form.perKmBase} onChange={(v) => set({ perKmBase: v })} suffix="€" />
                </Field>
                <Field label="Prix au km" hint="Frais = base + prix au km × distance">
                  <NumInput value={form.perKmRate} onChange={(v) => set({ perKmRate: v })} suffix="€ / km" />
                </Field>
              </div>
            )}

            <CitiesSection form={form} set={set} hasPosition={form.lat != null && form.lng != null} />
          </div>
        )}
      </section>

      <WavesSection form={form} set={set} />

      {/* Règles communes */}
      <section>
        <h3 className="font-bold mb-2">⚙️ Règles générales</h3>
        <div className="flex flex-wrap gap-6">
          <Field label="Minimum de commande" hint="Articles, hors frais">
            <NumInput value={form.minOrder} onChange={(v) => set({ minOrder: v })} suffix="€" />
          </Field>
          <Field label="Livraison offerte dès" hint="Vide = jamais offerte">
            <NumInput value={form.freeDeliveryFrom} onChange={(v) => set({ freeDeliveryFrom: v })} suffix="€" />
          </Field>
          <Field label="Délai estimé" hint="Après la préparation">
            <NumInput value={form.estimatedMinutes} onChange={(v) => set({ estimatedMinutes: v })} suffix="min" />
          </Field>
        </div>
      </section>

      {errors.length > 0 && (
        <div className="rounded-xl px-4 py-3" style={{ background: "#2c1c14", border: "1px solid #C0392B" }}>
          <ul className="text-sm list-disc pl-5" style={{ color: "#e88a8a" }}>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center gap-4">
        <button onClick={save} disabled={saving} className="tap-scale rounded-full px-10 py-4 text-lg font-bold disabled:opacity-50" style={PRIMARY_BTN}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-sm font-bold" style={{ color: "#a8e8c8" }}>✓ Enregistré</span>}
      </div>
    </div>
  );
}

export default function DeliveryAdmin() {
  const restaurants = useRestaurantsList();
  const [selectedId, setSelectedId] = useState(null);
  const current = restaurants.find((r) => r.id === selectedId) || restaurants[0];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <p className="text-[#a88f78] text-sm mb-6 max-w-2xl">
        Livraison par l&apos;équipe, réglée établissement par établissement. Le client voit le prix exact avant de commander ; il est
        recalculé par le serveur à la validation. Le règlement se fait auprès du livreur.
      </p>
      {restaurants.length === 0 && <p className="text-sm text-[#8a7561]">Chargement…</p>}
      {restaurants.length > 1 && (
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {restaurants.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className="tap-scale shrink-0 rounded-full px-6 py-3 font-bold border-2"
              style={current?.id === r.id ? { borderColor: "#C0392B", background: "#2c1c14" } : { borderColor: "#3a2b1f" }}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
      <div className="max-w-3xl">{current && <RestaurantDelivery key={current.id} restaurant={current} />}</div>
    </div>
  );
}
