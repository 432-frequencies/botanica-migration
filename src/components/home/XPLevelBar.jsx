import { LEVELS, getCurrentLevel, getNextLevel } from "@/lib/leveling";

export { LEVELS, getCurrentLevel, getNextLevel };

export default function XPLevelBar({ totalXP = 0, compact = false }) {
  const current = getCurrentLevel(totalXP);
  const next = getNextLevel(totalXP);

  const progressPct = next
    ? Math.min(100, ((totalXP - current.xp) / (next.xp - current.xp)) * 100)
    : 100;

  const G = "var(--v1v-green)";
  const GDB = "var(--v1v-green-bg)";
  const GHOST = "var(--v1v-green-ghost)";
  const FAINT = "var(--v1v-fg-faint)";
  const MUTED = "var(--v1v-fg-muted)";

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 flex items-center justify-center text-xs font-black flex-shrink-0"
          style={{ background: GDB, color: G, border: `1px solid ${GHOST}` }}
        >
          {current.level}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>
              Palier {current.level} — {current.label}
            </span>
            <span className="text-[9px] font-black" style={{ color: MUTED }}>
              {totalXP} XP
            </span>
          </div>
          <div className="h-px w-full" style={{ background: GHOST }}>
            <div
              className="h-px transition-all duration-700"
              style={{ width: `${progressPct}%`, background: G }}
            />
          </div>
          {next && (
            <p className="text-[8px] uppercase tracking-widest mt-1" style={{ color: FAINT }}>
              {next.xp - totalXP} XP avant {next.label}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4" style={{ border: `1px solid ${GHOST}`, background: GDB }}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 flex items-center justify-center text-2xl font-black flex-shrink-0"
          style={{ background: "var(--v1v-surface-1)", color: G, border: `1px solid ${GHOST}` }}
        >
          {current.level}
        </div>
        <div>
          <p className="text-[8px] tracking-[0.4em] uppercase mb-0.5" style={{ color: MUTED }}>
            Progression vivante
          </p>
          <p className="text-lg font-black uppercase tracking-wider" style={{ color: G }}>
            {current.label}
          </p>
        </div>
      </div>

      {/* XP bar */}
      <div className="mb-4">
        <div className="flex justify-between mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: G }}>
            {totalXP} XP
          </span>
          {next && (
            <span className="text-[9px] uppercase tracking-widest" style={{ color: MUTED }}>
              {next.xp} XP
            </span>
          )}
        </div>
        <div className="h-0.5 w-full" style={{ background: GHOST }}>
          <div
            className="h-0.5 transition-all duration-700"
            style={{ width: `${progressPct}%`, background: G }}
          />
        </div>
        {next ? (
          <p className="text-[8px] uppercase tracking-widest mt-1.5" style={{ color: MUTED }}>
            {next.xp - totalXP} XP avant {next.label}
          </p>
        ) : (
          <p className="text-[8px] uppercase tracking-widest mt-1.5" style={{ color: G }}>
            Référent accompli
          </p>
        )}
      </div>

      {/* Level grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {LEVELS.map((l) => {
          const unlocked = totalXP >= l.xp;
          const isCurrent = l.level === current.level;
          return (
            <div
              key={l.level}
              className="aspect-square flex items-center justify-center text-[10px] font-black relative"
              style={{
                background: isCurrent ? "var(--v1v-green-bg)" : "transparent",
                color: isCurrent ? G : unlocked ? MUTED : FAINT,
                border: isCurrent ? `1px solid ${G}` : `1px solid ${GHOST}`,
              }}
            >
              {l.level}
            </div>
          );
        })}
      </div>
    </div>
  );
}
