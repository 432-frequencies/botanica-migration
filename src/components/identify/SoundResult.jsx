import { Sparkles, Volume2, Share2 } from "lucide-react";
import { useState } from "react";
import DiscoveryShareCard from "./DiscoveryShareCard";

const RARITY_COLORS = {
  commune: { bg: "rgba(100,100,100,0.1)", border: "rgba(100,100,100,0.3)", text: "rgba(100,100,100,0.8)" },
  peu_commune: { bg: "rgba(45,122,31,0.1)", border: "rgba(45,122,31,0.3)", text: "var(--v1v-green)" },
  rare: { bg: "rgba(57,184,20,0.15)", border: "rgba(57,184,20,0.4)", text: "#39B814" },
  legendaire: { bg: "rgba(255,215,0,0.15)", border: "rgba(255,215,0,0.5)", text: "#FFD700" }
};

export default function SoundResult({ result, onSave, onRetry, saving, userProfile }) {
  const [showShare, setShowShare] = useState(false);
  const rarity = RARITY_COLORS[result.rarity] || RARITY_COLORS.commune;

  const shareData = {
    common_name: result.common_name,
    scientific_name: result.scientific_name,
    rarity: result.rarity || "commune",
    photo_url: result.photo_url || result.spectrogram_url || null,
    xp_gained: result.rarity === "legendaire" ? 150 : result.rarity === "rare" ? 75 : result.rarity === "peu_commune" ? 30 : 10,
    flora_gained: result.rarity === "legendaire" ? 10 : result.rarity === "rare" ? 5 : 0,
    discovery_rank: null,
    detection_method: "audio",
    user_name: userProfile?.display_name || null,
    date: new Date().toLocaleDateString("fr-FR"),
  };
  const categoryIcon = result.category === "bird" ? "🐦" : "🦗";
  const categoryLabel = result.category === "bird" ? "Oiseau" : "Insecte";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--v1v-bg)" }}>
      {/* Header Image/Spectrogram */}
      <div className="relative h-64 overflow-hidden" style={{ background: "var(--v1v-green-bg)" }}>
        {result.spectrogram_url ? (
          <img src={result.spectrogram_url} alt="Spectrogramme" className="w-full h-full object-cover opacity-80" />
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
          <span style={{ color: "var(--v1v-green)" }}>Détecté par son</span>
        </div>

        {/* Rarity Badge */}
        <div
          className="absolute bottom-4 left-4 px-3 py-1.5 text-xs font-black uppercase tracking-wider"
          style={{ background: rarity.bg, border: `1px solid ${rarity.border}`, color: rarity.text }}
        >
          {result.rarity.replace("_", " ")}
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
              Famille : {result.family}
            </p>
          )}
        </div>

        {/* Sound Type */}
        {result.sound_type && (
          <div className="mb-6 p-4" style={{ background: "var(--v1v-green-bg)", border: "1px solid var(--v1v-green-ghost)" }}>
            <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: "var(--v1v-green-faint)" }}>
              Type de son
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
              Description
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
              Habitat
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
              Comportement
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
                Le saviez-vous ?
              </p>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg)" }}>
              {result.anecdote}
            </p>
          </div>
        )}

        {/* Confidence */}
        {result.confidence && (
          <div className="mb-6">
            <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "var(--v1v-green-faint)" }}>
              Confiance : {Math.round(result.confidence * 100)}%
            </p>
            <div className="h-2 w-full" style={{ background: "var(--v1v-green-ghost)" }}>
              <div
                className="h-full transition-all"
                style={{ width: `${result.confidence * 100}%`, background: "var(--v1v-green)" }}
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
            Réessayer
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 py-4 font-black uppercase text-sm tracking-[0.25em] transition-all active:scale-95 disabled:opacity-40"
            style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
          >
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>

        {/* Share button */}
        <button
          onClick={() => setShowShare(true)}
          className="w-full mt-3 mb-8 py-3 text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 transition-all hover:opacity-80"
          style={{ background: "var(--v1v-green-bg)", color: "var(--v1v-green-faint)", border: "1px solid var(--v1v-green-ghost)" }}
        >
          <Share2 className="w-3.5 h-3.5" />
          Partager ma découverte
        </button>
      </div>

      {showShare && (
        <DiscoveryShareCard data={shareData} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}