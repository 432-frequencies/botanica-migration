import { Sparkles, Volume2, Share2, X } from "lucide-react";
import { useState } from "react";
import DiscoveryShareCard from "./DiscoveryShareCard";
import { useTranslation } from "@/lib/i18n";

const RARITY_COLORS = {
  commune: { bg: "rgba(100,100,100,0.1)", border: "rgba(100,100,100,0.3)", text: "rgba(100,100,100,0.8)" },
  peu_commune: { bg: "rgba(45,122,31,0.1)", border: "rgba(45,122,31,0.3)", text: "var(--v1v-green)" },
  rare: { bg: "rgba(57,184,20,0.15)", border: "rgba(57,184,20,0.4)", text: "#39B814" },
  legendaire: { bg: "rgba(255,215,0,0.15)", border: "rgba(255,215,0,0.5)", text: "#FFD700" }
};

const RARITY_LABEL_KEYS = {
  commune: "result.rarityCommune",
  peu_commune: "result.rarityPeuCommune",
  rare: "result.rarityRare",
  legendaire: "result.rarityLegendaire",
};

export default function SoundResult({ result, onSave, onRetry, onClose, saving, userProfile }) {
  const { language, t } = useTranslation();
  const [showShare, setShowShare] = useState(false);
  const resultRarity = result.rarity || "commune";
  const rarity = RARITY_COLORS[resultRarity] || RARITY_COLORS.commune;
  const rarityLabel = t(RARITY_LABEL_KEYS[resultRarity] || "result.rarityCommune");
  const confidenceValue = Number(result.confidence);
  const confidencePercent = Number.isFinite(confidenceValue)
    ? Math.max(0, Math.min(100, confidenceValue > 1 ? confidenceValue : confidenceValue * 100))
    : null;

  const shareData = {
    common_name: result.common_name,
    scientific_name: result.scientific_name,
    rarity: resultRarity,
    photo_url: result.photo_url || result.spectrogram_url || null,
    xp_gained: resultRarity === "legendaire" ? 150 : resultRarity === "rare" ? 75 : resultRarity === "peu_commune" ? 30 : 10,
    flora_gained: resultRarity === "legendaire" ? 10 : resultRarity === "rare" ? 5 : 0,
    discovery_rank: null,
    detection_method: "audio",
    user_name: userProfile?.display_name || null,
    date: new Date().toLocaleDateString(language === "en" ? "en-US" : "fr-FR"),
  };
  const categoryIcon = result.category === "bird" ? "🐦" : "🦗";
  const categoryLabel = result.category === "bird" ? t("sound.bird") : t("sound.insect");

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--v1v-bg)" }}>
      {/* Header Image/Spectrogram */}
      <div className="relative h-64 overflow-hidden" style={{ background: "var(--v1v-green-bg)" }}>
        {result.spectrogram_url ? (
          <img src={result.spectrogram_url} alt="Spectrogram" className="w-full h-full object-cover opacity-80" />
        ) : result.photo_url ? (
          <img src={result.photo_url} alt={result.common_name} className="w-full h-full object-cover opacity-80" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-8xl">{categoryIcon}</div>
        )}
        
        {/* Detection Badge */}
        <div
          className="absolute top-4 right-4 px-3 py-1.5 flex items-center gap-2 text-xs font-black uppercase tracking-wider"
          style={{ background: "var(--v1v-bg-overlay)", border: "1px solid var(--v1v-green-dim)" }}
        >
          <Volume2 className="w-3 h-3" style={{ color: "var(--v1v-green)" }} />
          <span style={{ color: "var(--v1v-green)" }}>{t("sound.detectedBySound")}</span>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-95"
            style={{
              background: "rgba(3,8,5,0.68)",
              border: "1px solid rgba(174,255,188,0.16)",
              color: "rgba(244,255,246,0.78)",
              backdropFilter: "blur(14px)",
            }}
            aria-label={t("sound.closeAudio")}
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Rarity Badge */}
        <div
          className="absolute bottom-4 left-4 px-3 py-1.5 text-xs font-black uppercase tracking-wider"
          style={{ background: rarity.bg, border: `1px solid ${rarity.border}`, color: rarity.text }}
        >
          {rarityLabel}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {/* Category & Names */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-3xl">{categoryIcon}</span>
            <span className="text-xs tracking-[0.4em] uppercase font-black" style={{ color: "var(--v1v-green-faint)" }}>
              {categoryLabel}
            </span>
          </div>
          <h1 className="text-2xl font-black uppercase mb-1" style={{ color: "var(--v1v-fg)" }}>
            {result.common_name}
          </h1>
          <p className="text-sm italic" style={{ color: "var(--v1v-fg-muted)" }}>
            {result.scientific_name}
          </p>
          {result.family && (
            <p className="text-xs mt-1 tracking-wider" style={{ color: "var(--v1v-green-faint)" }}>
              {t("sound.family", { family: result.family })}
            </p>
          )}
        </div>

        {/* Sound Type */}
        {result.sound_type && (
          <div className="mb-6 p-4" style={{ background: "var(--v1v-green-bg)", border: "1px solid var(--v1v-green-ghost)" }}>
            <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: "var(--v1v-green-faint)" }}>
              {t("sound.soundType")}
            </p>
            <p className="font-black uppercase" style={{ color: "var(--v1v-green)" }}>
              {result.sound_type}
            </p>
          </div>
        )}

        {/* Description */}
        {result.description && (
          <div className="mb-6">
            <p className="text-xs tracking-[0.3em] uppercase mb-2 font-black" style={{ color: "var(--v1v-green-faint)" }}>
              {t("sound.description")}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg)" }}>
              {result.description}
            </p>
          </div>
        )}

        {/* Habitat */}
        {result.habitat && (
          <div className="mb-6">
            <p className="text-xs tracking-[0.3em] uppercase mb-2 font-black" style={{ color: "var(--v1v-green-faint)" }}>
              {t("sound.habitat")}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg)" }}>
              {result.habitat}
            </p>
          </div>
        )}

        {/* Behavior */}
        {result.behavior && (
          <div className="mb-6">
            <p className="text-xs tracking-[0.3em] uppercase mb-2 font-black" style={{ color: "var(--v1v-green-faint)" }}>
              {t("sound.behavior")}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg)" }}>
              {result.behavior}
            </p>
          </div>
        )}

        {/* Anecdote */}
        {result.anecdote && (
          <div
            className="mb-6 p-4"
            style={{ background: "var(--v1v-green-bg-light)", border: "1px solid var(--v1v-green-ghost)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4" style={{ color: "var(--v1v-green)" }} />
              <p className="text-xs tracking-[0.3em] uppercase font-black" style={{ color: "var(--v1v-green-faint)" }}>
                {t("sound.didYouKnow")}
              </p>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg)" }}>
              {result.anecdote}
            </p>
          </div>
        )}

        {/* Confidence */}
        {confidencePercent !== null && (
          <div className="mb-6">
            <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "var(--v1v-green-faint)" }}>
              {t("sound.confidence", { value: Math.round(confidencePercent) })}
            </p>
            <div className="h-2 w-full" style={{ background: "var(--v1v-green-ghost)" }}>
              <div
                className="h-full transition-all"
                style={{ width: `${confidencePercent}%`, background: "var(--v1v-green)" }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-8" >
          <button
            onClick={onRetry}
            disabled={saving}
            className="flex-1 py-4 font-black uppercase text-sm tracking-[0.25em] transition-all active:scale-95 disabled:opacity-40"
            style={{ border: "1px solid var(--v1v-green-dim)", color: "var(--v1v-green)" }}
          >
            {t("sound.retry")}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-4 font-black uppercase text-sm tracking-[0.25em] transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
          >
            {saving ? t("sound.saving") : t("sound.save")}
          </button>
        </div>

        {/* Share button */}
        <button
          onClick={() => setShowShare(true)}
          className="w-full mt-3 mb-8 py-3 text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 transition-all hover:opacity-80"
          style={{ background: "var(--v1v-green-bg)", color: "var(--v1v-green-faint)", border: "1px solid var(--v1v-green-ghost)" }}
        >
          <Share2 className="w-3.5 h-3.5" />
          {t("sound.share")}
        </button>
      </div>

      {showShare && (
        <DiscoveryShareCard data={shareData} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
