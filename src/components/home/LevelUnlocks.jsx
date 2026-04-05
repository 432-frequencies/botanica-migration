import { Lock, CheckCircle, Zap } from "lucide-react";
import { LEVELS, getCurrentLevel } from "./XPLevelBar";

export default function LevelUnlocks({ totalXP = 0 }) {
  const current = getCurrentLevel(totalXP);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-4 h-px" style={{ background: "var(--v1v-green-ghost)" }} />
        <p className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: "var(--v1v-fg-faint)" }}>
          Capacités débloquées
        </p>
      </div>

      <div className="space-y-2">
        {LEVELS.filter(l => l.unlock).map((l) => {
          const unlocked = totalXP >= l.xp;
          const isCurrent = l.level === current.level + 1;
          return (
            <div
              key={l.level}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: unlocked ? "var(--v1v-green-bg-light)" : "transparent",
                border: `1px solid ${unlocked ? "var(--v1v-green-ghost)" : "var(--v1v-green-bg)"}`,
                opacity: unlocked ? 1 : 0.7,
                filter: "none",
              }}
            >
              <div
                className="w-6 h-6 flex items-center justify-center text-[9px] font-black flex-shrink-0"
                style={{
                  background: unlocked ? "var(--v1v-fg)" : "var(--v1v-green-bg)",
                  color: unlocked ? "var(--v1v-bg)" : "var(--v1v-fg-faint)",
                }}
              >
                {l.level}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: unlocked ? "var(--v1v-fg)" : "var(--v1v-fg-faint)" }}>
                  {l.label}
                </p>
                <p className="text-[8px] tracking-wider mt-0.5" style={{ color: "var(--v1v-fg-faint)" }}>
                  {l.unlock}
                </p>
              </div>
              <div className="flex-shrink-0">
                {unlocked ? (
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: "var(--v1v-green-muted)" }} />
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