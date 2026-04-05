import { AlertTriangle, Utensils, Target } from "lucide-react";

export default function PlantCard({ plant, onClick }) {
  const rarityStyles = {
    commune: { dot: "#2EA80F", bg: "rgba(46,168,15,0.05)", border: "1px solid rgba(46,168,15,0.15)", glow: null, scopeColor: "#2EA80F" },
    peu_commune: { dot: "#3B7DE8", bg: "rgba(59,125,232,0.07)", border: "1px solid rgba(59,125,232,0.22)", glow: "0 0 16px rgba(59,125,232,0.1)", scopeColor: "#3B7DE8" },
    rare: { dot: "#7C3AED", bg: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.28)", glow: "0 0 24px rgba(124,58,237,0.12)", scopeColor: "#7C3AED" },
    legendaire: { dot: "#C49A0A", bg: "rgba(196,154,10,0.09)", border: "1px solid rgba(196,154,10,0.45)", glow: "0 0 32px rgba(196,154,10,0.15)", scopeColor: "#C49A0A" },
  };
  const rarityLabels = { commune: "Commune", peu_commune: "Peu Commune", rare: "Rare", legendaire: "Légendaire" };
  const rs = rarityStyles[plant.rarity] || rarityStyles.commune;
  const lbl = rarityLabels[plant.rarity] || "Commune";

  return (
    <div
      onClick={() => onClick(plant)}
      className="overflow-hidden cursor-pointer select-none"
      style={{
        background:   rs.bg,
        border:       rs.border,
        boxShadow:    rs.glow ? `${rs.glow}, inset 0 1px 0 rgba(255,255,255,0.04)` : "inset 0 1px 0 rgba(255,255,255,0.04)",
        borderRadius: 16,
        transform:    "translateZ(0)",
        transition:   "transform 120ms cubic-bezier(0.4,0,0.2,1), opacity 120ms ease",
        WebkitTapHighlightColor: "transparent",
      }}
      onPointerDown={e => { e.currentTarget.style.transform = "scale(0.965) translateZ(0)"; e.currentTarget.style.opacity = "0.88"; }}
      onPointerUp={e   => { e.currentTarget.style.transform = "translateZ(0)"; e.currentTarget.style.opacity = "1"; }}
      onPointerLeave={e => { e.currentTarget.style.transform = "translateZ(0)"; e.currentTarget.style.opacity = "1"; }}
    >
      {/* ── Image zone ── */}
      <div className="relative w-full" style={{ height: 170 }}>
        {plant.photo_url ? (
          <>
            <img
              src={plant.thumbnail_url || plant.photo_url}
              alt={plant.common_name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={e => { e.currentTarget.style.opacity = "0"; }}
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to top, rgba(8,16,8,0.80) 0%, rgba(8,16,8,0.15) 45%, transparent 70%)" }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.25)" }}
          >
            <Target className="w-14 h-14" style={{ color: rs.scopeColor, opacity: 0.4 }} />
          </div>
        )}

        {/* Rarity badge — top right */}
        <div
          className="absolute top-2 right-2 flex items-center gap-1 px-2"
          style={{
            height: 20,
            borderRadius: 20,
            background: "rgba(10,16,10,0.72)",
            backdropFilter: "blur(8px)",
            border: `1px solid ${rs.dot}40`,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: rs.dot, flexShrink: 0 }} />
          <span className="text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: rs.dot }}>{lbl}</span>
        </div>

        {/* Status badge — top left */}
        {plant.is_toxic && (
          <div
            className="absolute top-2 left-2 flex items-center justify-center"
            style={{ width: 26, height: 26, background: "rgba(0,0,0,0.65)", borderRadius: 8, backdropFilter: "blur(6px)" }}
          >
            <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#FF6B6B" }} />
          </div>
        )}
        {plant.is_edible && !plant.is_toxic && (
          <div
            className="absolute top-2 left-2 flex items-center justify-center"
            style={{ width: 26, height: 26, background: "rgba(0,0,0,0.65)", borderRadius: 8, backdropFilter: "blur(6px)" }}
          >
            <Utensils className="w-3.5 h-3.5" style={{ color: "#A8E063" }} />
          </div>
        )}
      </div>

      {/* ── Info zone ── */}
      <div className="px-3 pt-2.5 pb-3 flex flex-col gap-0.5">
        <p
          className="font-black text-[13px] uppercase leading-tight"
          style={{ color: "var(--v1v-fg)", letterSpacing: "0.04em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
        >
          {plant.common_name}
        </p>
        {plant.scientific_name && (
          <p
            className="text-[10px] italic truncate leading-snug mt-0.5"
            style={{ color: "var(--v1v-fg-faint)" }}
          >
            {plant.scientific_name}
          </p>
        )}
      </div>
    </div>
  );
}