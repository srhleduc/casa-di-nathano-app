// Tokens de design, résolus au build par variable d'environnement — même
// principe que RESTAURANT_ID dans lib/restaurant.js : un déploiement Vercel =
// un établissement = un thème (pas de moteur de theming au runtime, voir
// AUDIT_CASA.md §6.2). "casa" reproduit exactement la palette café/brique
// actuelle de Nathano/Luigi (aucun changement visuel). "elan" est la charte
// livrée dans Direction_artistique_Elan_App_pour_Claude_v2.docx, prête pour
// le premier établissement client qui ne doit pas hériter de l'identité Casa.
//
// Ce fichier est la seule source de vérité pour ces couleurs : les composants
// existants restent en hex en dur pour l'instant (migration prévue écran par
// écran, pas en un seul chantier) et ne sont pas concernés par ce fichier.
// Seules les classes partagées de app/globals.css consomment ces tokens.

const THEMES = {
  casa: {
    colorBg: "#1a120b",
    colorBgGradientFrom: "#3a2013",
    colorBgGradientVia: "#1a120b",
    colorBgGradientTo: "#120c07",
    colorBgTeam: "#140d08",
    colorSurface: "#241811",
    colorSurfaceAlt: "#2c1c14",
    colorBorder: "#3a2b1f",
    colorText: "#f5ebdd",
    colorTextAlt: "#fff5ea",
    colorTextMuted: "#a88f78",
    colorTextSubtle: "#c9b8a4",
    colorTextFaint: "#8a7561",
    colorTextDim: "#5a4a3a",
    colorAccent: "#C0392B",
    colorAccentGold: "#E8B23D",
  },
  elan: {
    colorBg: "#0B2118",
    colorBgGradientFrom: "#102D20",
    colorBgGradientVia: "#0B2118",
    colorBgGradientTo: "#0B2118",
    colorBgTeam: "#0B2118",
    colorSurface: "#102D20",
    colorSurfaceAlt: "#102D20",
    colorBorder: "#1a3d2c",
    colorText: "#F4F1E8",
    colorTextAlt: "#F4F1E8",
    colorTextMuted: "#A9B6A7",
    // La charte DA ne définit qu'un seul ton de texte secondaire (vert grisé) —
    // pas de dégradé à trois niveaux comme sur Casa. Les trois tokens
    // pointent vers la même valeur en attendant un usage réel qui justifie
    // de les différencier (voir ELAN_vision_et_strategie_v2.md §6 : ne pas
    // généraliser avant besoin concret).
    colorTextSubtle: "#A9B6A7",
    colorTextFaint: "#A9B6A7",
    colorTextDim: "#A9B6A7",
    colorAccent: "#A8BE83",
    colorAccentGold: "#D8C878",
  },
};

export const THEME_NAME = THEMES[process.env.NEXT_PUBLIC_THEME] ? process.env.NEXT_PUBLIC_THEME : "casa";
export const theme = THEMES[THEME_NAME];

// Objet {"--color-bg": "#1a120b", ...} à passer en style inline sur <html> —
// voir app/layout.js. Dérivé automatiquement des clés ci-dessus (colorBg ->
// --color-bg) pour ne jamais avoir à synchroniser deux listes à la main.
export function themeCssVars(t = theme) {
  const vars = {};
  for (const [key, value] of Object.entries(t)) {
    const cssName = "--color" + key.replace(/^color/, "").replace(/([A-Z])/g, "-$1").toLowerCase();
    vars[cssName] = value;
  }
  return vars;
}
