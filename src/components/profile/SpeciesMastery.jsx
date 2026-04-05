const LEVEL_THRESHOLDS = [1, 3, 7, 15];

function getLevel(count) {
  let lvl = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (count >= LEVEL_THRESHOLDS[i]) lvl = i + 1;
  }
  return lvl;
}

const G = "var(--v1v-green)";
const GDB = "var(--v1v-green-bg)";

export default function SpeciesMastery({ discoveries }) {
  const speciesMap = {};
  for (const d of discoveries) {
    const key = d.common_name?.toLowerCase();
    if (!key) continue;
    if (!speciesMap[key]) speciesMap[key] = { name: d.common_name, count: 0, category: d.category };
    speciesMap[key].count++;
  }

  const allSpecies = Object.values(speciesMap).map(s => ({ ...s, level: getLevel(s.count) }));
  const mastered = allSpecies.filter(s => s.level >= 2).sort((a, b) => b.level - a.level || b.count - a.count);
  const inProgress = allSpecies.filter(s => s.level === 1).sort((a, b) => b.count - a.count);

  return (
    <div className="relative z-10 px-5 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1" style={{ background: "rgba(45,122,31,0.15)" }} />
        <p className="text-xs font-black tracking-[0.4em] uppercase" style={{ color: "rgba(45,122,31,0.5)" }}>
          Maîtrise des espèces
        </p>
        <div className="h-px flex-1" style={{ background: "rgba(45,122,31,0.15)" }} />
      </div>

      {mastered.length === 0 && inProgress.length === 0 ? (
        <div className="p-5 text-center" style={{ border: "1px solid rgba(45,122,31,0.12)" }}>
          <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(45,122,31,0.3)" }}>
            Scanne 3× la même espèce pour progresser
          </p>
        </div>
      ) : (
        <>
          {mastered.length > 0 && (
            <div className="space-y-2 mb-4">
              {mastered.map(s => (
                <div
                  key={s.name}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ background: GDB, border: "1px solid rgba(45,122,31,0.15)" }}
                >
                  <div>
                    <p className="text-xs font-black uppercase" style={{ color: "var(--v1v-fg)" }}>{s.name}</p>
                    <p className="text-[8px] tracking-wider uppercase mt-0.5" style={{ color: "rgba(45,122,31,0.4)" }}>
                      {s.count} scan{s.count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{"⭐".repeat(s.level)}</span>
                    <span className="text-[8px] font-black uppercase tracking-widest ml-1" style={{ color: "rgba(45,122,31,0.45)" }}>
                      Niv.{s.level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {inProgress.length > 0 && (
            <>
              <p className="text-[9px] font-black tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(45,122,31,0.4)" }}>
                En cours de maîtrise
              </p>
              <div className="space-y-2">
                {inProgress.map(s => {
                  const pct = Math.round((s.count / 3) * 100);
                  return (
                    <div
                      key={s.name}
                      className="px-4 py-3"
                      style={{ background: "rgba(45,122,31,0.04)", border: "1px solid rgba(45,122,31,0.1)" }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-black uppercase" style={{ color: "var(--v1v-fg-muted)" }}>{s.name}</p>
                        <span className="text-[8px] font-black" style={{ color: "rgba(45,122,31,0.4)" }}>
                          {s.count}/3
                        </span>
                      </div>
                      <div className="h-0.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(45,122,31,0.12)" }}>
                        <div
                          className="h-0.5 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: "rgba(45,122,31,0.5)" }}
                        />
                      </div>
                      <p className="text-[7px] tracking-wider uppercase mt-1" style={{ color: "rgba(45,122,31,0.3)" }}>
                        {3 - s.count} scan{3 - s.count > 1 ? "s" : ""} pour niveau 2
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}