"use client";

// Note d'information RGPD affichée sur la tablette (écran d'onboarding),
// en complément de la note papier signée par chaque salarié — voir le
// cahier des charges du module Pointage, §3 (information des salariés
// avant mise en service).

const ESTABLISHMENTS = {
  riec: {
    name: "LA CASA DI NATHANO",
    address: "4 Rue des Gentilhommes, 29340 Riec-sur-Bélon",
  },
  quimperle: {
    name: "Casa Di Luigi",
    address: "64 Boulevard de la Gare, 29300 Quimperlé",
  },
};

function Section({ n, title, children }) {
  return (
    <div className="mb-5">
      <div className="text-sm font-bold text-[#f5ebdd] mb-1">
        {n}. {title}
      </div>
      <div className="text-sm text-[#c9b8a4] leading-relaxed">{children}</div>
    </div>
  );
}

export default function PointageInfoNotice({ restaurantId, onClose }) {
  const establishment = ESTABLISHMENTS[restaurantId] || null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4" style={{ background: "rgba(10, 6, 3, 0.92)" }}>
      <div className="w-full max-w-2xl rounded-3xl border-2 border-[#3a2b1f] bg-[#150e0a] p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="display-font text-2xl font-bold text-[#f5ebdd]">Note d'information RGPD</div>
            <div className="text-sm text-[#a88f78]">Dispositif de pointage du temps de travail</div>
          </div>
          <button onClick={onClose} className="tap-scale shrink-0 rounded-full px-4 py-2 text-sm font-bold border-2 border-[#3a2b1f] text-[#c9b8a4]">
            Fermer
          </button>
        </div>

        <div className="rounded-2xl border border-[#3a2b1f] bg-[#211712] p-4 mb-6 text-sm text-[#c9b8a4]">
          <div>
            <strong className="text-[#f5ebdd]">Société :</strong> PIZZADIMAMENE, SARL à associé unique au capital de 5 000 €
          </div>
          <div>
            <strong className="text-[#f5ebdd]">SIRET / RCS :</strong> 914 454 160 R.C.S. Quimper
          </div>
          <div>
            <strong className="text-[#f5ebdd]">Gérant :</strong> Nathan Baraté
          </div>
          {establishment && (
            <div>
              <strong className="text-[#f5ebdd]">Établissement :</strong> {establishment.name} — {establishment.address}
            </div>
          )}
        </div>

        <p className="text-sm text-[#c9b8a4] mb-6">
          Conformément à l'article L.1222-4 du Code du travail et au Règlement Général sur la Protection des Données
          (RGPD), vous êtes informé(e) de la mise en place du dispositif suivant.
        </p>

        <Section n={1} title="Objet du dispositif">
          L'établissement met en place une badgeuse électronique permettant d'enregistrer les heures d'arrivée, de
          début et fin de pause, et de départ de chaque salarié, au moyen d'un code personnel à 4 chiffres saisi sur
          une tablette fixe située au comptoir.
        </Section>

        <Section n={2} title="Finalité">
          Ce dispositif a pour seule finalité le décompte du temps de travail effectif, nécessaire à l'établissement
          de la paie et à la preuve des horaires travaillés en cas de contrôle ou de litige (article L.3171-4 du Code
          du travail : la preuve des heures de travail incombe à l'employeur).
        </Section>

        <Section n={3} title="Données collectées">
          Nom du salarié et code PIN qui lui est propre, horodatage de chaque pointage (arrivée, début de pause, fin
          de pause, départ), type de contrat. Aucune géolocalisation ni photographie n'est collectée. Ces options
          existent techniquement mais sont désactivées ; si elles devaient être activées un jour, vous en seriez
          informé(e) au préalable par une note complémentaire, conformément au principe de minimisation des données.
        </Section>

        <Section n={4} title="Base légale">
          Le traitement repose sur l'intérêt légitime de l'employeur à assurer le suivi du temps de travail et à se
          conformer à ses obligations légales en matière de décompte des heures.
        </Section>

        <Section n={5} title="Fiabilité et intégrité des données">
          Un pointage enregistré ne peut pas être modifié ou supprimé directement, y compris par la direction. Toute
          régularisation (oubli de pointage, erreur) fait l'objet d'une correction tracée séparément, mentionnant qui
          a corrigé, quand, et pourquoi.
        </Section>

        <Section n={6} title="Durée de conservation">
          Les données de pointage sont conservées 5 ans, conformément aux obligations légales de conservation des
          registres du temps de travail.
        </Section>

        <Section n={7} title="Destinataires">
          Seules les personnes habilitées ont accès à ces données : l'équipe d'encadrement de l'établissement, et la
          direction de PIZZADIMAMENE (accès en lecture aux deux établissements). Aucune donnée n'est transmise à un
          tiers.
        </Section>

        <Section n={8} title="Vos droits">
          Vous disposez d'un droit d'accès, de rectification, de limitation et d'opposition sur les données vous
          concernant. Vous pouvez exercer ces droits en contactant <strong className="text-[#f5ebdd]">srhleduc@gmail.com</strong>.
          Vous disposez également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr).
        </Section>

        <Section n={9} title="Entrée en vigueur">
          Ce dispositif est en service depuis le 22/04/2026.
        </Section>

        <div className="text-xs text-[#8a7561] mt-6 pt-4 border-t border-[#3a2b1f]">
          Cet écran complète, sans la remplacer, la note papier datée et signée remise à chaque salarié à son
          arrivée.
        </div>
      </div>
    </div>
  );
}
