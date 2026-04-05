import { Zap, Target, Crown } from "lucide-react";

export default function TensionPanel({ zoneIds, leaders, userScores, userEmail, onZoneTap }) {
  // Build tension targets: zones where user is within 5 of the leader
  const targets = zoneIds
    .map(zone_id => {
      const leader = leaders[zone_id];
      if (!leader || leader.user_email === userEmail) return null;
      const uScore = userScores[zone_id] || 0;
      const gap = leader.species_count - uScore;
      const conquerable = uScore > leader.species_count;
      if (!conquerable && gap > 5) return null;
      return { zone_id, leader, uScore, gap: conquerable ? 0 : gap, conquerable };
    })
    .filter(Boolean)
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 4);

  if (targets.length === 0) return null;

  return (
    <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--v1v-blue-border)", background: "var(--v1v-bg-overlay)" }}>
      <div className="flex items-center gap-2 mb-2">
        <Zap className="w-3 h-3" style={{ color: "var(--v1v-green)" }} />
        <span className="text-[8px] font-black uppercase tracking-[0.5em]" style={{ color: "rgba(57,184,20,0.6)" }}>
          Objectifs à portée
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {targets.map(({ zone_id, leader, uScore, gap, conquerable }) => (
          <button
            key={zone_id}
            onClick={() => onZoneTap(zone_id)}
            className="flex-shrink-0 px-3 py-2 flex flex-col gap-0.5 min-w-[100px] text-left"
            style={{
              background: conquerable ? "rgba(57,184,20,0.1)" : "rgba(200,150,10,0.08)",
              border: `1px solid ${conquerable ? "rgba(57,184,20,0.4)" : "rgba(200,150,10,0.3)"}`,
            }}
          >
            <div className="flex items-center gap-1">
              {conquerable
                ? <Crown className="w-2.5 h-2.5" style={{ color: "var(--v1v-green)" }} />
                : <Target className="w-2.5 h-2.5" style={{ color: "var(--v1v-amber)" }} />
              }
              <span className="text-[7px] font-black uppercase tracking-widest" style={{ color: conquerable ? "var(--v1v-green)" : "var(--v1v-amber)" }}>
                {conquerable ? "Prenable" : `−${gap} espèce${gap > 1 ? "s" : ""}`}
              </span>
            </div>
            <span className="text-[9px] font-black uppercase" style={{ color: "var(--v1v-fg-muted)" }}>
              {leader.display_name.length > 9 ? leader.display_name.slice(0, 8) + "…" : leader.display_name}
            </span>
            <div className="h-0.5 w-full mt-0.5" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-0.5"
                style={{
                  width: `${Math.min(100, leader.species_count > 0 ? Math.round((uScore / (leader.species_count + 1)) * 100) : 100)}%`,
                  background: conquerable ? "var(--v1v-green)" : "var(--v1v-amber)",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}