import { Zap, Lock, Unlock } from "lucide-react";

export const LEVELS = [
  { level: 1,  xp: 0,     label: "Novice",             unlock: null },
  { level: 2,  xp: 100,   label: "Herboriste",         unlock: null },
  { level: 3,  xp: 250,   label: "Observateur",        unlock: null },
  { level: 4,  xp: 500,   label: "Éclaireur",          unlock: null },
  { level: 5,  xp: 900,   label: "Naturaliste",        unlock: null },
  { level: 6,  xp: 1500,  label: "Garde Forestier",    unlock: null },
  { level: 7,  xp: 2500,  label: "Expert Terrain",     unlock: null },
  { level: 8,  xp: 4000,  label: "Protecteur",         unlock: null },
  { level: 9,  xp: 6500,  label: "Sentinelle",         unlock: null },
  { level: 10, xp: 10000, label: "Gardien du vivant",  unlock: null },
];

export function getCurrentLevel(totalXP) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (totalXP >= l.xp) current = l;
  }
  return current;
}

export function getNextLevel(totalXP) {
  const curr = getCurrentLevel(totalXP);
  return LEVELS.find(l => l.level === curr.level + 1) || null;
}

export default function XPLevelBar({ totalXP = 0, compact = false }) {
  const current = getCurrentLevel(totalXP);
  const next = getNextLevel(totalXP);

  const progressPct = next
    ? Math.min(100, ((totalXP - current.xp) / (next.xp - current.xp)) * 100)
    : 100;

  const G = "#2D7A1F";
  const GDB = "rgba(45,122,31,0.08)";

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 flex items-center justify-center text-xs font-black flex-shrink-0"
          style={{ background: GDB, color: G, border: `1px solid rgba(45,122,31,0.4)` }}
        >
          {current.level}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: G }}>
              LVL {current.level} — {current.label}
            </span>
            <span className="text-[9px] font-black" style={{ color: "rgba(45,122,31,0.5)" }}>
              {totalXP} XP
            </span>
          </div>
          <div className="h-px w-full" style={{ background: "rgba(45,122,31,0.15)" }}>
            <div
              className="h-px transition-all duration-700"
              style={{ width: `${progressPct}%`, background: G }}
            />
          </div>
          {next && (
            <p className="text-[8px] uppercase tracking-widest mt-1" style={{ color: "rgba(45,122,31,0.35)" }}>
              {next.xp - totalXP} XP → LVL {next.level}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4" style={{ border: `1px solid rgba(45,122,31,0.2)`, background: GDB }}>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 flex items-center justify-center text-2xl font-black flex-shrink-0"
          style={{ background: GDB, color: G, border: `1px solid rgba(45,122,31,0.5)` }}
        >
          {current.level}
        </div>
        <div>
          <p className="text-[8px] tracking-[0.4em] uppercase mb-0.5" style={{ color: "rgba(45,122,31,0.5)" }}>
            Niveau actuel
          </p>
          <p className="text-lg font-black uppercase tracking-wider" style={{ color: G }}>
            {current.label}
          </p>
        </div>
      </div>

      {/* XP bar */}
      <div className="mb-4">
        <div className="flex justify-between mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(45,122,31,0.7)" }}>
            {totalXP} XP
          </span>
          {next && (
            <span className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(45,122,31,0.4)" }}>
              {next.xp} XP
            </span>
          )}
        </div>
        <div className="h-0.5 w-full" style={{ background: "rgba(45,122,31,0.15)" }}>
          <div
            className="h-0.5 transition-all duration-700"
            style={{ width: `${progressPct}%`, background: G }}
          />
        </div>
        {next ? (
          <p className="text-[8px] uppercase tracking-widest mt-1.5" style={{ color: "rgba(45,122,31,0.4)" }}>
            {next.xp - totalXP} XP jusqu'à {next.label}
          </p>
        ) : (
          <p className="text-[8px] uppercase tracking-widest mt-1.5" style={{ color: "rgba(45,122,31,0.6)" }}>
            Niveau Max atteint
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
                background: isCurrent ? "rgba(45,122,31,0.12)" : "transparent",
                color: isCurrent ? G : unlocked ? "rgba(45,122,31,0.6)" : "rgba(45,122,31,0.2)",
                border: isCurrent ? `1px solid ${G}` : `1px solid rgba(45,122,31,0.15)`,
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