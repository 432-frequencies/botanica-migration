import { useEffect, useState } from "react";

export default function AchievementToast({ achievements, onDone }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!achievements || achievements.length === 0) { onDone(); return; }
    const timer = setTimeout(() => {
      if (index < achievements.length - 1) {
        setVisible(false);
        setTimeout(() => { setIndex(i => i + 1); setVisible(true); }, 300);
      } else {
        setVisible(false);
        setTimeout(onDone, 300);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [index, achievements]);

  if (!achievements || achievements.length === 0) return null;
  const ach = achievements[index];

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 w-full max-w-xs px-5 ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
    >
      <div
        className="px-5 py-4 flex items-center gap-4"
        style={{ background: "#E8E0D0", border: "none" }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[8px] font-black tracking-[0.5em] uppercase mb-0.5" style={{ color: "rgba(0,0,0,0.4)" }}>
            Achievement Unlocked
          </p>
          <p className="text-sm font-black uppercase truncate" style={{ color: "#0A0A0A" }}>{ach.title}</p>
          {ach.bonus > 0 && (
            <p className="text-[9px] font-black tracking-widest mt-0.5" style={{ color: "rgba(0,0,0,0.5)" }}>
              +{ach.bonus} XP
            </p>
          )}
        </div>
        <span className="text-2xl flex-shrink-0">{ach.icon}</span>
      </div>
    </div>
  );
}