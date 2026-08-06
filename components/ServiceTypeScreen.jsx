"use client";

const OPTIONS = [
  { value: "🍽️ Sur place", label: "Sur place", desc: "Je m'installe en salle" },
  { value: "🥡 À emporter", label: "À emporter", desc: "Je repars avec ma commande" },
];

export default function ServiceTypeScreen({ onSelect }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <h2 className="display-font text-4xl font-semibold mb-10">Sur place ou à emporter ?</h2>
      <div className="flex flex-col md:flex-row gap-5 w-full max-w-xl">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className="tap-scale flex-1 rounded-3xl border-2 border-[#3a2b1f] bg-[#211712] px-8 py-10 flex flex-col items-center gap-2"
          >
            <span className="display-font text-3xl font-bold">{o.label}</span>
            <span className="text-[#a88f78]">{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
