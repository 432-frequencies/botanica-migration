import { Link } from "react-router-dom";
import { APP_NAME, APP_TAGLINE, SUPPORT_EMAIL } from "@/lib/app-config";
import { ArrowLeft, Lock, Mail, MapPinned, Shield, Trash2 } from "lucide-react";

const SECTIONS = [
  {
    title: "Données collectées",
    icon: Shield,
    items: [
      "Compte: email, profil public, progression, XP et badges.",
      "Découvertes: photos prises ou choisies pour un scan, espèces identifiées, date et position si tu actives la géolocalisation.",
      "Usage: statistiques de scan, zones documentées et activité de saison.",
    ],
  },
  {
    title: "Pourquoi nous les utilisons",
    icon: MapPinned,
    items: [
      "Identifier les espèces et enrichir ton journal.",
      "Calculer tes zones, repères locaux, classements, défis et séries.",
      "Améliorer la qualité du service, corriger les bugs et assurer la sécurité.",
    ],
  },
  {
    title: "Partage limité",
    icon: Lock,
    items: [
      "Tes données sont hébergées chez nos prestataires techniques sécurisés.",
      "Les photos envoyées pour identification peuvent être traitées par nos services IA et d'identification partenaires.",
      "Cette version n'accède pas à ton carnet d'adresses.",
      "Nous ne vendons pas tes données personnelles.",
    ],
  },
  {
    title: "Suppression & contact",
    icon: Trash2,
    items: [
      "Tu peux supprimer ton compte directement depuis l'écran Profil.",
      `Tu peux aussi écrire à ${SUPPORT_EMAIL} pour toute demande liée à tes données.`,
      "Si une suppression échoue, le support peut t'accompagner et confirmer sa bonne prise en compte.",
    ],
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 60% 45% at 50% 0%, rgba(57,184,20,0.08) 0%, transparent 70%)" }} />

      <div className="relative z-10 mx-auto max-w-md px-5 pt-8 pb-12">
        <Link to="/" className="inline-flex items-center gap-2 min-h-[44px] text-xs font-black uppercase tracking-[0.2em]" style={{ color: "var(--v1v-fg-faint)" }}>
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>

        <div className="mt-6 mb-8">
          <p className="text-[9px] font-black uppercase tracking-[0.45em]" style={{ color: "var(--v1v-green-faint)" }}>
            {APP_NAME} • {APP_TAGLINE}
          </p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-[0.08em]" style={{ color: "var(--v1v-green)" }}>
            Politique de confidentialité
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
            Dernière mise à jour: 9 avril 2026. Cette page résume comment {APP_NAME} collecte, utilise et supprime les données liées à ton exploration.
          </p>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.title} className="p-4" style={{ background: "var(--v1v-surface-1)", border: "1px solid var(--v1v-green-ghost)" }}>
                <div className="mb-3 flex items-center gap-3">
                  <Icon className="w-4 h-4" style={{ color: "var(--v1v-green)" }} />
                  <h2 className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: "var(--v1v-fg)" }}>
                    {section.title}
                  </h2>
                </div>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <p key={item} className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                      {item}
                    </p>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-6 p-4" style={{ background: "var(--v1v-green-bg-subtle)", border: "1px solid var(--v1v-green-ghost)" }}>
          <div className="mb-2 flex items-center gap-3">
            <Mail className="w-4 h-4" style={{ color: "var(--v1v-green)" }} />
            <p className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: "var(--v1v-fg)" }}>
              Contact
            </p>
          </div>
          <p className="text-sm" style={{ color: "var(--v1v-fg-muted)" }}>
            Support: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--v1v-green)" }}>{SUPPORT_EMAIL}</a>
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--v1v-fg-muted)" }}>
            Besoin d'aide rapide ? <Link to="/support" style={{ color: "var(--v1v-green)" }}>Ouvrir le centre d'aide</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
