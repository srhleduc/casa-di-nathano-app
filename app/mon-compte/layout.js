// Segment isolé de la page client publique. Titre d'onglet propre + noindex
// (page à partager par lien, pas à référencer).
export const metadata = {
  title: "Ma carte fidélité — Casa",
  description: "Consultez vos points de fidélité Casa et ajoutez votre carte à Google Wallet.",
  robots: { index: false, follow: false },
};

export default function MonCompteLayout({ children }) {
  return children;
}
