import { createPortal } from "react-dom";
import { X, MapPin, Calendar, Utensils, AlertTriangle, Lock, ChevronRight, Target } from "lucide-react";
import BenefitsPanel from "@/components/shared/BenefitsPanel";
import { useEffect, useRef } from "react";

function InfoBlock({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[9px] font-black uppercase tracking-[0.45em]" style={{ color: "var(--v1v-green-faint)" }}>{label}</p>
      <div className="text-[13px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>{children}</div>
    </div>
  );
}

export default function PlantDetailModal({ plant, isPro, onClose, onLearnMore }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!plant) return;
    document.body.style.overflow = "hidden";
    // Slide in
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

  if (!plant) return null;

  const rarityStyles = {
    commune: { dot: "#2EA80F", bg: "rgba(46,168,15,0.05)", scopeColor: "#2EA80F" },
    peu_commune: { dot: "#3B7DE8", bg: "rgba(59,125,232,0.07)", scopeColor: "#3B7DE8" },
    rare: { dot: "#7C3AED", bg: "rgba(124,58,237,0.07)", scopeColor: "#7C3AED" },
    legendaire: { dot: "#C49A0A", bg: "rgba(196,154,10,0.09)", scopeColor: "#C49A0A" },
  };
  const rarityLabels = { commune: "Commune", peu_commune: "Peu Commune", rare: "Rare", legendaire: "Légendaire" };
  const rs = rarityStyles[plant.rarity] || rarityStyles.commune;
  const lbl = rarityLabels[plant.rarity] || "Commune";

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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={handleClose}
    >
      <div
        ref={sheetRef}
        className="w-full max-w-md mx-auto flex flex-col"
        style={{
          maxHeight: "92vh",
          background: "var(--v1v-bg)",
          borderTop: `1px solid ${rs.dot}55`,
          borderRadius: "20px 20px 0 0",
          boxShadow: `0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset`,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div style={{ width: 36, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Hero image */}
        <div className="relative w-full flex-shrink-0" style={{ height: 220 }}>
          {plant.photo_url ? (
            <>
              <img
                src={plant.photo_url}
                alt={plant.common_name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--v1v-bg) 0%, rgba(10,20,10,0.4) 50%, transparent 100%)" }} />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: rs.bg }}>
              <Target className="w-16 h-16" style={{ color: rs.scopeColor, opacity: 0.4 }} />
            </div>
          )}

          {/* Close button */}
          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="absolute top-3 right-3 flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <X className="w-4 h-4" style={{ color: "var(--v1v-fg)" }} />
          </button>

          {/* Rarity pill — overlaid on image */}
          <div
            className="absolute bottom-3 left-4 flex items-center gap-1.5 px-3"
            style={{ height: 24, borderRadius: 24, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", border: `1px solid ${rs.dot}50` }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: rs.dot }} />
            <span className="text-[9px] font-black uppercase tracking-[0.25em]" style={{ color: rs.dot }}>{lbl}</span>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 pt-4 pb-8 flex flex-col gap-5">

          {/* Name block */}
          <div>
            <h2 className="text-2xl font-black uppercase leading-tight" style={{ color: "var(--v1v-fg)", letterSpacing: "0.04em" }}>
              {plant.common_name}
            </h2>
            {plant.scientific_name && (
              <p className="text-[13px] italic mt-0.5" style={{ color: "var(--v1v-fg-muted)" }}>{plant.scientific_name}</p>
            )}
            {plant.family && (
              <p className="text-[10px] uppercase tracking-widest mt-1" style={{ color: "var(--v1v-fg-faint)" }}>Famille : {plant.family}</p>
            )}
          </div>

          {/* Status badges */}
          {(plant.is_edible || plant.is_toxic) && (
            <div className="flex gap-2 flex-wrap">
              {plant.is_edible && (
                <span
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5"
                  style={{ background: "rgba(57,184,20,0.1)", border: "1px solid rgba(57,184,20,0.3)", borderRadius: 8, color: "var(--v1v-green)" }}
                >
                  <Utensils className="w-3 h-3" /> Comestible
                </span>
              )}
              {plant.is_toxic && (
                <span
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5"
                  style={{ background: "rgba(220,50,50,0.08)", border: "1px solid rgba(220,50,50,0.35)", borderRadius: 8, color: "#FF6B6B" }}
                >
                  <AlertTriangle className="w-3 h-3" /> Toxique
                </span>
              )}
            </div>
          )}

          {/* Meta */}
          {(plant.discovered_date || plant.location_name) && (
            <div className="flex gap-4">
              {plant.discovered_date && (
                <div className="flex items-center gap-1.5" style={{ color: "var(--v1v-fg-faint)" }}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] tracking-widest uppercase">{new Date(plant.discovered_date).toLocaleDateString("fr-FR")}</span>
                </div>
              )}
              {plant.location_name && (
                <div className="flex items-center gap-1.5" style={{ color: "var(--v1v-fg-faint)" }}>
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-[10px] tracking-widest uppercase">{plant.location_name}</span>
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: "var(--v1v-green-ghost)" }} />

          {/* Description / Habitat / Behavior */}
          {plant.description && <InfoBlock label="Intel">{plant.description}</InfoBlock>}
          {plant.habitat     && <InfoBlock label="Habitat">{plant.habitat}</InfoBlock>}
          {plant.behavior    && <InfoBlock label={plant.category === "rock" ? "Formation" : "Comportement"}>{plant.behavior}</InfoBlock>}

          {/* Pro intel */}
          {isPro ? (
            <>
              {(plant.edibility_details || plant.medicinal_uses || plant.anecdote) && (
                <div style={{ height: 1, background: "var(--v1v-green-ghost)" }} />
              )}
              {plant.edibility_details && <InfoBlock label="Comestibilité">{plant.edibility_details}</InfoBlock>}
              {plant.medicinal_uses    && <InfoBlock label="Usages médicinaux">{plant.medicinal_uses}</InfoBlock>}
              {plant.anecdote          && <InfoBlock label="Notes de terrain">{plant.anecdote}</InfoBlock>}
            </>
          ) : (
            <div
              className="flex items-center gap-3 px-4 py-4"
              style={{ background: "var(--v1v-green-bg-subtle)", border: "1px dashed var(--v1v-green-ghost)", borderRadius: 12 }}
            >
              <Lock className="w-4 h-4 flex-shrink-0" style={{ color: "var(--v1v-green-faint)" }} />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: "var(--v1v-green-faint)" }}>Dossier Classifié</p>
                <p className="text-[10px] leading-snug mt-0.5" style={{ color: "var(--v1v-fg-faint)" }}>Comestibilité, usages médicinaux & notes — accès Elite requis</p>
              </div>
            </div>
          )}

          {/* En savoir plus button */}
          <button
            onClick={() => onLearnMore && onLearnMore(plant)}
            className="flex items-center justify-between w-full px-4 py-3.5 transition-opacity active:opacity-60"
            style={{ background: "var(--v1v-green-bg-subtle)", border: "1px solid var(--v1v-green-ghost)", borderRadius: 12 }}
          >
            <span className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: "var(--v1v-green)" }}>Analyse complète — IA</span>
            <ChevronRight className="w-4 h-4" style={{ color: "var(--v1v-green-faint)" }} />
          </button>

          <BenefitsPanel key={plant.id} species={plant} isOpen={true} />
        </div>
      </div>
    </div>,
    document.body
  );
}