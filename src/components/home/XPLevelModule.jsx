import { getCurrentLevel } from "./XPLevelBar";

const RANK_COLORS = {
  Scout: "#2D7A1F", Tracker: "#3AAF1A", Observer: "#3AB8A5",
  "Field Agent": "#3A7AB8", Specialist: "#7A3AB8", Expert: "#B87A3A",
  Analyst: "#B83A3A", Elite: "#B8983A", Phantom: "#A0A0A0", Ghost: "#E0E0E0",
};

export default function XPLevelModule({ totalXP }) {
  const currentLevel = getCurrentLevel(totalXP);
  const G = "var(--v1v-green)";
  
  const nextLevel = currentLevel?.nextMilestone;
  const xpToNext = nextLevel ? nextLevel.xp - totalXP : 0;
  const xpProgress = nextLevel ? Math.min((totalXP / nextLevel.xp) * 100, 100) : 100;

  return (
    <div className="w-full">
      {/* Ligne 1 — LVL + RANG */}
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="flex items-baseline gap-3">
          <p className="text-[10px] font-black uppercase tracking-[0.4em]" style={{ color: "rgba(45,122,31,0.4)" }}>
            LVL {currentLevel?.level || 1}
          </p>
          <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: RANK_COLORS[currentLevel?.label] || G }}>
            {currentLevel?.label || "Scout"}
          </p>
        </div>
      </div>

      {/* Ligne 2 — Barre XP fine */}
      <div className="w-full h-1 mb-2.5 overflow-hidden" style={{ background: "rgba(45,122,31,0.12)", borderRadius: "1px" }}>
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${xpProgress}%`,
            background: G,
            boxShadow: `0 0 8px ${G}`,
          }}
        />
      </div>

      {/* Ligne 3 — XP actuel + prochain palier */}
      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.3em]">
        <p style={{ color: "rgba(45,122,31,0.5)" }}>
          {totalXP.toLocaleString()} XP
        </p>
        {nextLevel ? (
          <p style={{ color: G }}>
            {xpToNext} → {nextLevel.label}
          </p>
        ) : (
          <p style={{ color: "rgba(45,122,31,0.4)" }}>MAX</p>
        )}
      </div>
    </div>
  );
}