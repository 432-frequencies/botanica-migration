import { useState, useEffect } from "react";
import { X, Star } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import confetti from "canvas-confetti";

const G = "#39FF14";

const ZODIAC_GUIDE = {
  "Leo": {
    dates: "23 juil – 22 août",
    element: "Feu ♦ Fixe",
    planet: "Soleil",
    traits: ["Magnétisme naturel", "Besoin de reconnaissance", "Générosité excessive", "Ego hypersensible", "Leadership instinctif"],
    moods: ["Euphorique quand admiré", "Blessé quand ignoré", "Créatif sous pression", "Autoritaire sous stress"],
    shadow: "Arrogance masquant une profonde insécurité",
    gift: "Illuminer les autres par sa simple présence",
  },
  "Gemini": {
    dates: "21 mai – 20 juin",
    element: "Air ♦ Mutable",
    planet: "Mercure",
    traits: ["Esprit vif et adaptable", "Dualité intérieure permanente", "Curiosité insatiable", "Difficulté à s'engager", "Don de la communication"],
    moods: ["Brillant quand stimulé", "Agité sans nouveauté", "Charmeur en société", "Anxieux dans le silence"],
    shadow: "Superficialité pour fuir la profondeur émotionnelle",
    gift: "Tisser des ponts entre les idées et les êtres",
  },
  "Taurus": {
    dates: "20 avr – 20 mai",
    element: "Terre ♦ Fixe",
    planet: "Vénus",
    traits: ["Sensualité profonde", "Attachement aux biens matériels", "Loyauté absolue", "Résistance au changement", "Patience à toute épreuve"],
    moods: ["Apaisé dans la nature", "Têtu face à la contrainte", "Généreux avec ses proches", "Possessif sous l'insécurité"],
    shadow: "Matérialisme comme compensation d'un vide affectif",
    gift: "Ancrer le divin dans la matière, construire dans la durée",
  },
  "Scorpius": {
    dates: "23 oct – 21 nov",
    element: "Eau ♦ Fixe",
    planet: "Mars / Pluton",
    traits: ["Intensité émotionnelle extrême", "Intuition pénétrante", "Capacité de transformation radicale", "Méfiance instinctive", "Désir de vérité absolue"],
    moods: ["Magnétique quand en confiance", "Vengeur si trahi", "Passionné jusqu'à l'obsession", "Régénéré après la crise"],
    shadow: "Manipulation et contrôle pour compenser la peur de la vulnérabilité",
    gift: "Mourir et renaître — guider les autres à travers leurs ténèbres",
  },
};

const CONSTELLATION_TO_ZODIAC = {
  "Leo": "Leo",
  "Gemini": "Gemini",
  "Taurus": "Taurus",
  "Scorpius": "Scorpius",
};

const TAB_GUIDE = "guide";
const TAB_NAV = "navigation";
const TAB_MYTH = "mythology";

function StarPattern({ stars, svgPath }) {
  if (svgPath) return (
    <svg viewBox="0 0 100 100" className="w-full h-40">
      <rect width="100" height="100" fill="#000510" />
      <path d={svgPath} stroke="rgba(57,255,20,0.5)" strokeWidth="0.5" fill="none" />
      {stars?.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={Math.max(1, 3 - (s.magnitude || 3))} fill={s.color || "white"} />
      ))}
    </svg>
  );
  if (stars?.length) return (
    <svg viewBox="0 0 100 100" className="w-full h-40">
      <rect width="100" height="100" fill="#000510" />
      {stars.map((s, i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y} r={Math.max(1, 3 - (s.magnitude || 3) * 0.5)} fill={s.color || "white"} />
          {i < stars.length - 1 && (
            <line x1={s.x} y1={s.y} x2={stars[i + 1].x} y2={stars[i + 1].y} stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
          )}
          <text x={s.x + 2} y={s.y - 2} fontSize="4" fill="rgba(255,255,255,0.5)">{s.name}</text>
        </g>
      ))}
    </svg>
  );
  return (
    <div className="w-full h-40 flex items-center justify-center text-5xl" style={{ background: "#000510" }}>
      ✦
    </div>
  );
}

export default function ConstellationModal({ constellation: c, isUnlocked, onClose, onUnlock, userLocation: _userLocation }) {
  const [tab, setTab] = useState(TAB_GUIDE);
  const [loading, setLoading] = useState(false);
  const [chartUrl, _setChartUrl] = useState(null);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    if (tab === TAB_NAV && !chartUrl && c) {
      fetchStarChart();
    }
  }, [tab]);

  const fetchStarChart = async () => {
    setChartLoading(true);
    // TODO: implémenter via Vercel API route /api/constellation-chart (AstronomyAPI)
    // Paramètres : constellation_id, latitude, longitude, style
    setChartLoading(false);
  };

  const handleAddToKnowledge = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('user_knowledge_progress').insert({
        user_email: user.email,
        knowledge_id: c.id,
        discovered_at: new Date().toISOString(),
        discovery_context: "constellation",
      });
      if (c.rarity === "legendary") {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
        confetti({ particleCount: 120, spread: 80, colors: ["#FFD700", "#9B7FFF", "#00D9FF"], origin: { y: 0.6 } });
        setTimeout(() => confetti({ particleCount: 60, spread: 120, colors: ["#FFD700", "#FF4500"], origin: { y: 0.7 } }), 300);
      } else if (c.rarity === "rare") {
        if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
        confetti({ particleCount: 60, spread: 60, colors: ["#9B7FFF", "#00D9FF", "#FFD700"], origin: { y: 0.6 } });
      } else {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
      onUnlock?.();
    } catch {}
    setLoading(false);
    onClose();
  };

  if (!c) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "#000510" }}>
      {/* Image header */}
      <div className="relative flex-shrink-0" style={{ height: "220px" }}>
        {c.image_url ? (
          <img src={c.image_url} className="w-full h-full object-cover" alt={c.name_french} />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #000510 0%, #0A0520 100%)" }}>
            <span className="text-8xl opacity-50">✦</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 30%, #000510 100%)" }} />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Title overlay */}
        <div className="absolute bottom-4 left-5">
          <h2 className="text-xl font-black uppercase" style={{ color: "#E8E0D0" }}>{c.name_french || c.name_latin}</h2>
          <p className="text-xs italic" style={{ color: "rgba(232,224,208,0.5)" }}>{c.name_latin}</p>
          {c.name_ancient && <p className="text-[9px] tracking-widest uppercase" style={{ color: "rgba(57,255,20,0.4)" }}>{c.name_ancient}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: "rgba(57,255,20,0.1)" }}>
        {[{ key: TAB_GUIDE, label: "Guide" }, { key: TAB_NAV, label: "Navigation" }, { key: TAB_MYTH, label: "Mythologie" }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-3 text-[9px] font-black uppercase tracking-widest transition-all"
            style={{
              color: tab === t.key ? G : "rgba(57,255,20,0.3)",
              borderBottom: tab === t.key ? `2px solid ${G}` : "2px solid transparent",
              background: "transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tab === TAB_GUIDE && (() => {
          const zodiacKey = CONSTELLATION_TO_ZODIAC[c.name_latin];
          const guide = zodiacKey ? ZODIAC_GUIDE[zodiacKey] : null;
          return (
            <div className="space-y-4">
              {c.story && <p className="text-sm leading-relaxed" style={{ color: "rgba(232,224,208,0.5)" }}>{c.story}</p>}

              {guide ? (
                <>
                  {/* Header signe */}
                  <div className="p-3 flex items-center justify-between" style={{ background: "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.2)" }}>
                    <div>
                      <p className="text-[8px] tracking-[0.4em] uppercase mb-0.5" style={{ color: "rgba(57,255,20,0.4)" }}>Signe Solaire</p>
                      <p className="text-base font-black uppercase" style={{ color: G }}>{c.name_french}</p>
                      <p className="text-[9px]" style={{ color: "rgba(232,224,208,0.4)" }}>{guide.dates}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] tracking-widest uppercase mb-0.5" style={{ color: "rgba(57,255,20,0.3)" }}>Planète</p>
                      <p className="text-xs font-black" style={{ color: "#E8E0D0" }}>{guide.planet}</p>
                      <p className="text-[8px] mt-1" style={{ color: "rgba(232,224,208,0.3)" }}>{guide.element}</p>
                    </div>
                  </div>

                  {/* Traits */}
                  <div>
                    <p className="text-[8px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(57,255,20,0.4)" }}>Traits Fondamentaux</p>
                    <ul className="space-y-1">
                      {guide.traits.map((t, i) => (
                        <li key={i} className="flex items-center gap-2 py-1.5 px-2" style={{ borderBottom: "1px solid rgba(57,255,20,0.06)" }}>
                          <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: G }} />
                          <span className="text-xs" style={{ color: "rgba(232,224,208,0.75)" }}>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Humeurs */}
                  <div>
                    <p className="text-[8px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(57,255,20,0.4)" }}>États Émotionnels</p>
                    <ul className="space-y-1">
                      {guide.moods.map((m, i) => (
                        <li key={i} className="flex items-start gap-2 py-1.5 px-2" style={{ borderBottom: "1px solid rgba(57,255,20,0.06)" }}>
                          <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#FFD700" }} />
                          <span className="text-xs italic" style={{ color: "rgba(232,224,208,0.65)" }}>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Ombre & Don */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3" style={{ background: "rgba(255,69,0,0.06)", border: "1px solid rgba(255,69,0,0.2)" }}>
                      <p className="text-[7px] tracking-widest uppercase mb-1.5" style={{ color: "rgba(255,100,50,0.6)" }}>Côté Ombre</p>
                      <p className="text-[10px] leading-snug" style={{ color: "rgba(232,224,208,0.6)" }}>{guide.shadow}</p>
                    </div>
                    <div className="p-3" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.15)" }}>
                      <p className="text-[7px] tracking-widest uppercase mb-1.5" style={{ color: "rgba(57,255,20,0.5)" }}>Don Supérieur</p>
                      <p className="text-[10px] leading-snug" style={{ color: "rgba(232,224,208,0.6)" }}>{guide.gift}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-[9px] tracking-widest uppercase" style={{ color: "rgba(57,255,20,0.3)" }}>Constellation non zodiacale</p>
                  <p className="text-xs mt-2" style={{ color: "rgba(232,224,208,0.3)" }}>Aucun guide de signe disponible.</p>
                </div>
              )}

              {/* Étoiles principales */}
              {c.main_stars?.length > 0 && (
                <div>
                  <p className="text-[8px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(57,255,20,0.4)" }}>Étoiles Principales</p>
                  <div className="space-y-1">
                    {c.main_stars.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 p-2" style={{ background: "rgba(57,255,20,0.03)", border: "1px solid rgba(57,255,20,0.08)" }}>
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color || "white", boxShadow: `0 0 5px ${s.color || "white"}` }} />
                        <span className="text-xs font-black" style={{ color: "#E8E0D0" }}>{s.name}</span>
                        <span className="text-[9px] ml-auto" style={{ color: "rgba(57,255,20,0.35)" }}>mag {s.magnitude}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {tab === TAB_NAV && (
          <div className="space-y-4">
            {/* Real star chart from AstronomyAPI */}
            {chartLoading ? (
              <div className="w-full h-48 flex items-center justify-center" style={{ background: "#000510", border: "1px solid rgba(57,255,20,0.1)" }}>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
                  <p className="text-[8px] tracking-widest uppercase" style={{ color: "rgba(57,255,20,0.4)" }}>Generating star chart…</p>
                </div>
              </div>
            ) : chartUrl ? (
              <div className="w-full overflow-hidden" style={{ border: "1px solid rgba(57,255,20,0.2)" }}>
                <img src={chartUrl} alt={`${c.name_latin} star chart`} className="w-full object-cover" />
                <p className="text-[7px] text-center py-1 tracking-widest uppercase" style={{ color: "rgba(57,255,20,0.3)", background: "rgba(0,5,16,0.8)" }}>
                  Live star chart · AstronomyAPI
                </p>
              </div>
            ) : (
              <StarPattern stars={c.main_stars} svgPath={c.star_pattern_svg} />
            )}
            {c.how_to_find && (
              <div>
                <p className="text-[8px] tracking-[0.4em] uppercase mb-2" style={{ color: "rgba(57,255,20,0.4)" }}>How to Find It</p>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(232,224,208,0.7)" }}>{c.how_to_find}</p>
              </div>
            )}
            {c.navigation_use && (
              <div className="p-3" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.12)" }}>
                <p className="text-[8px] tracking-widest uppercase mb-1.5" style={{ color: "rgba(57,255,20,0.5)" }}>Navigation Use</p>
                <p className="text-sm" style={{ color: "rgba(232,224,208,0.6)" }}>{c.navigation_use}</p>
              </div>
            )}
            {c.best_viewing_time && (
              <div className="flex items-center gap-3 p-3" style={{ border: "1px solid rgba(57,255,20,0.15)" }}>
                <Star className="w-4 h-4 flex-shrink-0" style={{ color: G }} />
                <div>
                  <p className="text-[8px] tracking-widest uppercase" style={{ color: "rgba(57,255,20,0.4)" }}>Best Viewing Time</p>
                  <p className="text-sm font-black" style={{ color: "#E8E0D0" }}>{c.best_viewing_time}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === TAB_MYTH && (
          <div className="space-y-4">
            {c.cultural_significance && (
              <div className="p-3" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.12)" }}>
                <p className="text-[8px] tracking-widest uppercase mb-2" style={{ color: "rgba(57,255,20,0.5)" }}>Signification Ésotérique</p>
                <ul className="space-y-1.5">
                  {c.cultural_significance.split(/[.—]/).map(s => s.trim()).filter(s => s.length > 10).map((point, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: G }} />
                      <span className="text-xs leading-snug" style={{ color: "rgba(232,224,208,0.7)" }}>{point.trim().replace(/^\-/, "").trim()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {[
              { label: "🏛️ Mythologie Grecque", content: c.mythology_greek },
              { label: "🏮 Mythologie Chinoise", content: c.mythology_chinese },
              { label: "🪃 Mythologie Aborigène", content: c.mythology_aboriginal },
              { label: "⚔️ Mythologie Romaine", content: c.mythology_roman },
            ].filter(m => m.content).map(m => (
              <div key={m.label} className="p-3" style={{ background: "rgba(57,255,20,0.03)", border: "1px solid rgba(57,255,20,0.1)" }}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: "rgba(232,224,208,0.5)" }}>{m.label}</p>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(232,224,208,0.7)" }}>{m.content}</p>
              </div>
            ))}
            {!c.cultural_significance && !c.mythology_greek && !c.mythology_chinese && !c.mythology_aboriginal && !c.mythology_roman && (
              <p className="text-center text-xs py-8" style={{ color: "rgba(57,255,20,0.3)" }}>Aucune donnée disponible.</p>
            )}
          </div>
        )}
        <div className="h-20" />
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-5 py-4" style={{ background: "rgba(0,5,16,0.95)", borderTop: "1px solid rgba(57,255,20,0.1)" }}>
        {isUnlocked ? (
          <div className="flex items-center justify-center gap-2 py-3">
            <span style={{ color: G }}>✓</span>
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: G }}>Added to Your Knowledge</p>
          </div>
        ) : (
          <button
            onClick={handleAddToKnowledge}
            disabled={loading}
            className="w-full py-4 text-sm font-black uppercase tracking-[0.3em] transition-all active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #FFD700, #FF4500)", color: "#050A05", boxShadow: "0 0 20px rgba(255,215,0,0.3)" }}
          >
            {loading ? "Saving..." : `Add to My Knowledge (+${c.points_awarded || 30} pts)`}
          </button>
        )}
      </div>
    </div>
  );
}
