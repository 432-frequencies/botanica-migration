const RANK_ROMAN = {
  "Débutant": "I",
  "Botaniste Apprenti": "II",
  "Botaniste Bronze": "III",
  "Herbaliste": "IV",
  "Botaniste Expert": "V",
  "Maître Botaniste": "VI",
};

export default function RankBadge({ rank, totalPlants, totalPoints, isPro }) {
  const roman = RANK_ROMAN[rank] || "I";

  return (
    <div className="p-4" style={{ border: "1px solid rgba(232,224,208,0.12)" }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[8px] tracking-[0.5em] uppercase mb-0.5" style={{ color: "rgba(232,224,208,0.35)" }}>Current Rank</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black" style={{ color: "#E8E0D0", fontVariantNumeric: "tabular-nums" }}>{roman}</span>
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(232,224,208,0.6)" }}>{rank}</span>
          </div>
        </div>
        <div className="text-right">
          {isPro && (
            <div className="text-[8px] font-black tracking-[0.3em] px-2 py-0.5 mb-2 inline-block" style={{ background: "#E8E0D0", color: "#0A0A0A" }}>
              ELITE
            </div>
          )}
          <p className="text-3xl font-black" style={{ color: "#E8E0D0" }}>{totalPoints?.toLocaleString()}</p>
          <p className="text-[8px] tracking-[0.4em] uppercase" style={{ color: "rgba(232,224,208,0.35)" }}>XP Points</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-px flex-1" style={{ background: "rgba(232,224,208,0.1)" }} />
        <p className="text-[9px] font-black tracking-[0.3em] uppercase" style={{ color: "rgba(232,224,208,0.4)" }}>
          {totalPlants} drop{totalPlants !== 1 ? "s" : ""} claimed
        </p>
        <div className="h-px flex-1" style={{ background: "rgba(232,224,208,0.1)" }} />
      </div>
    </div>
  );
}