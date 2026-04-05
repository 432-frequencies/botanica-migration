import XPLevelBar, { getCurrentLevel } from "./XPLevelBar";

const RANK_COLORS = {
  Scout: "#2D7A1F", Tracker: "#3AAF1A", Observer: "#3AB8A5",
  "Field Agent": "#3A7AB8", Specialist: "#7A3AB8", Expert: "#B87A3A",
  Analyst: "#B83A3A", Elite: "#B8983A", Phantom: "#A0A0A0", Ghost: "#E0E0E0",
};

export default function ProgressionBlock({ totalXP, dataLoaded }) {
  const currentLevel = getCurrentLevel(totalXP);
  const G = "var(--v1v-green)";

  if (!dataLoaded) {
    return <div className="mb-4 h-20" style={{ background: "rgba(45,122,31,0.1)", border: "1px solid rgba(45,122,31,0.1)" }} />;
  }

  return (
    <div className="p-4 mb-4" style={{ background: "linear-gradient(135deg, rgba(45,122,31,0.1) 0%, rgba(45,122,31,0.05) 100%)", border: "1px solid rgba(45,122,31,0.2)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: G }}>LVL {currentLevel?.level || 1}</p>
        <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: RANK_COLORS[currentLevel?.label] || G }}>{currentLevel?.label || "Scout"}</p>
      </div>
      <XPLevelBar totalXP={totalXP} compact />
      <p className="text-[9px] mt-2.5" style={{ color: "rgba(45,122,31,0.6)" }}>
        {currentLevel?.nextMilestone 
          ? `+${currentLevel.nextMilestone.xp - totalXP} XP pour progresser` 
          : "Palier max atteint"}
      </p>
    </div>
  );
}