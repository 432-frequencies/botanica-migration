import { createPortal } from "react-dom";
import { X, MapPin, Calendar, Utensils, AlertTriangle, Target, Share2, Lock } from "lucide-react";
import DiscoveryShareCard from "@/components/identify/DiscoveryShareCard";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { modalSlideUp } from "@/motion/variants";
import { usePremium } from "@/lib/PremiumContext";
import { PREMIUM_PLAN_NAME } from "@/lib/premiumConfig";
import { createPageUrl } from "@/utils";

function InfoBlock({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[9px] font-black uppercase tracking-[0.45em]" style={{ color: "var(--v1v-green-faint)" }}>{label}</p>
      <div className="text-[13px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>{children}</div>
    </div>
  );
}

const SAFETY_RISK_CATEGORIES = new Set(["plant", "tree", "fungus", "insect", "arachnid"]);
const BITE_STING_CATEGORIES = new Set(["insect", "arachnid"]);

function normalizeSafetyStatus(plant = {}) {
  const raw = String(plant.edibility_status || "").trim().toLowerCase();
  if (raw === "toxic" || plant.is_toxic) return "toxic";
  if (raw === "edible" || (plant.is_edible && !plant.is_toxic)) return "edible";
  if (raw === "non_edible") return "non_edible";
  return "unknown";
}

function getSafetyDisplay(plant) {
  const status = normalizeSafetyStatus(plant);
  const category = plant?.category || "plant";
  const isRiskCategory = SAFETY_RISK_CATEGORIES.has(category);
  const isBiteOrStingRisk = BITE_STING_CATEGORIES.has(category);
  const displayStatus = isBiteOrStingRisk && status === "non_edible" ? "unknown" : status;
  const shouldShow = isRiskCategory || status === "toxic" || status === "edible" || status === "non_edible";
  if (!shouldShow) return null;

  const config = {
    edible: {
      label: "Comestible",
      Icon: Utensils,
      color: "var(--v1v-green)",
      background: "rgba(57,184,20,0.10)",
      border: "rgba(57,184,20,0.30)",
    },
    toxic: {
      label: category === "arachnid" ? "Venimeux - prudence" : category === "insect" ? "Risque de piqûre" : "Toxique",
      Icon: AlertTriangle,
      color: "#FF6B6B",
      background: "rgba(220,50,50,0.10)",
      border: "rgba(220,50,50,0.36)",
    },
    non_edible: {
      label: "Non comestible",
      Icon: AlertTriangle,
      color: "rgba(237,240,230,0.72)",
      background: "rgba(237,240,230,0.06)",
      border: "rgba(237,240,230,0.14)",
    },
    unknown: {
      label: isBiteOrStingRisk ? "Risque non vérifié" : "Non vérifié",
      Icon: AlertTriangle,
      color: "rgba(237,240,230,0.68)",
      background: "rgba(237,240,230,0.05)",
      border: "rgba(237,240,230,0.12)",
    },
  };

  const fallbackNotes = {
    arachnid: status === "toxic"
      ? "Ne manipule pas l'animal. En cas de morsure douloureuse, nettoie, applique du froid enveloppé et appelle le 15/112 ou un centre antipoison si douleur intense, malaise, crampes ou enfant."
      : "Observe sans manipuler. En cas de morsure douloureuse, nettoie, applique du froid enveloppé et demande un avis médical si douleur, gonflement ou malaise.",
    insect: status === "toxic"
      ? "Risque de piqûre ou d'irritation. Nettoie, applique du froid et appelle le 15/112 si gêne respiratoire, malaise, allergie connue ou gonflement du visage."
      : "Observe sans manipuler si l'espèce pique, mord ou irrite. En cas de réaction forte, demande un avis médical.",
    fungus: "Information indicative: ne jamais consommer un champignon sans vérification experte locale.",
    plant: "Information indicative: ne pas consommer ou manipuler sans vérification experte.",
    tree: "Information indicative: ne pas consommer ou manipuler sans vérification experte.",
  };
  const rawNote = String(plant?.safety_notes || "").trim();
  const note = isBiteOrStingRisk && /\b(consommer|comestible|edible)\b/i.test(rawNote)
    ? fallbackNotes[category]
    : rawNote || fallbackNotes[category] || "Information indicative — ne pas consommer sans vérification experte.";

  return {
    status: displayStatus,
    ...config[displayStatus],
    note,
    caution: isRiskCategory || status === "edible" || status === "toxic",
    scopeLabel: isBiteOrStingRisk ? "Prudence terrain" : "Usage biologique",
  };
}

export default function PlantDetailModal({ plant, isPro, onClose }) {
  const [showShare, setShowShare] = useState(false);
  const navigate = useNavigate();
  const { isAvailable: premiumAvailable } = usePremium();

  useEffect(() => {
    if (!plant) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [plant]);

  if (!plant) return null;

  const handleOpenPremium = () => {
    onClose?.();
    navigate(createPageUrl("Pricing"));
  };

  const rarityStyles = {
    commune: { dot: "#2EA80F", bg: "rgba(46,168,15,0.05)", scopeColor: "#2EA80F" },
    peu_commune: { dot: "#3B7DE8", bg: "rgba(59,125,232,0.07)", scopeColor: "#3B7DE8" },
    rare: { dot: "#7C3AED", bg: "rgba(124,58,237,0.07)", scopeColor: "#7C3AED" },
    legendaire: { dot: "#C49A0A", bg: "rgba(196,154,10,0.09)", scopeColor: "#C49A0A" },
  };
  const rarityLabels = { commune: "Commune", peu_commune: "Peu Commune", rare: "Rare", legendaire: "Légendaire" };
  const rs = rarityStyles[plant.rarity] || rarityStyles.commune;
  const lbl = rarityLabels[plant.rarity] || "Commune";
  const safetyDisplay = getSafetyDisplay(plant);

  return createPortal(
    <AnimatePresence mode="wait">
      <motion.div
        className="fixed inset-0 z-[9999] flex items-end"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        onClick={onClose}
      >
        <motion.div
          className="w-full max-w-md mx-auto flex flex-col will-animate"
          style={{
            maxHeight: "92vh",
            background: "var(--v1v-bg)",
            borderTop: `1px solid ${rs.dot}55`,
            borderRadius: "20px 20px 0 0",
            boxShadow: `0 -8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset`,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
          variants={modalSlideUp}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={e => e.stopPropagation()}
        >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div style={{ width: 36, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Hero image */}
        <div className="relative w-full flex-shrink-0" style={{ height: 280 }}>
          {plant.photo_url && plant.photo_url.trim() !== "" ? (
            <>
              <img
                src={plant.photo_url}
                alt={plant.common_name}
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: "cover", objectPosition: "center" }}
                onError={e => {
                  console.error('[PlantDetailModal] Failed to load image:', plant.photo_url);
                  e.currentTarget.style.display = "none";
                  const fallback = e.currentTarget.parentElement.querySelector('.fallback-icon');
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--v1v-bg) 0%, rgba(10,20,10,0.4) 50%, transparent 100%)" }} />
              {/* Fallback shown if image fails */}
              <div className="absolute inset-0 flex items-center justify-center fallback-icon hidden" style={{ background: rs.bg }}>
                <Target className="w-16 h-16" style={{ color: rs.scopeColor, opacity: 0.4 }} />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: rs.bg }}>
              <Target className="w-16 h-16" style={{ color: rs.scopeColor, opacity: 0.4 }} />
            </div>
          )}

          {/* Close button */}
          <motion.button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-3 right-3 flex items-center justify-center"
            style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.1)" }}
            whileTap={{ scale: 0.9 }}
            transition={{ duration: 0.15 }}
          >
            <X className="w-4 h-4" style={{ color: "var(--v1v-fg)" }} />
          </motion.button>

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

          {/* Safety state */}
          {safetyDisplay && (
            <div
              className="p-4"
              style={{
                background: safetyDisplay.background,
                border: `1px solid ${safetyDisplay.border}`,
                borderRadius: 14,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <safetyDisplay.Icon className="w-4 h-4" style={{ color: safetyDisplay.color }} />
                  <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: safetyDisplay.color }}>
                    {safetyDisplay.label}
                  </p>
                </div>
                <span className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: "var(--v1v-fg-faint)" }}>
                  {safetyDisplay.scopeLabel}
                </span>
              </div>
              {safetyDisplay.caution && (
                <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                  {safetyDisplay.note}
                </p>
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

          {/* ⭐ RÔLE ÉCOLOGIQUE - MIS EN AVANT (matching PlantResult hierarchy) */}
          {plant.ecological_role && plant.ecological_role.trim().length > 0 && (
            <div style={{
              background: "var(--v1v-green-bg-subtle)",
              border: "2px solid var(--v1v-green-ghost)",
              borderRadius: "12px",
              padding: "16px"
            }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🌍</span>
                <p className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: "var(--v1v-green)" }}>Rôle Écologique</p>
              </div>
              <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--v1v-fg)" }}>{plant.ecological_role}</p>
            </div>
          )}

          {/* ⭐ IMPORTANCE BIODIVERSITÉ - MIS EN AVANT (matching PlantResult hierarchy) */}
          {plant.biodiversity_importance && plant.biodiversity_importance.trim().length > 0 && (
            <div style={{
              background: "rgba(57,184,20,0.08)",
              border: "2px solid rgba(57,184,20,0.25)",
              borderRadius: "12px",
              padding: "16px"
            }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🦋</span>
                <p className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: "var(--v1v-green)" }}>Importance Biodiversité</p>
              </div>
              <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--v1v-fg)" }}>{plant.biodiversity_importance}</p>
            </div>
          )}

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
          ) : ((plant.edibility_details || plant.medicinal_uses || plant.anecdote) ? (
            <div style={{ background: "var(--v1v-green-bg-subtle)", border: "1px solid var(--v1v-green-ghost)", borderRadius: 12, padding: "16px" }}>
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-3.5 h-3.5" style={{ color: "var(--v1v-green-faint)" }} />
                <p className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: "var(--v1v-green-faint)" }}>{PREMIUM_PLAN_NAME}</p>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                Les notes détaillées, usages et repères avancés sont disponibles avec l'abonnement App Store.
              </p>
              {premiumAvailable && (
                <button
                  onClick={handleOpenPremium}
                  className="mt-3 min-h-[44px] px-4 text-[9px] font-black uppercase tracking-[0.24em]"
                  style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)", borderRadius: 10 }}
                >
                  Découvrir {PREMIUM_PLAN_NAME}
                </button>
              )}
            </div>
          ) : null)}

          {/* Bouton Partager */}
          <button
            onClick={() => setShowShare(true)}
            className="flex items-center justify-between w-full px-4 py-3.5 transition-opacity active:opacity-60"
            style={{ background: "rgba(45,122,31,0.15)", border: "1px solid rgba(45,122,31,0.3)", borderRadius: 12 }}
          >
            <span className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: "var(--v1v-green)" }}>Partager cette découverte</span>
            <Share2 className="w-4 h-4" style={{ color: "var(--v1v-green-faint)" }} />
          </button>
        </div>
      </motion.div>

      {/* Share Card Modal */}
      {showShare && (
        <DiscoveryShareCard
          data={{
            common_name: plant.common_name,
            scientific_name: plant.scientific_name,
            rarity: plant.rarity || "commune",
            photo_url: plant.photo_url,
            xp_gained: plant.points_earned || 10,
            flora_gained: 0,
            discovery_rank: null,
            detection_method: "visual",
            user_name: null,
            date: plant.discovered_date ? new Date(plant.discovered_date).toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR"),
          }}
          onClose={() => setShowShare(false)}
        />
      )}
    </motion.div>
    </AnimatePresence>,
    document.body
  );
}
