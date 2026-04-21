import { format } from "date-fns";
import { fr } from "date-fns/locale";

const G = "var(--v1v-green)";
const GDB = "var(--v1v-green-bg)";

const CAT_LABEL = {
  plant: "Plantes", bird: "Oiseaux", rock: "Minéraux",
  fungus: "Champignons", tree: "Arbres", insect: "Insectes", arachnid: "Araignées",
};

const CAT_EMOJI = {
  plant: "🌿", bird: "🐦", rock: "🪨",
  fungus: "🍄", tree: "🌳", insect: "🦋", arachnid: "🕷️",
};

function computeStreak(discoveries) {
  if (!discoveries.length) return 0;
  const dates = [...new Set(
    discoveries
      .map(d => d.discovered_date || d.created_date?.split("T")[0])
      .filter(Boolean)
  )].sort().reverse();

  let streak = 0;
  const today = new Date().toISOString().split("T")[0];
  let cursor = today;

  for (const date of dates) {
    if (date === cursor) {
      streak++;
      const d = new Date(cursor);
      d.setDate(d.getDate() - 1);
      cursor = d.toISOString().split("T")[0];
    } else if (date < cursor) {
      break;
    }
  }
  return streak;
}

export default function DetailedStats({ discoveries }) {
  if (!discoveries.length) return null;

  // Unique species
  const uniqueSpecies = new Set(discoveries.map(d => d.common_name?.toLowerCase()).filter(Boolean)).size;

  // Countries explored
  const countriesExplored = new Set(discoveries.map(d => d.country_code).filter(Boolean)).size;

  // (Rarity is visual only — not tracked in stats)

  // Category breakdown
  const catCount = {};
  for (const d of discoveries) {
    const c = d.category || "plant";
    catCount[c] = (catCount[c] || 0) + 1;
  }
  const catEntries = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .filter(([, n]) => n > 0);
  const maxCat = catEntries[0]?.[1] || 1;

  // Best day of week
  // Most scanned species
  const speciesCount = {};
  for (const d of discoveries) {
    if (d.common_name) speciesCount[d.common_name] = (speciesCount[d.common_name] || 0) + 1;
  }
  const topSpecies = Object.entries(speciesCount).sort((a, b) => b[1] - a[1])[0];
  const topCat = catEntries[0];

  // First discovery
  const sorted = [...discoveries].sort((a, b) =>
    new Date(a.discovered_date || a.created_date) - new Date(b.discovered_date || b.created_date)
  );
  const firstDate = sorted[0]?.discovered_date || sorted[0]?.created_date?.split("T")[0];

  // Last discovery
  // Streak
  const streak = computeStreak(discoveries);

  const bottomStats = [
    {
      label: "Espèce favorite",
      value: topSpecies?.[0] || "—",
      sub: topSpecies ? `${topSpecies[1]} scan${topSpecies[1] > 1 ? "s" : ""}` : "",
    },
    {
      label: "Catégorie dominante",
      value: topCat ? (CAT_LABEL[topCat[0]] || topCat[0]) : "—",
      sub: topCat ? `${topCat[1]} spécimens` : "",
    },
    {
      label: "Première découverte",
      value: firstDate ? format(new Date(firstDate), "d MMM yyyy", { locale: fr }) : "—",
      sub: "",
    },
    {
      label: "Streak actuel",
      value: streak > 0 ? `${streak} jour${streak > 1 ? "s" : ""}` : "0 jour",
      sub: streak >= 3 ? "🔥 En feu !" : streak === 0 ? "Scanne aujourd'hui !" : "",
    },
  ];

  return (
    <div className="relative z-10 px-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1" style={{ background: "rgba(45,122,31,0.15)" }} />
        <p className="text-xs font-black tracking-[0.4em] uppercase" style={{ color: "rgba(45,122,31,0.5)" }}>
          Stats détaillées
        </p>
        <div className="h-px flex-1" style={{ background: "rgba(45,122,31,0.15)" }} />
      </div>

      {/* Top 3 big metrics */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-3 text-center" style={{ background: GDB, border: "1px solid rgba(45,122,31,0.15)" }}>
          <p className="text-2xl font-black leading-tight" style={{ color: G }}>{uniqueSpecies}</p>
          <p className="text-[8px] tracking-[0.25em] uppercase mt-0.5 font-black" style={{ color: "rgba(45,122,31,0.5)" }}>Espèces uniques</p>
        </div>
        <div className="p-3 text-center" style={{ background: GDB, border: "1px solid rgba(45,122,31,0.15)" }}>
          <p className="text-2xl font-black leading-tight" style={{ color: G }}>{countriesExplored || "—"}</p>
          <p className="text-[8px] tracking-[0.25em] uppercase mt-0.5 font-black" style={{ color: "rgba(45,122,31,0.5)" }}>Pays</p>
        </div>

      </div>

      {/* Category breakdown */}
      {catEntries.length > 0 && (
        <div className="mb-4 p-3 space-y-2.5" style={{ background: GDB, border: "1px solid rgba(45,122,31,0.12)" }}>
          <p className="text-[8px] font-black tracking-[0.4em] uppercase mb-3" style={{ color: "rgba(45,122,31,0.5)" }}>
            Répartition par catégorie
          </p>
          {catEntries.map(([cat, count]) => {
            const pct = Math.round((count / maxCat) * 100);
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--v1v-fg)" }}>
                    {CAT_EMOJI[cat] || "🌿"} {CAT_LABEL[cat] || cat}
                  </span>
                  <span className="text-[9px] font-black" style={{ color: G }}>{count}</span>
                </div>
                <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "rgba(45,122,31,0.12)" }}>
                  <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: G }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom 2x2 grid */}
      <div className="grid grid-cols-2 gap-2">
        {bottomStats.map(s => (
          <div
            key={s.label}
            className="p-3"
            style={{ background: GDB, border: "1px solid rgba(45,122,31,0.15)" }}
          >
            <p className="text-[8px] tracking-[0.35em] uppercase font-black mb-1.5" style={{ color: "rgba(45,122,31,0.45)" }}>
              {s.label}
            </p>
            <p className="text-sm font-black uppercase leading-tight" style={{ color: "var(--v1v-fg)" }}>
              {s.value}
            </p>
            {s.sub && (
              <p className="text-[8px] mt-0.5" style={{ color: "rgba(45,122,31,0.5)" }}>{s.sub}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
