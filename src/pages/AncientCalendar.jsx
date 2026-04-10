import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { Sun } from "lucide-react";

const MOON_PHASES = {
  new_moon: { emoji: "🌑", label: "New Moon" },
  waxing_crescent: { emoji: "🌒", label: "Waxing Crescent" },
  first_quarter: { emoji: "🌓", label: "First Quarter" },
  waxing_gibbous: { emoji: "🌔", label: "Waxing Gibbous" },
  full_moon: { emoji: "🌕", label: "Full Moon" },
  waning_gibbous: { emoji: "🌖", label: "Waning Gibbous" },
  last_quarter: { emoji: "🌗", label: "Last Quarter" },
  waning_crescent: { emoji: "🌘", label: "Waning Crescent" },
};

const SOLAR_ICONS = {
  solstice_summer: "☀️",
  solstice_winter: "❄️",
  equinox_spring: "🌸",
  equinox_fall: "🍂",
};

function SeasonalWheel({ dayOfYear }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 90;
  const innerR = 60;
  const angle = (dayOfYear / 365) * 360 - 90;
  const rad = (angle * Math.PI) / 180;
  const dotX = cx + (outerR + 12) * Math.cos(rad);
  const dotY = cy + (outerR + 12) * Math.sin(rad);

  const seasons = [
    { color: "#1E90FF", opacity: 0.7, start: -90, label: "❄️", day: 355 },
    { color: "#00C851", opacity: 0.7, start: 0, label: "🌸", day: 80 },
    { color: "#FFD700", opacity: 0.7, start: 90, label: "☀️", day: 172 },
    { color: "#FF6B35", opacity: 0.7, start: 180, label: "🍂", day: 264 },
  ];

  const arc = (startDeg, endDeg, r) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size}>
        {seasons.map((s, i) => {
          const start = s.start;
          const end = s.start + 90;
          const midAngle = start + 45;
          const midRad = (midAngle * Math.PI) / 180;
          const labelR = (outerR + innerR) / 2;
          const lx = cx + labelR * Math.cos(midRad);
          const ly = cy + labelR * Math.sin(midRad);

          const toRad = (d) => (d * Math.PI) / 180;
          const x1o = cx + outerR * Math.cos(toRad(start));
          const y1o = cy + outerR * Math.sin(toRad(start));
          const x2o = cx + outerR * Math.cos(toRad(end));
          const y2o = cy + outerR * Math.sin(toRad(end));
          const x1i = cx + innerR * Math.cos(toRad(end));
          const y1i = cy + innerR * Math.sin(toRad(end));
          const x2i = cx + innerR * Math.cos(toRad(start));
          const y2i = cy + innerR * Math.sin(toRad(start));

          return (
            <g key={i}>
              <path
                d={`M ${x1o} ${y1o} A ${outerR} ${outerR} 0 0 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 0 0 ${x2i} ${y2i} Z`}
                fill={s.color}
                opacity={s.opacity * 0.5}
                stroke={s.color}
                strokeWidth="0.5"
                strokeOpacity={0.6}
              />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="14">{s.label}</text>
            </g>
          );
        })}

        {/* Current day dot */}
        <circle cx={dotX} cy={dotY} r="7" fill="#FFD700" style={{ filter: "drop-shadow(0 0 6px #FFD700)" }} />

        {/* Center */}
        <circle cx={cx} cy={cy} r={innerR - 4} fill="rgba(5,10,5,0.9)" stroke="rgba(57,255,20,0.2)" strokeWidth="1" />
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fill="rgba(57,255,20,0.8)" fontWeight="900" fontFamily="monospace">
          DAY {dayOfYear}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="rgba(57,255,20,0.4)" fontFamily="monospace">
          {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </text>
      </svg>
    </div>
  );
}

export default function AncientCalendar() {
  const [lunarData, setLunarData] = useState(null);
  const [nextSolar, setNextSolar] = useState(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  const todayStr = now.toISOString().split("T")[0];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // TODO: migrer getAncientCalendarData vers une API route Vercel avec ephemeris
      // Pour l'instant : requêtes directes Supabase (tables à peupler manuellement)
      const [lunarRes, solarRes] = await Promise.all([
        supabase.from('lunar_calendar').select('*').eq('date', todayStr).single(),
        supabase.from('solar_events').select('*').order('date').limit(50),
      ]);
      setLunarData(lunarRes.data || null);
      const upcoming = (solarRes.data || []).filter((s) => s.date >= todayStr);
      setNextSolar(upcoming[0] || null);
    } catch (e) {
      console.warn('[AncientCalendar] data unavailable', e.message);
    }
    setLoading(false);
  };

  const phase = lunarData ? MOON_PHASES[lunarData.phase || lunarData.moon_phase] : null;

  return (
    <div className="min-h-screen" style={{ background: "#050A05", color: "#E8E0D0" }}>
      {/* Scanlines */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(57,255,20,0.012) 2px, rgba(57,255,20,0.012) 4px)",
      }} />

      <div className="relative z-10">
        {/* Header */}
        <div className="px-5 pt-12 pb-4" style={{ background: "rgba(5,10,5,0.97)", borderBottom: "1px solid rgba(57,255,20,0.1)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Sun className="w-3 h-3" style={{ color: "#FFD700" }} />
            <p className="text-[8px] tracking-[0.6em] uppercase font-black" style={{ color: "rgba(57,255,20,0.5)" }}>Ancient Calendar</p>
          </div>
          <h1 className="text-3xl font-black uppercase leading-none" style={{ color: "#E8E0D0" }}>
            Ancient<br />Calendar
          </h1>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Current Date Card */}
          <div className="p-4" style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.25)" }}>
            <p className="text-[8px] tracking-[0.5em] uppercase mb-2" style={{ color: "rgba(255,215,0,0.6)" }}>Current Date</p>
            <p className="text-2xl font-black uppercase" style={{ color: "#FFD700" }}>
              {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="text-sm mt-1 font-black" style={{ color: "rgba(255,215,0,0.5)" }}>Day {dayOfYear} of {now.getFullYear()}</p>
          </div>

          {/* Seasonal Wheel */}
          <div className="p-4 flex flex-col items-center" style={{ background: "rgba(57,255,20,0.03)", border: "1px solid rgba(57,255,20,0.1)" }}>
            <p className="text-[8px] tracking-[0.5em] uppercase mb-4" style={{ color: "rgba(57,255,20,0.4)" }}>Seasonal Cycle</p>
            <SeasonalWheel dayOfYear={dayOfYear} />
          </div>

          {/* Moon Phase Card */}
          <div className="p-4" style={{ background: "rgba(100,80,200,0.08)", border: "1px solid rgba(100,80,200,0.3)" }}>
            <p className="text-[8px] tracking-[0.5em] uppercase mb-3" style={{ color: "rgba(150,130,255,0.7)" }}>Moon Phase</p>
            {loading ? (
              <div className="h-16 flex items-center justify-center">
                <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "#9B7FFF", borderTopColor: "transparent" }} />
              </div>
            ) : phase ? (
              <div>
                <div className="flex items-center gap-4 mb-3">
                  <span className="text-5xl">{phase.emoji}</span>
                  <div>
                    <p className="text-lg font-black uppercase" style={{ color: "#E8E0D0" }}>{phase.label}</p>
                    {lunarData.illumination_percent != null && (
                      <p className="text-sm" style={{ color: "rgba(150,130,255,0.7)" }}>{lunarData.illumination_percent}% illuminated</p>
                    )}
                    {lunarData.moon_age != null && (
                      <p className="text-xs" style={{ color: "rgba(150,130,255,0.5)" }}>Day {Math.round(lunarData.moon_age)} of lunar cycle</p>
                    )}
                  </div>
                </div>
                {lunarData.gardening_advice && (
                  <p className="text-sm mb-3" style={{ color: "rgba(232,224,208,0.6)", lineHeight: 1.6 }}>{lunarData.gardening_advice}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {lunarData.best_for_planting?.map((p, i) => (
                    <span key={i} className="px-2 py-1 text-[8px] font-black uppercase tracking-wider rounded-full" style={{ background: "rgba(0,200,80,0.15)", border: "1px solid rgba(0,200,80,0.3)", color: "#00C851" }}>
                      🌱 {p}
                    </span>
                  ))}
                  {lunarData.best_for_harvesting?.map((h, i) => (
                    <span key={i} className="px-2 py-1 text-[8px] font-black uppercase tracking-wider rounded-full" style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700" }}>
                      🌾 {h}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-center py-4" style={{ color: "rgba(150,130,255,0.4)" }}>No lunar data for today. Add entries in the database.</p>
            )}
          </div>

          {/* Next Solar Event */}
          {nextSolar && (
            <div className="p-4" style={{ background: "rgba(255,50,50,0.06)", border: "1px solid rgba(255,100,50,0.3)" }}>
              <p className="text-[8px] tracking-[0.5em] uppercase mb-3" style={{ color: "rgba(255,150,50,0.7)" }}>Next Solar Event</p>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-3xl">{SOLAR_ICONS[nextSolar.event_type] || "🌞"}</span>
                <div>
                  <p className="text-base font-black uppercase" style={{ color: "#E8E0D0" }}>{nextSolar.title}</p>
                  <p className="text-sm" style={{ color: "rgba(255,150,50,0.8)" }}>
                    {new Date(nextSolar.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
              {nextSolar.description && (
                <p className="text-sm mb-3" style={{ color: "rgba(232,224,208,0.6)", lineHeight: 1.6 }}>{nextSolar.description}</p>
              )}
              {nextSolar.ancient_celebrations?.length > 0 && (
                <div className="space-y-2">
                  {nextSolar.ancient_celebrations.map((cel, i) => (
                    <div key={i} className="p-2" style={{ background: "rgba(255,100,50,0.05)", border: "1px solid rgba(255,100,50,0.15)" }}>
                      <p className="text-[9px] font-black uppercase" style={{ color: "rgba(255,150,50,0.8)" }}>{cel.culture} — {cel.celebration_name}</p>
                      {cel.description && <p className="text-[9px] mt-0.5" style={{ color: "rgba(232,224,208,0.5)" }}>{cel.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-24" />
      </div>
    </div>
  );
}