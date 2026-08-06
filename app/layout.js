import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

// Le titre d'onglet/écran d'accueil PWA est figé au build (metadata Next.js
// est statique) — chaque restaurant a son propre déploiement avec sa propre
// variable d'environnement, donc cette petite table locale suffit à afficher
// le bon nom sans appel réseau. Le contenu affiché à l'écran, lui, vient
// toujours de la table `restaurants` en base (voir lib/restaurant.js).
const RESTAURANT_NAMES = { riec: "Casa Di Nathano", quimperle: "Casa Di Luigi" };
const restaurantName =
  process.env.NEXT_PUBLIC_APP_MODE === "direction"
    ? "Casa Di Nathano — Direction"
    : RESTAURANT_NAMES[process.env.NEXT_PUBLIC_RESTAURANT_ID] || "Casa Di Nathano";

export const metadata = {
  title: restaurantName,
  description: `Borne de commande et espace équipe — ${restaurantName}`,
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black",
    title: restaurantName,
  },
};

export const viewport = {
  themeColor: "#1a120b",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
