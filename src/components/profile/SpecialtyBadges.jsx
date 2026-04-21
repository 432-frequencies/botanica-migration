import { useState } from "react";

const SPECIALTIES = [
  {
    key: "botaniste",
    name: "Botaniste",
    description: "Plantes identifiées",
    field: "plant",
    levels: [
      { name: "Novice",         min: 5  },
      { name: "Botaniste",      min: 15 },
      { name: "Phytologue",     min: 30 },
      { name: "Expert Végétal", min: 75 },
    ]
  },
  {
    key: "mycologue",
    name: "Mycologue",
    description: "Champignons identifiés",
    field: "fungus",
    levels: [
      { name: "Cueilleur",       min: 3  },
      { name: "Mycologue",       min: 10 },
      { name: "Expert Fongique", min: 25 },
    ]
  },
  {
    key: "ornithologue",
    name: "Ornithologue",
    description: "Oiseaux observés",
    field: "bird",
    levels: [
      { name: "Observateur",      min: 3  },
      { name: "Ornithologue",     min: 10 },
      { name: "Expert Aviaire",   min: 30 },
    ]
  },
  {
    key: "explorateur",
    name: "Explorateur",
    description: "Espèces comestibles",
    field: "edible",
    levels: [
      { name: "Cueilleur Scout", min: 5  },
      { name: "Cueilleur",       min: 15 },
      { name: "Expert Cueillette",min: 40 },
    ]
  },
];

export function getSpecialtyLevel(specialty, count) {
  return [...specialty.levels].reverse().find(l => count >= l.min) || null;
}
export function getNextSpecialtyLevel(specialty, count) {
  return specialty.levels.find(l => count < l.min) || null;
}
export { SPECIALTIES };

export default function SpecialtyBadges({ stats }) {
  const [expanded, setExpanded] = useState(null);

  const countByField = {
    plant:  (stats?.byCategory?.plant  || 0) + (stats?.byCategory?.tree || 0),
    fungus: (stats?.byCategory?.fungus || 0),
    bird:   (stats?.byCategory?.bird   || 0),
    edible: stats?.edible || 0,
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-4 h-px" style={{ background: "var(--v1v-blue-border)" }} />
        <p className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: "var(--v1v-fg-faint)" }}>
          Spécialisations
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {SPECIALTIES.map(sp => {
          const count = countByField[sp.field] || 0;
          const currentLevel = getSpecialtyLevel(sp, count);
          const nextLevel = getNextSpecialtyLevel(sp, count);
          const isExpanded = expanded === sp.key;
          const progress = nextLevel ? (count / nextLevel.min) * 100 : 100;

          return (
            <div
              key={sp.key}
              onClick={() => setExpanded(isExpanded ? null : sp.key)}
              className={`p-3 cursor-pointer transition-all ${isExpanded ? "col-span-2" : ""}`}
              style={{ border: "1px solid var(--v1v-blue-border)", background: "var(--v1v-blue-bg)" }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: "var(--v1v-fg)" }}>{sp.name}</p>
                  <p className="text-[8px] uppercase tracking-wider mt-0.5" style={{ color: "var(--v1v-blue-muted)" }}>
                    {currentLevel ? currentLevel.name : "Non débloqué"}
                  </p>
                </div>
                <p className="text-2xl font-black flex-shrink-0 number-display" style={{ color: "var(--v1v-blue)" }}>{count}</p>
              </div>

              <div className="h-px w-full mb-1" style={{ background: "var(--v1v-blue-border)" }}>
                <div
                  className="h-px transition-all"
                  style={{ width: `${Math.min(100, progress)}%`, background: progress >= 100 ? "var(--v1v-blue)" : "var(--v1v-blue-muted)" }}
                />
              </div>
              {nextLevel && (
                <p className="text-[8px] tracking-widest uppercase" style={{ color: "var(--v1v-blue-muted)" }}>
                  {count}/{nextLevel.min} — {nextLevel.name}
                </p>
              )}

              {isExpanded && (
                <div className="mt-3 pt-3 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  {sp.levels.map(lvl => {
                    const unlocked = count >= lvl.min;
                    return (
                      <div
                        key={lvl.name}
                        className="flex items-center justify-between"
                        style={{ opacity: unlocked ? 1 : 0.3 }}
                      >
                        <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--v1v-fg)" }}>{lvl.name}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] tracking-widest uppercase" style={{ color: "var(--v1v-blue-muted)" }}>
                            {lvl.min} relevés
                          </p>
                          {unlocked && (
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--v1v-blue)" }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
