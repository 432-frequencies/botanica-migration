import { X, Camera, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function GhostSpeciesModal({ species, onClose }) {
  if (!species) return null;

  const { photo_url, common_name, category, rarity, count, scientific_name } = species;

  const categoryEmoji = {
    plant: "🌿",
    bird: "🦜",
    fungus: "🍄",
    tree: "🌳",
    insect: "🦗",
    arachnid: "🕷️",
    amphibian: "🐸",
    mammal: "🦊",
  }[category] || "❓";

  // Masked name (more visible than card)
  const maskedName = common_name
    ? common_name.slice(0, Math.ceil(common_name.length * 0.6)) + "•".repeat(Math.floor(common_name.length * 0.4))
    : "?";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
        style={{ background: "rgba(0, 0, 0, 0.85)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg mx-4 mb-4 sm:mb-0"
          style={{
            background: "var(--v1v-bg-card)",
            border: "1px solid var(--v1v-green-ghost)",
            borderRadius: 20,
            overflow: "hidden",
          }}
        >
          {/* Header avec bouton fermer */}
          <div className="relative">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(10, 20, 10, 0.9)",
                border: "1px solid var(--v1v-green-ghost)",
              }}
            >
              <X className="w-4 h-4" style={{ color: "var(--v1v-fg)" }} />
            </button>

            {/* Photo floue */}
            <div className="relative" style={{ height: 240 }}>
              <img
                src={photo_url}
                alt="Ghost species"
                className="w-full h-full object-cover"
                style={{
                  filter: "grayscale(70%) blur(4px) brightness(0.5)",
                }}
              />

              {/* Overlay */}
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, rgba(10, 20, 10, 0.3), rgba(10, 20, 10, 0.7))",
                }}
              />

              {/* Badge gold */}
              <div
                className="absolute top-3 left-3 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em]"
                style={{
                  background: "#C8960A",
                  color: "#0A140A",
                  borderRadius: 6,
                }}
              >
                🔒 Espèce Locale
              </div>
            </div>
          </div>

          {/* Contenu */}
          <div className="px-5 py-5 flex flex-col gap-4">
            {/* Catégorie */}
            <div className="flex items-center gap-2">
              <span className="text-xl">{categoryEmoji}</span>
              <span
                className="text-[9px] font-black uppercase tracking-[0.25em]"
                style={{ color: "var(--v1v-green-faint)" }}
              >
                {category}
              </span>
            </div>

            {/* Nom masqué */}
            <div>
              <div
                className="text-xl font-black uppercase tracking-wide mb-1"
                style={{ color: "var(--v1v-fg)" }}
              >
                {maskedName}
              </div>
              <div
                className="text-xs italic"
                style={{ color: "var(--v1v-fg-muted)" }}
              >
                Nom scientifique : •••••••••
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3">
              <div
                className="px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em]"
                style={{
                  background: "var(--v1v-green-bg)",
                  color: "var(--v1v-green)",
                  borderRadius: 4,
                }}
              >
                {rarity.replace("_", " ")}
              </div>
              <div
                className="text-[10px] tracking-[0.2em] uppercase"
                style={{ color: "var(--v1v-fg-faint)" }}
              >
                {count} observations
              </div>
            </div>

            {/* Message */}
            <div
              className="px-4 py-3 text-sm leading-relaxed"
              style={{
                background: "var(--v1v-green-bg-subtle)",
                border: "1px solid var(--v1v-green-ghost)",
                borderRadius: 8,
                color: "var(--v1v-fg-muted)",
              }}
            >
              Cette espèce a été observée dans ton secteur (moins de 10 km).
              Lance une session terrain pour la découvrir et débloquer sa fiche complète.
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-2">
              <Link
                to="/"
                className="w-full py-3 px-4 text-sm font-black uppercase tracking-[0.15em] text-center transition-all active:scale-95"
                style={{
                  background: "var(--v1v-green)",
                  color: "var(--v1v-bg)",
                  borderRadius: 8,
                }}
              >
                <Camera className="inline-block w-4 h-4 mr-2" />
                Scanner Maintenant
              </Link>

              <button
                onClick={onClose}
                className="w-full py-3 px-4 text-sm font-black uppercase tracking-[0.15em] transition-all active:scale-95"
                style={{
                  background: "transparent",
                  color: "var(--v1v-green)",
                  border: "1px solid var(--v1v-green)",
                  borderRadius: 8,
                }}
              >
                Plus Tard
              </button>
            </div>

            {/* Footer hint */}
            <div
              className="text-center text-[9px] tracking-[0.25em] uppercase mt-1"
              style={{ color: "var(--v1v-fg-faint)" }}
            >
              Indice : Cherche dans les {category === "bird" ? "arbres" : category === "fungus" ? "zones humides" : "environs"}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
