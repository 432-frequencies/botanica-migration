import { Lock } from "lucide-react";

export default function ChallengeCard({ challenge, isPro }) {
  const isLocked = challenge.is_pro_only && !isPro;
  const pct = Math.min(100, ((challenge.current_count || 0) / challenge.target_count) * 100);
  const isDone = challenge.is_completed;

  return (
    <div className="p-4 relative overflow-hidden" style={{ border: `1px solid ${isDone ? "rgba(45,122,31,0.4)" : "rgba(45,122,31,0.2)"}` }}>
      {isLocked && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-10"
          style={{ background: "rgba(242,237,228,0.92)", backdropFilter: "blur(4px)" }}
        >
          <Lock className="w-4 h-4 mb-1.5" style={{ color: "rgba(45,122,31,0.4)" }} />
          <p className="text-[8px] font-black tracking-[0.4em] uppercase" style={{ color: "rgba(45,122,31,0.5)" }}>Elite Access Only</p>
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <span className="text-xl leading-none mt-0.5">{challenge.badge_icon || "🎯"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black uppercase tracking-wider truncate" style={{ color: "#1A1A0F" }}>{challenge.title}</p>
          {challenge.description && (
            <p className="text-[9px] mt-0.5 leading-snug" style={{ color: "rgba(26,26,15,0.55)" }}>{challenge.description}</p>
          )}
        </div>
        <p className="text-[9px] font-black tracking-widest flex-shrink-0" style={{ color: isDone ? "#2D7A1F" : "rgba(45,122,31,0.6)" }}>
          {isDone ? "DONE" : `+${challenge.points_reward} XP`}
        </p>
      </div>

      <div>
        <div className="flex justify-between text-[8px] tracking-[0.3em] uppercase mb-1.5" style={{ color: "rgba(45,122,31,0.55)" }}>
          <span>Grind</span>
          <span>{challenge.current_count}/{challenge.target_count}</span>
        </div>
        <div className="h-px w-full" style={{ background: "rgba(45,122,31,0.15)" }}>
          <div
            className="h-px transition-all"
            style={{ width: `${pct}%`, background: isDone ? "#2D7A1F" : "rgba(45,122,31,0.6)" }}
          />
        </div>
      </div>
    </div>
  );
}