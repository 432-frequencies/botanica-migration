import { motion } from "framer-motion";
import { Lock, Eye } from "lucide-react";

export default function GhostSpeciesCard({ species, onClick, index = 0 }) {
  const { photo_url, common_name, scientific_name, category, rarity, count } = species;

  // Masque partiel du nom
  const maskedName = common_name
    ? common_name.slice(0, Math.ceil(common_name.length * 0.4)) + "•".repeat(Math.floor(common_name.length * 0.6))
    : "?";

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

  const rarityColor = {
    commune: "var(--rarity-commune-soft)",
    peu_commune: "var(--rarity-peu-commune-soft)",
    rare: "var(--rarity-rare-soft)",
    legendaire: "var(--rarity-legendaire-soft)",
  }[rarity] || "var(--v1v-green)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      onClick={onClick}
      className="relative cursor-pointer"
      style={{
        borderRadius: 16,
        overflow: "hidden",
        background: "var(--v1v-bg-card)",
        border: "1px solid var(--v1v-green-ghost)",
      }}
    >
      {/* Photo avec overlay fantôme */}
      <div className="relative" style={{ height: 170 }}>
        <img
          src={photo_url}
          alt="Ghost species"
          className="w-full h-full object-cover"
          style={{
            filter: "grayscale(80%) blur(3px) brightness(0.4)",
          }}
        />

        {/* Overlay vert sombre */}
        <div
          className="absolute inset-0"
          style={{
            background: "rgba(10, 20, 10, 0.6)",
            backdropFilter: "blur(2px)",
          }}
        />

        {/* Badge "ESPÈCE LOCALE" */}
        <div
          className="absolute top-2 right-2 px-2 py-1 text-[8px] font-black uppercase tracking-[0.15em]"
          style={{
            background: "#C8960A",
            color: "#0A140A",
            borderRadius: 4,
          }}
        >
          Espèce Locale
        </div>

        {/* Icône cadenas */}
        <div
          className="absolute bottom-2 left-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{
            background: "rgba(10, 20, 10, 0.8)",
            border: "1px solid var(--v1v-green-ghost)",
          }}
        >
          <Lock className="w-3.5 h-3.5" style={{ color: "var(--v1v-green)" }} />
        </div>

        {/* Animation pulse subtile */}
        <motion.div
          className="absolute inset-0"
          animate={{
            boxShadow: [
              "inset 0 0 0px rgba(63, 163, 77, 0)",
              "inset 0 0 20px rgba(63, 163, 77, 0.3)",
              "inset 0 0 0px rgba(63, 163, 77, 0)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      {/* Informations */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-1.5">
        {/* Catégorie */}
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{categoryEmoji}</span>
          <span
            className="text-[8px] font-black uppercase tracking-[0.2em]"
            style={{ color: "var(--v1v-fg-faint)" }}
          >
            {category}
          </span>
        </div>

        {/* Nom masqué */}
        <div
          className="text-sm font-black uppercase tracking-wide"
          style={{ color: "var(--v1v-fg)" }}
        >
          {maskedName}
        </div>

        {/* Nom scientifique masqué */}
        <div
          className="text-[10px] italic tracking-wide"
          style={{ color: "var(--v1v-fg-muted)" }}
        >
          •••••••••
        </div>

        {/* Rareté + count */}
        <div className="flex items-center justify-between mt-1">
          <div
            className="px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.15em]"
            style={{
              background: rarityColor,
              color: "#0A140A",
              borderRadius: 3,
            }}
          >
            {rarity.replace("_", " ")}
          </div>

          <div
            className="text-[9px] tracking-[0.2em] uppercase"
            style={{ color: "var(--v1v-green-faint)" }}
          >
            {count} obs.
          </div>
        </div>

        {/* Indice */}
        <div
          className="text-[9px] mt-1 flex items-center gap-1"
          style={{ color: "var(--v1v-green)" }}
        >
          <Eye className="w-3 h-3" />
          <span>Observé à moins de 10km</span>
        </div>
      </div>
    </motion.div>
  );
}
