// Généré au build, à partir de la variable d'environnement propre à chaque
// déploiement — remplace public/manifest.json (statique, identique pour
// tous les restaurants) pour que le nom affiché sur l'écran d'accueil
// corresponde au bon établissement.
const RESTAURANT_NAMES = { riec: "Casa Di Nathano", quimperle: "Casa Di Luigi" };
const restaurantName = RESTAURANT_NAMES[process.env.NEXT_PUBLIC_RESTAURANT_ID] || "Casa Di Nathano";

export default function manifest() {
  return {
    id: "/",
    name: restaurantName,
    short_name: restaurantName.length > 14 ? "Casa" : restaurantName,
    description: `Borne de commande et espace équipe — ${restaurantName}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#1a120b",
    theme_color: "#1a120b",
    lang: "fr",
    dir: "ltr",
    categories: ["food", "business"],
    icons: [
      { src: "/icons/icon-48.png", sizes: "48x48", type: "image/png", purpose: "any" },
      { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png", purpose: "any" },
      { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png", purpose: "any" },
      { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png", purpose: "any" },
      { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png", purpose: "any" },
      { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
