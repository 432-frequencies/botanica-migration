import { getCurrentLevel, getNextLevel } from "./XPLevelBar";
import { useEffect, useRef, useState } from "react";

const RANK_COLORS = {
  Explorateur: "#1565C0",
  Observateur: "#0288D1",
  "Observateur local": "#00ACC1",
  Inventoriste: "#3FA34D",
  Naturaliste: "#2E7D32",
  Gardien: "#1B5E20",
  "Gardien de terrain": "#5D4037",
  Référent: "#6D4C41",
  "Référent local": "#8D6E63",
  "Gardien du vivant": "#2E7D32",
  "Référent régional": "#6D4C41",
  "Archiviste du vivant": "#1565C0",
  "Passeur du vivant": "#00ACC1",
  "Légende": "#FBC02D",
  "Légende du vivant": "#FFF176",
};

export default function XPLevelModule({ totalXP }) {
  const currentLevel = getCurrentLevel(totalXP);
  const nextLevel = getNextLevel(totalXP);
  const G = "var(--v1v-green)";
  const BLUE = "var(--v1v-blue)";
  const SURFACE = "var(--v1v-surface-1)";
  const [animatedXP, setAnimatedXP] = useState(totalXP);
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const prevXPRef = useRef(totalXP);

  const xpToNext = nextLevel ? nextLevel.xp - totalXP : 0;
  const targetProgress = nextLevel
    ? Math.min(((totalXP - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100, 100)
    : 100;

  // Animation fluide des XP et de la progression
  useEffect(() => {
    const xpDiff = totalXP - prevXPRef.current;
    if (xpDiff > 0) {
      // Animation compteur XP
      const duration = 1000;
      const steps = 30;
      const stepDuration = duration / steps;
      const stepValue = xpDiff / steps;
      let current = prevXPRef.current;

      const interval = setInterval(() => {
        current += stepValue;
        if (current >= totalXP) {
          current = totalXP;
          clearInterval(interval);
        }
        setAnimatedXP(Math.floor(current));
      }, stepDuration);

      return () => clearInterval(interval);
    } else {
      setAnimatedXP(totalXP);
    }
    prevXPRef.current = totalXP;
  }, [totalXP]);

  // Animation de la barre de progression
  useEffect(() => {
    setAnimatedProgress(targetProgress);
  }, [targetProgress]);

  const levelColor = RANK_COLORS[currentLevel?.label] || G;

  return (
    <div className="w-full">
      {/* Ligne 1 — LVL + RANG */}
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="flex items-baseline gap-3">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center font-black text-xs transition-all duration-300"
              style={{
                width: '28px',
                height: '28px',
                background: SURFACE,
                border: `1px solid ${levelColor}55`,
                borderRadius: '6px',
                color: levelColor,
                boxShadow: `0 10px 28px ${levelColor}1f`,
              }}
            >
              {currentLevel?.level || 1}
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.34em]" style={{ color: "var(--v1v-fg-faint)" }}>
                Palier actuel
              </p>
              <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: levelColor }}>
                {currentLevel?.label || "Explorateur"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full mb-2.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", borderRadius: "6px", height: '10px', position: 'relative' }}>
        <div
          style={{
            height: '100%',
            width: `${animatedProgress}%`,
            background: `linear-gradient(90deg, ${levelColor}, ${nextLevel ? BLUE : G})`,
            boxShadow: `0 0 16px ${levelColor}45, inset 0 1px 0 rgba(255,255,255,0.18)`,
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: '6px',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
              animation: 'shimmer 2s infinite',
              borderRadius: '6px',
            }}
          />
        </div>

        {nextLevel && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
            {[25, 50, 75].map(pct => (
              <div
                key={pct}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  width: '2px',
                  height: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '1px',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ligne 3 — XP actuel + prochain palier */}
      <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.3em]">
        <p style={{ color: levelColor, transition: 'color 0.3s' }}>
          {animatedXP.toLocaleString()} XP
        </p>
        {nextLevel ? (
          <p style={{ color: "var(--v1v-fg-muted)" }}>
            <span style={{ color: G }}>{xpToNext}</span> avant {nextLevel.label}
          </p>
        ) : (
          <p style={{ color: levelColor }}>repère accompli</p>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
