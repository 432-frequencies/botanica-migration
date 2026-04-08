import { getCurrentLevel, getNextLevel } from "./XPLevelBar";
import { useEffect, useRef, useState } from "react";

const RANK_COLORS = {
  Novice: "#2D7A1F",
  Herboriste: "#3AAF1A",
  Observateur: "#3AB8A5",
  "Éclaireur": "#3A7AB8",
  Naturaliste: "#7A3AB8",
  "Garde Forestier": "#B87A3A",
  "Expert Terrain": "#B83A3A",
  Protecteur: "#B8983A",
  Sentinelle: "#A0A0A0",
  "Gardien du vivant": "#E0E0E0",
  "Maître Ranger": "#FFD700",
  Archiviste: "#C084FC",
  Sage: "#F59E0B",
  "Légende": "#EF4444",
  "Gardien Ultime": "#8B5CF6",
};

export default function XPLevelModule({ totalXP }) {
  const currentLevel = getCurrentLevel(totalXP);
  const nextLevel = getNextLevel(totalXP);
  const G = "var(--v1v-green)";
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
            {/* Badge niveau avec animation */}
            <div
              className="flex items-center justify-center font-black text-xs transition-all duration-300"
              style={{
                width: '28px',
                height: '28px',
                background: `${levelColor}15`,
                border: `2px solid ${levelColor}50`,
                borderRadius: '6px',
                color: levelColor,
                boxShadow: `0 0 12px ${levelColor}20`,
              }}
            >
              {currentLevel?.level || 1}
            </div>
            <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: levelColor }}>
              {currentLevel?.label || "Novice"}
            </p>
          </div>
        </div>
      </div>

      {/* Ligne 2 — Barre XP épaisse avec glow */}
      <div className="w-full mb-2.5 overflow-hidden" style={{ background: "rgba(45,122,31,0.12)", borderRadius: "6px", height: '10px', position: 'relative' }}>
        {/* Barre de progression animée */}
        <div
          style={{
            height: '100%',
            width: `${animatedProgress}%`,
            background: `linear-gradient(90deg, ${levelColor}, ${G})`,
            boxShadow: `0 0 16px ${levelColor}60, inset 0 1px 0 rgba(255,255,255,0.2)`,
            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: '6px',
            position: 'relative',
          }}
        >
          {/* Effet de brillance qui se déplace */}
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

        {/* Points de progression intermédiaires */}
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
          <p style={{ color: "rgba(45,122,31,0.5)" }}>
            <span style={{ color: G }}>{xpToNext}</span> → LVL {nextLevel.level}
          </p>
        ) : (
          <p style={{ color: levelColor }}>✨ MAX</p>
        )}
      </div>

      {/* CSS pour l'animation de brillance */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}