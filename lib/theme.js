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
    colorSurfaceCard: "#211712",
    colorBorder: "#3a2b1f",
    colorBorderMuted: "#4a3826",
    colorText: "#f5ebdd",
    colorTextAlt: "#fff5ea",
    colorTextMuted: "#a88f78",
    colorTextSubtle: "#c9b8a4",
    colorTextFaint: "#8a7561",
    colorTextDim: "#5a4a3a",
    colorAccent: "#C0392B",
    colorAccentGold: "#E8B23D",
    colorSurfaceCardAlt: "#221812",
    // Couleur de statut (dépannage/fallback) — pas une couleur de marque,
    // même valeur dans les deux thèmes (voir décision équivalente sur le
    // rouge d'erreur de PinScreen).
    colorWarning: "#ff5fa8",
    colorDanger: "#e88a8a",
    colorDangerSoft: "#e8a8a8",
    colorDangerStrong: "#ff6b6b",
    colorDangerBorder: "#7a2a2a",
    colorDangerSurface: "#2c1414",
    colorSuccess: "#a8e8c8",
    colorSuccessBg: "#204a3a",
    colorSuccessStrong: "#7fb069",
    colorTestAccent: "#f0c860",
    colorTestSurface: "#4a3a10",
    colorDangerBg: "#4a2020",
    colorDangerAlertBg: "#4a1c1c",
    colorAccentGoldBg: "#4a2c14",
    // Badges "type de service" (OrderCardHeader / serviceTypeBadgeStyle,
    // lib/business.js) — 3 couleurs de catégorisation, pas de marque.
    colorServiceImmediateBg: "#5a2a0a",
    colorServiceImmediateText: "#f0a860",
    colorServiceDineInBg: "#2c3e50",
    colorServiceDineInText: "#a8c8e8",
    colorServiceOtherBg: "#4a2c3e",
    colorServiceOtherText: "#e8a8c8",
    // Signal "ajout client via SAT non vu par l'équipe" — magenta vif,
    // volontairement très différent du reste de la palette pour attirer
    // l'œil (pastille + halo), même valeur sur les deux thèmes.
    colorFlag: "#ff2d95",
    // DeadlineBadge (chrono four) — urgence en temps réel, rouge/vert plus
    // saturés que danger/success (attirent l'œil sans se confondre avec les
    // badges de statut). colorUrgentNeutral = colorText (même valeur), gardé
    // distinct pour ne pas coupler ce composant au token texte principal.
    colorUrgentLate: "#ff4d4d",
    colorUrgentActive: "#4ade80",
    colorUrgentNeutral: "#f5ebdd",
    // OrderScreen (et TakeawayOrder/ProductCard/CheckoutScreen côté lien
    // /commande) utilisent une DEUXIÈME identité visuelle distincte de la
    // borne/l'équipe — plus sombre, accent orange — pour le catalogue client
    // en ligne (prop `clientView`). Ce n'est pas une variante par erreur :
    // c'est délibérément un habillage différent du même parcours. Capturé
    // ici tel quel (fidélité exacte), mais à re-questionner le jour où ÉLAN
    // doit respecter "cohérence totale" (charte DA §2) — voir mapping elan
    // ci-dessous qui, lui, réutilise les tokens principaux.
    colorClientBg: "#150e0a",
    colorClientSurface: "#1c1410",
    colorClientBorder: "#3a2a1f",
    colorClientTextMuted: "#b9a692",
    colorClientAccent: "#e8622c",
    colorClientAccentText: "#150e0a",
    colorClientAccentGold: "#d9a94c",
    colorClientAccentGoldText: "#e4b65b",
    colorClientText: "#f5ede3",
    colorClientPlaceholderFrom: "#3a2416",
    colorClientPlaceholderTo: "#1a120d",
  },
  elan: {
    colorBg: "#0B2118",
    colorBgGradientFrom: "#102D20",
    colorBgGradientVia: "#0B2118",
    colorBgGradientTo: "#0B2118",
    colorBgTeam: "#0B2118",
    colorSurface: "#102D20",
    colorSurfaceAlt: "#102D20",
    colorSurfaceCard: "#102D20",
    colorBorder: "#1a3d2c",
    colorBorderMuted: "#1a3d2c",
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
    colorSurfaceCardAlt: "#102D20",
    colorWarning: "#ff5fa8",
    colorDanger: "#e88a8a",
    colorDangerSoft: "#e8a8a8",
    colorDangerStrong: "#ff6b6b",
    colorDangerBorder: "#7a2a2a",
    colorDangerSurface: "#2c1414",
    colorSuccess: "#a8e8c8",
    colorSuccessBg: "#204a3a",
    colorSuccessStrong: "#7fb069",
    colorTestAccent: "#f0c860",
    colorTestSurface: "#4a3a10",
    colorDangerBg: "#4a2020",
    colorDangerAlertBg: "#4a1c1c",
    colorAccentGoldBg: "#4a2c14",
    colorServiceImmediateBg: "#5a2a0a",
    colorServiceImmediateText: "#f0a860",
    colorServiceDineInBg: "#2c3e50",
    colorServiceDineInText: "#a8c8e8",
    colorServiceOtherBg: "#4a2c3e",
    colorServiceOtherText: "#e8a8c8",
    colorFlag: "#ff2d95",
    colorUrgentLate: "#ff4d4d",
    colorUrgentActive: "#4ade80",
    colorUrgentNeutral: "#F4F1E8",
    // Charte DA §2 : "Cohérence totale — mêmes couleurs ... sur tous les
    // écrans". Contrairement à Casa, pas de deuxième identité pour le
    // catalogue client : ces tokens reprennent simplement les tokens
    // principaux.
    colorClientBg: "#0B2118",
    colorClientSurface: "#102D20",
    colorClientBorder: "#1a3d2c",
    colorClientTextMuted: "#A9B6A7",
    colorClientAccent: "#A8BE83",
    colorClientAccentText: "#0B2118",
    colorClientAccentGold: "#D8C878",
    colorClientAccentGoldText: "#D8C878",
    colorClientText: "#F4F1E8",
    colorClientPlaceholderFrom: "#102D20",
    colorClientPlaceholderTo: "#0B2118",
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
