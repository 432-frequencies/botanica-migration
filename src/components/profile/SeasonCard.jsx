import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { Calendar, Leaf, History } from "lucide-react";

const G = "var(--v1v-green)";

function daysLeft(endDate) {
  const end = new Date(endDate);
  const now = new Date();
  end.setHours(23, 59, 59, 999);
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

function seasonProgress(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  const total = end - start;
  const elapsed = now - start;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

export default function SeasonCard({ userEmail, discoveries }) {
  const [season, setSeason] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!userEmail) return;
    Promise.all([
      supabase.from('seasons').select('*').eq('is_active', true).limit(1),
      supabase.from('season_history').select('*').eq('user_email', userEmail).order('created_at', { ascending: false }).limit(10),
    ]).then(([seasonRes, histRes]) => {
      setSeason(seasonRes.data?.[0] || null);
      setHistory(histRes.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userEmail]);

  if (loading) return (
    <div className="loading-skeleton" style={{ height: 80, borderRadius: 12, border: "1px solid var(--v1v-green-ghost)" }} />
  );

  if (!season) return null;

  // Seasonal unique species (discovered during season dates)
  const seasonStart = season.start_date;
  const seasonDiscoveries = discoveries.filter(d => d.discovered_date && d.discovered_date >= seasonStart);
  const seasonUnique = new Set(seasonDiscoveries.map(d => (d.common_name || "").toLowerCase())).size;
  const seasonTotal = seasonDiscoveries.length;
  const remaining = daysLeft(season.end_date);
  const elapsed = seasonProgress(season.start_date, season.end_date);

  return (
    <div style={{ border: "1px solid rgba(57,184,20,0.3)", background: "rgba(57,184,20,0.05)", borderRadius: 12 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" style={{ color: G }} />
          <span className="text-[8px] font-black uppercase tracking-[0.5em]" style={{ color: "rgba(57,184,20,0.6)" }}>
            Saison en cours
          </span>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-1 transition-opacity hover:opacity-60"
          >
            <History className="w-3 h-3" style={{ color: "rgba(57,184,20,0.5)" }} />
            <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(57,184,20,0.5)" }}>Historique</span>
          </button>
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-base font-black uppercase tracking-wider leading-tight" style={{ color: G }}>
              {season.name}
            </p>
            <p className="text-[9px] mt-0.5" style={{ color: "rgba(57,184,20,0.5)" }}>
              {remaining > 0 ? `${remaining} jours restants` : "Terminée"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black" style={{ color: G }}>{seasonUnique}</p>
            <p className="text-[8px] uppercase tracking-[0.3em]" style={{ color: "rgba(57,184,20,0.45)" }}>espèces</p>
          </div>
        </div>

        {/* Season time progress */}
        <div className="mb-2">
          <div className="flex justify-between mb-1">
            <span className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(57,184,20,0.4)" }}>
              {season.start_date}
            </span>
            <span className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(57,184,20,0.4)" }}>
              {season.end_date}
            </span>
          </div>
          <div style={{ height: 3, background: "rgba(57,184,20,0.12)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${elapsed}%`, background: G, borderRadius: 3, transition: "width 0.7s ease" }} />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1">
            <Leaf className="w-3 h-3" style={{ color: "rgba(57,184,20,0.5)" }} />
            <span className="text-[9px]" style={{ color: "rgba(57,184,20,0.6)" }}>{seasonTotal} observations</span>
          </div>
        </div>
      </div>

      {/* Season history */}
      {showHistory && history.length > 0 && (
        <div style={{ borderTop: "1px solid var(--v1v-green-ghost)" }}>
          {history.map(h => (
            <div key={h.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--v1v-green-ghost)" }}>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--v1v-fg)" }}>{h.season_name}</p>
                {h.title_earned && (
                  <p className="text-[9px] font-black mt-0.5" style={{ color: "rgba(200,150,10,0.8)" }}>✦ {h.title_earned}</p>
                )}
                <p className="text-[9px]" style={{ color: "rgba(57,184,20,0.5)" }}>{h.start_date} → {h.end_date}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-black" style={{ color: "var(--v1v-fg)" }}>{h.unique_species}</p>
                <p className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(57,184,20,0.4)" }}>espèces</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}