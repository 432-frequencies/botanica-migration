import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Plus, AlertTriangle, Utensils, Lock, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DiscoveryShareCard from "./DiscoveryShareCard";
import { usePremium } from "@/lib/PremiumContext";
import { PREMIUM_PLAN_NAME } from "@/lib/premiumConfig";
import { createPageUrl } from "@/utils";
import { useTranslation } from "@/lib/i18n";

const RARITY_CONFIG = {
  commune:     { labelKey: "result.rarityCommune",    tier: "C" },
  peu_commune: { labelKey: "result.rarityPeuCommune", tier: "UC" },
  rare:        { labelKey: "result.rarityRare",       tier: "R" },
  legendaire:  { labelKey: "result.rarityLegendaire", tier: "L" },
};

const CATEGORY_LABEL = {
  plant: "result.categoryPlant",
  bird: "result.categoryBird",
  rock: "result.categoryRock",
  fungus: "result.categoryFungus",
  tree: "result.categoryTree",
  insect: "result.categoryInsect",
  arachnid: "result.categoryArachnid",
};

const CATEGORY_EMOJI_BIG = {
  plant: "🌿", bird: "🦅", rock: "🪨", fungus: "🍄", tree: "🌳", insect: "🦋", arachnid: "🕷️"
};

const SAFETY_RISK_CATEGORIES = new Set(["plant", "tree", "fungus", "insect", "arachnid"]);
const BITE_STING_CATEGORIES = new Set(["insect", "arachnid"]);

function normalizeSafetyStatus(topResult = {}) {
  const raw = String(topResult.edibility_status || "").trim().toLowerCase();
  if (raw === "toxic" || topResult.is_toxic) return "toxic";
  if (raw === "edible" || (topResult.is_edible && !topResult.is_toxic)) return "edible";
  if (raw === "non_edible") return "non_edible";
  return "unknown";
}

function getSafetyDisplay(topResult, category, t) {
  const status = normalizeSafetyStatus(topResult);
  const isRiskCategory = SAFETY_RISK_CATEGORIES.has(category);
  const isBiteOrStingRisk = BITE_STING_CATEGORIES.has(category);
  const displayStatus = isBiteOrStingRisk && status === "non_edible" ? "unknown" : status;
  const shouldShow = isRiskCategory || status === "toxic" || status === "edible" || status === "non_edible";
  if (!shouldShow) return null;

  const config = {
    edible: {
      label: t("result.safetyEdible"),
      Icon: Utensils,
      color: "var(--v1v-green)",
      background: "rgba(57,184,20,0.10)",
      border: "rgba(57,184,20,0.30)",
    },
    toxic: {
      label: category === "arachnid" ? t("result.safetyVenomous") : category === "insect" ? t("result.safetySting") : t("result.safetyToxic"),
      Icon: AlertTriangle,
      color: "#FF6B6B",
      background: "rgba(220,50,50,0.10)",
      border: "rgba(220,50,50,0.36)",
    },
    non_edible: {
      label: t("result.safetyNonEdible"),
      Icon: AlertTriangle,
      color: "rgba(237,240,230,0.72)",
      background: "rgba(237,240,230,0.06)",
      border: "rgba(237,240,230,0.14)",
    },
    unknown: {
      label: isBiteOrStingRisk ? t("result.safetyRiskUnverified") : t("result.safetyUnverified"),
      Icon: AlertTriangle,
      color: "rgba(237,240,230,0.68)",
      background: "rgba(237,240,230,0.05)",
      border: "rgba(237,240,230,0.12)",
    },
  };

  const fallbackNotes = {
    arachnid: status === "toxic"
      ? t("result.cautionArachnidToxic")
      : t("result.cautionArachnid"),
    insect: status === "toxic"
      ? t("result.cautionInsectToxic")
      : t("result.cautionInsect"),
    fungus: t("result.cautionFungus"),
    plant: t("result.cautionPlant"),
    tree: t("result.cautionPlant"),
  };
  const rawNote = String(topResult.safety_notes || "").trim();
  const note = isBiteOrStingRisk && /\b(consommer|comestible|edible)\b/i.test(rawNote)
    ? fallbackNotes[category]
    : rawNote || fallbackNotes[category] || t("result.cautionDefault");

  return {
    status: displayStatus,
    ...config[displayStatus],
    note,
    caution: isRiskCategory || status === "edible" || status === "toxic",
    scopeLabel: isBiteOrStingRisk ? t("result.fieldCaution") : t("result.biologicalUse"),
  };
}

// XP is now diversity-based: +10 for new species, +2 for duplicates
const XP_NEW_SPECIES = 10;

function getObservationContexts(t) {
  return [
    { value: "wild", label: t("result.contextWild"), hint: t("result.contextWildHint") },
    { value: "domestic", label: t("result.contextDomestic"), hint: t("result.contextDomesticHint") },
    { value: "unknown", label: t("result.contextUnknown"), hint: t("result.contextUnknownHint") },
  ];
}

function ObservationContextPicker({ value, onChange, t }) {
  const contexts = getObservationContexts(t);
  const selected = contexts.find((option) => option.value === value) || contexts[2];

  return (
    <div
      className="p-4"
      style={{
        background: "linear-gradient(145deg, rgba(174,255,188,0.09), rgba(255,255,255,0.025))",
        border: "1px solid rgba(174,255,188,0.18)",
        borderRadius: 22,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div className="mb-4">
        <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "rgba(174,255,188,0.82)" }}>
          {t("result.whereObserved")}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
          {t("result.contextIntro")}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {contexts.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className="w-full min-h-[58px] px-2 text-center transition-all active:scale-[0.98]"
              style={{
                background: active ? "rgba(174,255,188,0.18)" : "rgba(255,255,255,0.035)",
                border: `1px solid ${active ? "rgba(174,255,188,0.48)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 18,
                boxShadow: active ? "0 0 18px rgba(57,184,20,0.16)" : "none",
              }}
            >
              <span className="block text-[11px] font-black leading-tight" style={{ color: active ? "rgba(222,255,232,0.98)" : "var(--v1v-fg)" }}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "rgba(244,255,246,0.62)" }}>
        {selected.hint}
      </p>
    </div>
  );
}

export default function PlantResult({ result, imageBase64, isPro, onSave, onClose, userProfile }) {
  const { language, t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [observationContext, setObservationContext] = useState("unknown");
  const navigate = useNavigate();
  const { isAvailable: premiumAvailable } = usePremium();
  const { top_result, alternatives, category } = result;
  const rarityBase = RARITY_CONFIG[top_result.rarity] || RARITY_CONFIG.commune;
  const rarity = { ...rarityBase, label: t(rarityBase.labelKey) };
  const catLabel = CATEGORY_LABEL[category] ? t(CATEGORY_LABEL[category]) : t("result.categorySpecimen");
  const safetyDisplay = getSafetyDisplay(top_result, category, t);

  const isRare = top_result.rarity === "rare" || top_result.rarity === "legendaire";
  const [showCelebration, setShowCelebration] = useState(isRare);

  useEffect(() => {
    if (showCelebration) {
      const t = setTimeout(() => setShowCelebration(false), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  const shareData = {
    common_name: top_result.common_name,
    scientific_name: top_result.scientific_name,
    rarity: top_result.rarity || "commune",
    photo_url: imageBase64,
    xp_gained: XP_NEW_SPECIES,
    flora_gained: 0,
    discovery_rank: null,
    detection_method: "visual",
    user_name: userProfile?.display_name || null,
    date: new Date().toLocaleDateString(language === "en" ? "en-US" : "fr-FR"),
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const saveResult = await onSave({ observationContext });
    if (!saveResult?.ok) {
      setSaving(false);
    }
  };

  const handleOpenPremium = () => {
    onClose?.();
    navigate(createPageUrl("Pricing"));
  };

  const xp = XP_NEW_SPECIES;
  const isLegendaire = top_result.rarity === "legendaire";
  const celebrationBorder = isLegendaire ? "#C8960A" : "#7C3AED";
  const celebrationGlow = isLegendaire ? "rgba(200,150,10,0.3)" : "rgba(124,58,237,0.3)";
  const celebrationLabel = isLegendaire ? t("result.rarityLegendaire").toUpperCase() : t("result.rarityRare").toUpperCase();

  if (showCelebration) return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8"
      style={{
        background: "linear-gradient(135deg, #000000 0%, #0A0A0A 50%, #000000 100%)",
        animation: "fadeIn 0.4s ease-out"
      }}
    >
      {/* Particles de fond animées */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(circle at 30% 20%, ${celebrationGlow} 0%, transparent 50%), radial-gradient(circle at 70% 80%, ${celebrationGlow} 0%, transparent 50%)`,
        animation: "particleFloat 8s ease-in-out infinite"
      }} />

      {/* Cercles concentriques animés */}
      <div style={{
        position: "absolute",
        width: "300px",
        height: "300px",
        borderRadius: "50%",
        border: `1px solid ${celebrationBorder}`,
        opacity: 0.2,
        animation: "ripple 3s ease-out infinite"
      }} />
      <div style={{
        position: "absolute",
        width: "400px",
        height: "400px",
        borderRadius: "50%",
        border: `1px solid ${celebrationBorder}`,
        opacity: 0.1,
        animation: "ripple 3s ease-out infinite 0.5s"
      }} />

      {/* Contenu principal */}
      <div style={{ position: "relative", zIndex: 10, animation: "slideUp 0.6s ease-out" }}>
        {/* Icône avec effet de glow pulsant */}
        <div className="text-8xl mb-8" style={{
          filter: `drop-shadow(0 0 40px ${celebrationGlow})`,
          animation: "iconPulse 2s ease-in-out infinite"
        }}>
          {CATEGORY_EMOJI_BIG[category] || "🌿"}
        </div>

        {/* Badge de rareté */}
        <div style={{
          display: "inline-block",
          padding: "8px 20px",
          background: `linear-gradient(90deg, ${celebrationBorder}22, ${celebrationBorder}44, ${celebrationBorder}22)`,
          border: `2px solid ${celebrationBorder}`,
          borderRadius: "30px",
          marginBottom: "16px",
          animation: "glowPulse 2s ease-in-out infinite"
        }}>
          <p className="text-[10px] font-black tracking-[0.6em] uppercase" style={{ color: celebrationBorder }}>
            {celebrationLabel}
          </p>
        </div>

        {/* Nom de l'espèce */}
        <h2 className="text-4xl font-black uppercase text-center leading-tight mb-3" style={{
          color: "#FFFFFF",
          textShadow: `0 0 30px ${celebrationGlow}, 0 2px 10px rgba(0,0,0,0.5)`,
          animation: "textAppear 0.8s ease-out 0.3s backwards"
        }}>
          {top_result.common_name}
        </h2>

        {/* Nom scientifique */}
        <p className="text-base italic mb-8" style={{
          color: "rgba(255,255,255,0.6)",
          animation: "textAppear 0.8s ease-out 0.5s backwards"
        }}>
          {top_result.scientific_name}
        </p>

        {/* XP Badge style Tesla */}
        <div style={{
          background: `linear-gradient(135deg, ${celebrationBorder}11, ${celebrationBorder}22)`,
          border: `2px solid ${celebrationBorder}`,
          borderRadius: "16px",
          padding: "24px",
          marginBottom: "40px",
          animation: "scaleIn 0.6s ease-out 0.7s backwards",
          boxShadow: `0 10px 40px ${celebrationGlow}, inset 0 1px 0 rgba(255,255,255,0.1)`
        }}>
          <p className="text-5xl font-black mb-2" style={{
            background: `linear-gradient(135deg, ${celebrationBorder}, #FFD700)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "none"
          }}>
            +{xp} XP
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: "rgba(255,255,255,0.5)" }}>
            {t("result.newTrace")}
          </p>
        </div>

        {/* Boutons */}
        <div className="w-full flex flex-col gap-3" style={{ animation: "slideUp 0.6s ease-out 0.9s backwards" }}>
          <button
            onClick={() => setShowShare(true)}
            className="w-full font-black uppercase tracking-[0.3em] text-[11px] transition-all active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${celebrationBorder}, ${celebrationBorder}dd)`,
              color: "#000",
              minHeight: "52px",
              borderRadius: "12px",
              boxShadow: `0 4px 20px ${celebrationGlow}`,
              border: "none"
            }}
          >
            {t("result.shareDiscovery")}
          </button>
          <button
            onClick={() => setShowCelebration(false)}
            className="w-full font-black uppercase tracking-[0.3em] text-[11px] transition-all active:scale-95"
            style={{
              background: "transparent",
              color: "rgba(255,255,255,0.7)",
              border: "2px solid rgba(255,255,255,0.2)",
              minHeight: "52px",
              borderRadius: "12px"
            }}
          >
            {t("result.fullSheet")}
          </button>
        </div>
      </div>

      {/* Animations CSS */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes textAppear {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 0.3; }
          50% { opacity: 0.15; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        @keyframes iconPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px ${celebrationGlow}; }
          50% { box-shadow: 0 0 40px ${celebrationGlow}, 0 0 60px ${celebrationGlow}; }
        }
      `}</style>

      {showShare && <DiscoveryShareCard data={shareData} onClose={() => setShowShare(false)} />}
    </div>,
    document.body
  );

  return createPortal(
    <>
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)" }}>
      <div className="w-full max-h-[92vh] overflow-y-auto" style={{ background: "var(--v1v-bg)", borderTop: "1px solid rgba(57,184,20,0.3)", borderRadius: "20px 20px 0 0" }}>
        
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
            <p className="text-[8px] tracking-[0.5em] uppercase" style={{ color: "var(--v1v-green-faint)" }}>{t("result.newDiscovery")}</p>
            <p className="text-xs font-black uppercase tracking-wider mt-0.5" style={{ color: "var(--v1v-fg)" }}>{catLabel}</p>
          </div>
          <button onClick={onClose} aria-label={t("result.closeResult")} className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <X className="w-4 h-4" style={{ color: "var(--v1v-fg-muted)" }} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Image + main info */}
          <div className="flex gap-4">
            <img src={imageBase64} alt={top_result.common_name || t("result.specimen")} className="w-28 h-28 object-cover flex-shrink-0" style={{ border: "1px solid var(--v1v-green-ghost)", borderRadius: 12 }} />
            <div className="flex-1 min-w-0">
              {category === "rock" ? (
                <>
                  {/* Format spécial pour les minéraux */}
                  <div className="mb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[8px] font-black tracking-[0.3em] px-2 py-0.5" style={{ background: "rgba(120,90,70,0.15)", color: "rgba(180,140,100,0.9)", border: "1px solid rgba(120,90,70,0.3)", borderRadius: 6 }}>
                        {t("result.mineral")}
                      </span>
                    </div>
                    <h3 className="text-lg font-black uppercase leading-tight mb-1" style={{ color: "var(--v1v-fg)", letterSpacing: "0.02em" }}>
                      {top_result.common_name}
                      {alternatives && alternatives.length > 0 && ` / ${alternatives.slice(0, 2).map(alt => alt.common_name).join(' / ')}`}
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black" style={{ color: "var(--v1v-green)" }}>{top_result.confidence}%</span>
                        <span className="text-[8px] tracking-widest uppercase" style={{ color: "var(--v1v-fg-faint)" }}>{t("result.confidence")}</span>
                      </div>
                      {alternatives && alternatives.length > 0 && (
                        <div className="text-[9px] tracking-wide" style={{ color: "var(--v1v-fg-faint)" }}>
                          {alternatives.slice(0, 2).map((alt, i) => (
                            <span key={i}> · {alt.confidence}%</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {top_result.scientific_name && top_result.scientific_name.trim().length > 0 && (
                    <p className="text-xs italic mb-0.5" style={{ color: "var(--v1v-fg-faint)" }}>{top_result.scientific_name}</p>
                  )}
                </>
              ) : (
                <>
                  {/* Format classique pour les autres espèces */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[9px] font-black tracking-[0.3em] px-2 py-0.5" style={{ background: "var(--v1v-green-bg-subtle)", color: "var(--v1v-green)", border: "1px solid var(--v1v-green-ghost)", borderRadius: 6 }}>
                      {rarity.tier} — {rarity.label}
                    </span>
                    <span className="text-[9px] font-black tracking-widest" style={{ color: "var(--v1v-green-faint)" }}>{top_result.confidence}% {t("result.confidence")}</span>
                  </div>
                  <h3 className="text-xl font-black uppercase leading-tight mb-0.5" style={{ color: "var(--v1v-fg)" }}>{top_result.common_name}</h3>
                  {top_result.scientific_name && top_result.scientific_name.trim().length > 0 && (
                    <p className="text-xs italic mb-0.5" style={{ color: "var(--v1v-fg-faint)" }}>{top_result.scientific_name}</p>
                  )}
                  {top_result.family && top_result.family.trim().length > 0 && (
                    <p className="text-[9px] tracking-wider uppercase" style={{ color: "var(--v1v-fg-faint)" }}>{t("result.family", { family: top_result.family })}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Description */}
          {top_result.description && top_result.description.trim().length > 0 && (
            <div style={{ borderLeft: "2px solid var(--v1v-green-ghost)", paddingLeft: "12px" }}>
              <p className="text-[8px] font-black tracking-[0.4em] uppercase mb-1.5" style={{ color: "var(--v1v-green-faint)" }}>{t("result.description")}</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>{top_result.description}</p>
            </div>
          )}

          {/* Habitat */}
          {top_result.habitat && top_result.habitat.trim().length > 0 && (
            <div style={{ borderLeft: "2px solid var(--v1v-green-ghost)", paddingLeft: "12px" }}>
              <p className="text-[8px] font-black tracking-[0.4em] uppercase mb-1.5" style={{ color: "var(--v1v-green-faint)" }}>{t("result.habitat")}</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>{top_result.habitat}</p>
            </div>
          )}

          {/* ⭐ RÔLE ÉCOLOGIQUE - MIS EN AVANT */}
          {top_result.ecological_role && top_result.ecological_role.trim().length > 0 && (
            <div style={{
              background: "var(--v1v-green-bg-subtle)",
              border: "2px solid var(--v1v-green-ghost)",
              borderRadius: "12px",
              padding: "16px"
            }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🌍</span>
                <p className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: "var(--v1v-green)" }}>{t("result.ecologicalRole")}</p>
              </div>
              <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--v1v-fg)" }}>{top_result.ecological_role}</p>
            </div>
          )}

          {/* ⭐ IMPORTANCE BIODIVERSITÉ - MIS EN AVANT */}
          {top_result.biodiversity_importance && top_result.biodiversity_importance.trim().length > 0 && (
            <div style={{
              background: "rgba(57,184,20,0.08)",
              border: "2px solid rgba(57,184,20,0.25)",
              borderRadius: "12px",
              padding: "16px"
            }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🦋</span>
                <p className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: "var(--v1v-green)" }}>{t("result.biodiversityImportance")}</p>
              </div>
              <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--v1v-fg)" }}>{top_result.biodiversity_importance}</p>
            </div>
          )}

          {/* Cannabis tag */}
          {top_result.is_cannabis && (
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10 }}
            >
              <div>
                <p className="text-[8px] font-black tracking-[0.4em] uppercase mb-0.5" style={{ color: "rgba(34,197,94,0.7)" }}>{t("result.cannabisDetected")}</p>
                {top_result.strain_type && (
                  <p className="text-sm font-black uppercase tracking-wider" style={{ color: "rgba(34,197,94,0.9)" }}>
                    {top_result.strain_type.charAt(0).toUpperCase() + top_result.strain_type.slice(1)}
                  </p>
                )}
              </div>
              <span className="text-[9px] font-black tracking-[0.3em] uppercase px-2 py-1" style={{ background: "rgba(34,197,94,0.15)", color: "rgba(34,197,94,0.8)", borderRadius: 6 }}>
                {top_result.strain_type || "Hybrid"}
              </span>
            </div>
          )}

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

          {/* Detailed info - Pro only */}
          {isPro ? (
            <>
              {top_result.edibility_details && top_result.edibility_details.trim().length > 0 && (
                <div style={{ borderLeft: "2px solid var(--v1v-green-ghost)", paddingLeft: "12px" }}>
                  <p className="text-[8px] font-black tracking-[0.4em] uppercase mb-1.5" style={{ color: "var(--v1v-green-faint)" }}>{t("result.edibility")}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>{top_result.edibility_details}</p>
                </div>
              )}
              {top_result.medicinal_uses && top_result.medicinal_uses.trim().length > 0 && (
                <div style={{ borderLeft: "2px solid var(--v1v-green-ghost)", paddingLeft: "12px" }}>
                  <p className="text-[8px] font-black tracking-[0.4em] uppercase mb-1.5" style={{ color: "var(--v1v-green-faint)" }}>{t("result.medicinalUses")}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>{top_result.medicinal_uses}</p>
                </div>
              )}
              {top_result.anecdote && top_result.anecdote.trim().length > 0 && (
                <div style={{ borderLeft: "2px solid var(--v1v-green-ghost)", paddingLeft: "12px" }}>
                  <p className="text-[8px] font-black tracking-[0.4em] uppercase mb-1.5" style={{ color: "var(--v1v-green-faint)" }}>{t("result.fieldNotes")}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>{top_result.anecdote}</p>
                </div>
              )}
            </>
          ) : (
            ((top_result.edibility_details && top_result.edibility_details.trim().length > 0) ||
             (top_result.medicinal_uses && top_result.medicinal_uses.trim().length > 0)) && (
              <div style={{ background: "var(--v1v-green-bg-subtle)", border: "1px solid var(--v1v-green-ghost)", borderRadius: 12, overflow: "hidden" }}>
                <div className="relative px-4 pt-3 pb-0" style={{ maxHeight: "64px", overflow: "hidden" }}>
                  {top_result.edibility_details && (
                    <p className="text-sm leading-relaxed mb-1" style={{ color: "var(--v1v-fg-muted)", filter: "blur(3px)" }}>
                      {top_result.edibility_details.substring(0, 80)}...
                    </p>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-10" style={{ background: "linear-gradient(to bottom, transparent, var(--v1v-bg))" }} />
                </div>
                <div className="px-4 pt-2 pb-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <Lock className="w-3 h-3" style={{ color: "var(--v1v-green-faint)" }} />
                    <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: "var(--v1v-green-faint)" }}>{PREMIUM_PLAN_NAME}</p>
                  </div>
                  <p className="text-[9px] leading-relaxed" style={{ color: "var(--v1v-fg-faint)" }}>
                    {t("result.premiumLocked")}
                  </p>
                  {premiumAvailable && (
                    <button
                      onClick={handleOpenPremium}
                      className="mt-3 min-h-[44px] px-4 text-[9px] font-black uppercase tracking-[0.24em]"
                      style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)", borderRadius: 10 }}
                    >
                      {t("result.discoverPlan", { plan: PREMIUM_PLAN_NAME })}
                    </button>
                  )}
                </div>
              </div>
            )
          )}

          {/* Alternatives - Pro only (masqué pour les roches car déjà affiché en haut) */}
          {isPro && alternatives && alternatives.length > 0 && category !== "rock" && (
            <div>
              <p className="text-[8px] font-black tracking-[0.4em] uppercase mb-3" style={{ color: "var(--v1v-green-faint)" }}>{t("result.alternativeIdentifications")}</p>
              {alternatives.map((alt, i) => (
                <div key={i} className="flex items-center justify-between py-2.5" style={{ borderBottom: "1px solid var(--v1v-green-ghost)" }}>
                  <div>
                    <p className="text-xs font-black uppercase" style={{ color: "var(--v1v-fg)" }}>{alt.common_name}</p>
                    <p className="text-[9px] italic" style={{ color: "var(--v1v-fg-faint)" }}>{alt.scientific_name}</p>
                  </div>
                  <span className="text-xs font-black" style={{ color: "var(--v1v-green-faint)" }}>{alt.confidence}%</span>
                </div>
              ))}
            </div>
          )}

          {!isPro && premiumAvailable && alternatives && alternatives.length > 0 && category !== "rock" && (
            <div style={{ background: "var(--v1v-green-bg-subtle)", border: "1px solid var(--v1v-green-ghost)", borderRadius: 12, padding: "16px" }}>
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-3.5 h-3.5" style={{ color: "var(--v1v-green-faint)" }} />
                <p className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: "var(--v1v-green-faint)" }}>{PREMIUM_PLAN_NAME}</p>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                {t("result.alternativePremium", { plan: PREMIUM_PLAN_NAME })}
              </p>
              <button
                onClick={handleOpenPremium}
                className="mt-3 min-h-[44px] px-4 text-[9px] font-black uppercase tracking-[0.24em]"
                style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)", borderRadius: 10 }}
              >
                {t("result.discoverPlan", { plan: PREMIUM_PLAN_NAME })}
              </button>
            </div>
          )}

          {/* Info pour les minéraux (non-Pro) */}
          {!isPro && category === "rock" && alternatives && alternatives.length > 0 && (
            <div style={{ background: "rgba(120,90,70,0.08)", border: "1px solid rgba(120,90,70,0.2)", borderRadius: 12, padding: "12px 16px" }}>
              <p className="text-[9px] font-black tracking-[0.3em] uppercase mb-1" style={{ color: "rgba(180,140,100,0.7)" }}>{t("result.mineralMultiple")}</p>
              <p className="text-[10px] leading-snug" style={{ color: "var(--v1v-fg-faint)" }}>{t("result.mineralMultipleBody")}</p>
            </div>
          )}

          <ObservationContextPicker value={observationContext} onChange={setObservationContext} t={t} />

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-5 text-base font-black uppercase tracking-[0.35em] transition-all flex items-center justify-center gap-2"
            style={{ background: saving ? "rgba(57,184,20,0.5)" : "var(--v1v-green)", color: "var(--v1v-bg)", borderRadius: 12 }}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {t("result.savingObservation")}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {t("result.saveObservationLong")}
              </>
            )}
          </button>

          {/* Share button */}
          <button
            onClick={() => setShowShare(true)}
            className="w-full py-3 text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 transition-all hover:opacity-80"
            style={{ background: "var(--v1v-green-bg-subtle)", color: "var(--v1v-green-faint)", border: "1px solid var(--v1v-green-ghost)", borderRadius: 12 }}
          >
            <Share2 className="w-3.5 h-3.5" />
            {t("result.shareDiscovery")}
          </button>
          <div className="h-6" />
        </div>
      </div>
    </div>

    {showShare && (
      <DiscoveryShareCard data={shareData} onClose={() => setShowShare(false)} />
    )}
    </>,
    document.body
  );
}
