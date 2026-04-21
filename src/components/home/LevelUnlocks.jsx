import { Lock, CheckCircle } from "lucide-react";
import { LEVELS, getCurrentLevel } from "./XPLevelBar";

export default function LevelUnlocks({ totalXP = 0 }) {
  const current = getCurrentLevel(totalXP);
  const milestoneLevels = LEVELS.filter((l) => l.unlock);
  const visibleLevels = milestoneLevels.filter(
    (l) => l.level >= Math.max(1, current.level - 1) && l.level <= Math.min(LEVELS.length, current.level + 3),
  );

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-4 h-px" style={{ background: "var(--v1v-green-ghost)" }} />
        <p className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: "var(--v1v-fg-faint)" }}>
          Jalons du parcours
        </p>
      </div>

      <div className="space-y-2">
        {visibleLevels.map((l) => {
          const unlocked = totalXP >= l.xp;
          const isCurrent = l.level === current.level;
          const isNext = l.level === current.level + 1;
          return (
            <div
              key={l.level}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: isCurrent ? "var(--v1v-green-bg)" : unlocked ? "var(--v1v-green-bg-light)" : "transparent",
                border: `1px solid ${isCurrent || isNext ? "var(--v1v-green-ghost)" : unlocked ? "var(--v1v-green-ghost)" : "var(--v1v-green-bg)"}`,
                opacity: unlocked || isCurrent || isNext ? 1 : 0.7,
                filter: "none",
              }}
            >
              <div
                className="w-6 h-6 flex items-center justify-center text-[9px] font-black flex-shrink-0"
                style={{
                  background: unlocked ? "var(--v1v-fg)" : isNext ? "var(--v1v-green-bg)" : "var(--v1v-green-bg-light)",
                  color: unlocked ? "var(--v1v-bg)" : isNext ? "var(--v1v-green)" : "var(--v1v-fg-faint)",
                }}
              >
                {l.level}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: unlocked || isCurrent ? "var(--v1v-fg)" : isNext ? "var(--v1v-green)" : "var(--v1v-fg-faint)" }}>
                  {l.label}
                </p>
                <p className="text-[8px] tracking-wider mt-0.5" style={{ color: "var(--v1v-fg-faint)" }}>
                  {l.unlock || "La qualité de tes observations continue de grandir."}
                </p>
              </div>
              <div className="flex-shrink-0">
                {unlocked ? (
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "var(--v1v-green-muted)" }} />
                ) : isNext ? (
                  <div className="text-[8px] font-black uppercase tracking-[0.25em]" style={{ color: "var(--v1v-green)" }}>
                    Suiv.
                  </div>
                ) : (
                  <Lock className="w-3.5 h-3.5" style={{ color: "var(--v1v-green-ghost)" }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
