import { Link } from "react-router-dom";
import { APP_NAME, APP_TAGLINE, SUPPORT_EMAIL } from "@/lib/app-config";
import { ArrowLeft, ExternalLink, Mail, Shield, Trash2, Bug } from "lucide-react";

const SUPPORT_CARDS = [
  {
    title: "Support utilisateur",
    body: `Pour un bug, une question ou une demande d'aide, écris-nous à ${SUPPORT_EMAIL}.`,
    icon: Mail,
  },
  {
    title: "Suppression de compte",
    body: "Tu peux supprimer ton compte depuis Profil > Supprimer le compte. Si besoin, notre équipe peut aussi t'aider par email.",
    icon: Trash2,
  },
  {
    title: "Vie privée",
    body: "Retrouve le détail des données utilisées pour les scans, les zones et les classements dans notre politique de confidentialité.",
    icon: Shield,
  },
  {
    title: "Signalement d'incident",
    body: "Si un bug bloque l'accès au compte, au scan ou à la suppression, écris-nous et nous te répondons dès que possible.",
    icon: Bug,
  },
];

export default function Support() {
  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse 65% 50% at 50% 0%, rgba(57,184,20,0.08) 0%, transparent 72%)" }} />

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
            Centre d'aide
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
            Un point de contact simple pour les questions liées au compte, au scan, à la confidentialité et à la fiabilité du service.
          </p>
        </div>

        <div className="space-y-4">
          {SUPPORT_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <section key={card.title} className="p-4" style={{ background: "var(--v1v-surface-1)", border: "1px solid var(--v1v-green-ghost)" }}>
                <div className="mb-3 flex items-center gap-3">
                  <Icon className="w-4 h-4" style={{ color: "var(--v1v-green)" }} />
                  <h2 className="text-xs font-black uppercase tracking-[0.25em]" style={{ color: "var(--v1v-fg)" }}>
                    {card.title}
                  </h2>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                  {card.body}
                </p>
              </section>
            );
          })}
        </div>

        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.3em]"
          style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
        >
          <Mail className="w-4 h-4" />
          Contacter le support
        </a>

        <Link
          to="/privacy"
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 text-xs font-black uppercase tracking-[0.25em]"
          style={{ border: "1px solid var(--v1v-green-ghost)", color: "var(--v1v-green-faint)" }}
        >
          <ExternalLink className="w-4 h-4" />
          Voir la confidentialité
        </Link>
      </div>
    </div>
  );
}
