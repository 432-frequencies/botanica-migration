import { useState, useEffect, useRef } from "react";
import { X, Globe, Utensils, FlaskConical, Leaf, Sprout, AlertTriangle, Mountain, Bird, Shield, Lightbulb, ChevronDown } from "lucide-react";

const SECTIONS = [
  { key: "role_biodiversite",     label: "Rôle Biodiversité",     icon: Globe,         always: true  },
  { key: "interactions",          label: "Interactions",           icon: Sprout,        always: true  },
  { key: "bienfaits_comestibles", label: "Bienfaits Comestibles",  icon: Utensils,      always: false, cond: p => p.is_edible },
  { key: "usages_medicinaux",     label: "Usages Médicinaux",      icon: FlaskConical,  always: false, cond: p => p.is_edible },
  { key: "danger_detail",         label: "Toxicité & Danger",      icon: AlertTriangle, always: false, cond: p => p.is_toxic, danger: true },
  { key: "formation_geologique",  label: "Formation Géologique",   icon: Mountain,      always: false, cond: p => p.category === "rock" },
  { key: "usages_humains",        label: "Usages Humains",         icon: Leaf,          always: false, cond: p => p.category === "rock" },
  { key: "migration_nidification",label: "Migration & Nidification", icon: Bird,        always: false, cond: p => p.category === "bird" },
  { key: "menaces_conservation",  label: "Menaces & Conservation", icon: Shield,        always: true  },
  { key: "le_savais_tu",          label: "Le savais-tu ?",         icon: Lightbulb,     always: true, special: true },
];

function SkeletonSection() {
  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--v1v-green-ghost)", background: "var(--v1v-bg-card)", overflow: "hidden", marginBottom: 8 }}>
      <div className="px-4 py-3 flex items-center gap-3">
        <div style={{ width: 16, height: 16, borderRadius: 4, background: "var(--v1v-green-bg)", animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
        <div style={{ height: 8, width: "35%", borderRadius: 4, background: "var(--v1v-green-bg)", animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
      </div>
    </div>
  );
}

function Section({ icon: Icon, label, text, danger, special }) {
  const [open, setOpen] = useState(false);

  const accentColor = danger ? "#FF6B6B" : special ? "var(--v1v-green)" : "var(--v1v-green-faint)";
  const borderColor = danger ? "rgba(220,50,50,0.3)" : "var(--v1v-green-ghost)";
  const leftBorder  = danger ? "2px solid #FF6B6B" : special ? "2px solid var(--v1v-green)" : "1px solid var(--v1v-green-ghost)";

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        borderLeft: leftBorder,
        background: special ? "var(--v1v-green-bg-subtle)" : "var(--v1v-bg-card)",
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left"
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accentColor }} />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] flex-1" style={{ color: accentColor }}>{label}</span>
        <ChevronDown
          className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200"
          style={{ color: "var(--v1v-fg-faint)", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      {open && (
        <div className="px-4 pb-4">
          <div style={{ height: 1, background: borderColor, marginBottom: 12 }} />
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--v1v-fg)" }}>{text}</p>
        </div>
      )}
    </div>
  );
}

export default function LearnMoreModal({ plant, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const sheetRef              = useRef(null);

  useEffect(() => {
    if (!plant) return;
    document.body.style.overflow = "hidden";
    const el = sheetRef.current;
    if (el) {
      el.style.transform = "translateY(100%)";
      requestAnimationFrame(() => {
        el.style.transition = "transform 320ms cubic-bezier(0.32,0.72,0,1)";
        el.style.transform = "translateY(0)";
      });
    }
    return () => { document.body.style.overflow = ""; };
  }, [plant]);

  useEffect(() => {
    if (!plant) return;
    setData(null);
    setLoading(true);
    // TODO: connecter via /api/learn-more (Vercel + LLM) — retourne placeholder pour l'instant
    const placeholder = {
      role_biodiversite:     "Données non disponibles — LLM non connecté.",
      interactions:          "Données non disponibles — LLM non connecté.",
      bienfaits_comestibles: plant.is_edible ? "Données non disponibles — LLM non connecté." : undefined,
      usages_medicinaux:     plant.is_edible ? "Données non disponibles — LLM non connecté." : undefined,
      danger_detail:         plant.is_toxic  ? "Données non disponibles — LLM non connecté." : undefined,
      formation_geologique:  plant.category === "rock" ? "Données non disponibles — LLM non connecté." : undefined,
      usages_humains:        plant.category === "rock" ? "Données non disponibles — LLM non connecté." : undefined,
      migration_nidification:plant.category === "bird" ? "Données non disponibles — LLM non connecté." : undefined,
      menaces_conservation:  "Données non disponibles — LLM non connecté.",
      le_savais_tu:          "Données non disponibles — LLM non connecté.",
    };
    setData(placeholder);
    setLoading(false);
  }, [plant?.id]);

  if (!plant) return null;

  const rarityDots = { commune: "#2EA80F", peu_commune: "#3B7DE8", rare: "#7C3AED", legendaire: "#C49A0A" };
  const rs = { dot: rarityDots[plant.rarity] || "#2EA80F" };
  const visibleSections = SECTIONS.filter(s => s.always || (s.cond && s.cond(plant)));

  const handleClose = () => {
    const el = sheetRef.current;
    if (el) {
      el.style.transition = "transform 260ms cubic-bezier(0.32,0.72,0,1)";
      el.style.transform = "translateY(100%)";
      setTimeout(onClose, 260);
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" }}
      onClick={handleClose}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-md mx-auto"
        style={{
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--v1v-bg)",
          borderTop: `1px solid ${rs.dot}55`,
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.7)",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Header */}
        <div
          className="sticky top-0 flex items-center justify-between px-5 py-3 z-10"
          style={{ background: "var(--v1v-bg-overlay)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--v1v-green-ghost)" }}
        >
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.5em]" style={{ color: "var(--v1v-green-faint)" }}>Analyse IA</p>
            <p className="text-sm font-black uppercase leading-tight" style={{ color: "var(--v1v-fg)" }}>{plant.common_name}</p>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <X className="w-4 h-4" style={{ color: "var(--v1v-fg-muted)" }} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pt-4 pb-12">
          {loading ? (
            <div className="pt-2">
              {[...Array(5)].map((_, i) => <SkeletonSection key={i} />)}
            </div>
          ) : (
            visibleSections.map((s, i) => {
              const text = data?.[s.key];
              if (!text) return null;
              return (
                <Section
                  key={s.key}
                  icon={s.icon}
                  label={s.label}
                  text={text}
                  danger={s.danger}
                  special={s.special}
                />
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes skeletonPulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 0.2; } }
      `}</style>
    </div>
  );
}