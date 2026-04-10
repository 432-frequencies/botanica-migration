import { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { MapPin, Star, ChevronRight } from "lucide-react";
import ConstellationModal from "@/components/astronomy/ConstellationModal";

const G = "var(--v1v-green)";

function StarfieldCanvas() {
  const canvasRef = useRef(null);
  const starsRef = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    starsRef.current = Array.from({ length: 200 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.5 + 0.3,
      base: Math.random(),
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.005,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = Date.now() / 1000;
      starsRef.current.forEach((s) => {
        const opacity = s.base * 0.5 + Math.sin(now * s.speed * 10 + s.phase) * 0.4 * s.base + 0.1;
        ctx.beginPath();
        ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, Math.min(1, opacity))})`;
        ctx.fill();
      });
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

function CompassRose({ alpha }) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const deg = alpha ?? 0;
  const dirIndex = Math.round(deg / 45) % 8;
  const cardinalDir = dirs[dirIndex];

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-20 h-20 rounded-full relative flex items-center justify-center"
        style={{ border: "1px solid var(--v1v-green-ghost)", background: "var(--v1v-bg-overlay)" }}
      >
        <div
          className="absolute w-0.5 h-8 top-2 left-1/2 -translate-x-1/2 rounded-full origin-bottom"
          style={{ background: "red", transformOrigin: "50% 100%", transform: `translateX(-50%) rotate(${deg}deg)` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-black" style={{ color: G }}>{cardinalDir}</span>
        </div>
        {["N","E","S","W"].map((d, i) => {
          const angle = i * 90;
          const rad = (angle - 90) * Math.PI / 180;
          const x = 50 + 42 * Math.cos(rad);
          const y = 50 + 42 * Math.sin(rad);
          return (
            <span key={d} className="absolute text-[7px] font-black" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)", color: d === "N" ? "red" : "rgba(57,255,20,0.5)" }}>
              {d}
            </span>
          );
        })}
      </div>
      <p className="text-xs tracking-[0.4em] uppercase mt-1" style={{ color: "var(--v1v-green-faint)" }}>
        {deg ? `${Math.round(deg)}°` : "—"}
      </p>
    </div>
  );
}

function getRarityStars(rarity) {
  if (rarity === "legendary") return "⭐⭐⭐";
  if (rarity === "rare") return "⭐⭐";
  return "⭐";
}

export default function NightSky() {
  const [orientation, setOrientation] = useState({ alpha: null, beta: null, gamma: null });
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [location, setLocation] = useState(null);
  const [constellations, setConstellations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [unlockedIds, setUnlockedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [astroBodies, setAstroBodies] = useState({});
  const [activeConstellations, setActiveConstellations] = useState(new Set());
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth() + 1;

  useEffect(() => {
    requestOrientationPermission();
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
        setLocation(loc);
        loadData(loc);
      },
      () => loadData(null) // no location, still load
    );
  }, []);

  const requestOrientationPermission = async () => {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm === "granted") setPermissionGranted(true);
      } catch (e) {}
    } else {
      setPermissionGranted(true);
    }
  };

  useEffect(() => {
    if (!permissionGranted) return;
    const handler = (e) => setOrientation({ alpha: e.alpha, beta: e.beta, gamma: e.gamma });
    window.addEventListener("deviceorientation", handler);
    return () => window.removeEventListener("deviceorientation", handler);
  }, [permissionGranted]);

  const loadData = async (loc) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [allRes, progRes] = await Promise.all([
        supabase.from('constellations').select('*'),
        supabase.from('user_knowledge_progress').select('*').eq('user_email', user.email),
      ]);
      setConstellations(allRes.data || []);
      setUnlockedIds(new Set((progRes.data || []).map((p) => p.knowledge_id)));
      // getAstronomyData : TODO migrer vers API route — stubbed pour l'instant
    } catch (e) {}
    setLoading(false);
  };

  const hasRealData = activeConstellations.size > 0;

  const visibleConstellations = constellations.filter((c) => {
    // If we have real astronomy data, prioritize it
    if (hasRealData) {
      const abbr = c.abbreviation?.toLowerCase();
      return abbr && activeConstellations.has(abbr);
    }
    // Fallback: local month+latitude filter
    const monthMatch = !c.best_viewing_months?.length || c.best_viewing_months.includes(month);
    const latMatch = !location || (
      (c.visible_latitude_min == null || location.lat >= c.visible_latitude_min) &&
      (c.visible_latitude_max == null || location.lat <= c.visible_latitude_max)
    );
    return monthMatch && latMatch;
  });

  // Get sun/moon info from real data
  const sun = astroBodies['sun'];
  const moon = astroBodies['moon'];

  const beta = orientation.beta ?? 0;
  const isPointingUp = beta > 45;

  return (
    <div className="min-h-screen relative" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>
      {/* Starfield */}
      <div className="fixed inset-0 z-0">
        <StarfieldCanvas />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="px-5 pt-12 pb-4" style={{ background: "var(--v1v-bg-overlay)", borderBottom: "1px solid var(--v1v-green-ghost)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-3 h-3" style={{ color: G }} />
            <p className="text-xs tracking-[0.6em] uppercase font-black" style={{ color: "var(--v1v-green-muted)" }}>Night Sky</p>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-black uppercase" style={{ color: G, textShadow: `0 0 20px ${G}` }}>
                {String(hour).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
              </h1>
              {location && (
                <p className="text-xs tracking-widest mt-0.5 flex items-center gap-1" style={{ color: "var(--v1v-green-faint)" }}>
                  <MapPin className="w-2.5 h-2.5" />
                  {location.lat.toFixed(2)}°N {location.lng.toFixed(2)}°E
                </p>
              )}
            </div>
            <CompassRose alpha={orientation.alpha} />
          </div>

          {/* Elevation */}
          {orientation.beta !== null && (
            <div className="flex items-center gap-3 mt-3 p-2" style={{ background: "rgba(57,255,20,0.05)", border: "1px solid rgba(57,255,20,0.15)" }}>
              <div className="flex-1">
                <p className="text-xs tracking-widest uppercase mb-1" style={{ color: "var(--v1v-green-faint)" }}>Elevation angle</p>
                <div className="h-1 w-full" style={{ background: "rgba(57,255,20,0.1)" }}>
                  <div className="h-1" style={{ width: `${Math.min(100, Math.max(0, orientation.beta))}%`, background: G, boxShadow: `0 0 6px ${G}` }} />
                </div>
              </div>
              <p className="text-lg font-black" style={{ color: G }}>{Math.round(orientation.beta ?? 0)}°</p>
            </div>
          )}

          {/* Real astronomy data badges */}
          {(sun || moon) && (
            <div className="flex gap-2 mt-3">
              {sun && (
                <div className="flex-1 p-2 text-center" style={{ background: "rgba(255,200,0,0.06)", border: "1px solid rgba(255,200,0,0.15)" }}>
                  <p className="text-[10px] tracking-widest uppercase mb-0.5" style={{ color: "rgba(255,200,0,0.5)" }}>☀ Sun</p>
                  <p className="text-xs font-black" style={{ color: sun.isAboveHorizon ? "#FFD700" : "rgba(255,200,0,0.3)" }}>
                    {sun.isAboveHorizon ? "Above horizon" : "Below horizon"}
                  </p>
                  <p className="text-[10px]" style={{ color: "rgba(255,200,0,0.4)" }}>{Math.round(sun.altitude)}° alt · {Math.round(sun.azimuth)}° az</p>
                </div>
              )}
              {moon && (
                <div className="flex-1 p-2 text-center" style={{ background: "rgba(200,200,255,0.06)", border: "1px solid rgba(200,200,255,0.15)" }}>
                  <p className="text-[10px] tracking-widest uppercase mb-0.5" style={{ color: "rgba(200,200,255,0.5)" }}>☽ Moon</p>
                  <p className="text-xs font-black" style={{ color: moon.isAboveHorizon ? "#E8E0D0" : "rgba(200,200,255,0.3)" }}>
                    {moon.isAboveHorizon ? "Above horizon" : "Below horizon"}
                  </p>
                  <p className="text-[10px]" style={{ color: "rgba(200,200,255,0.4)" }}>{Math.round(moon.altitude)}° alt · {moon.constellation || "—"}</p>
                </div>
              )}
            </div>
          )}

          {/* Point up instruction */}
          {!isPointingUp && (
            <div className="mt-3 p-3 text-center" style={{ background: "rgba(255,200,0,0.06)", border: "1px solid rgba(255,200,0,0.2)" }}>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: "#FFD700" }}>
                ☝ Point your phone towards the sky
              </p>
            </div>
          )}
        </div>

        {/* Visible Tonight */}
        <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1" style={{ background: "rgba(57,255,20,0.1)" }} />
          <p className="text-xs font-black tracking-[0.4em] uppercase" style={{ color: "var(--v1v-green-faint)" }}>
            {hasRealData ? "🔭 Live — Visible Tonight" : "Visible Tonight"}
          </p>
          <div className="h-px flex-1" style={{ background: "rgba(57,255,20,0.1)" }} />
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
            </div>
          ) : visibleConstellations.length === 0 ? (
            <p className="text-center text-xs py-10" style={{ color: "rgba(57,255,20,0.3)" }}>No constellation data yet. Add some in the database.</p>
          ) : (
            <div className="space-y-3">
              {visibleConstellations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="w-full text-left p-3 transition-all active:scale-[0.98] flex items-center gap-3"
                  style={{ background: "var(--v1v-bg-overlay)", border: "1px solid var(--v1v-green-ghost)" }}
                >
                  <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: "rgba(57,255,20,0.05)", border: "1px solid rgba(57,255,20,0.1)" }}>
                    {c.image_url ? <img src={c.image_url} className="w-full h-full object-cover" alt="" /> : "✦"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black uppercase truncate" style={{ color: "var(--v1v-fg)" }}>{c.name_french || c.name_latin}</p>
                    <p className="text-xs tracking-wider italic truncate" style={{ color: "var(--v1v-green-faint)" }}>{c.name_latin}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs">{getRarityStars(c.rarity)}</p>
                      {c.best_viewing_time && (
                        <p className="text-[10px] tracking-widest uppercase" style={{ color: "var(--v1v-green-dim)" }}>{c.best_viewing_time}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: "rgba(57,255,20,0.3)" }} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="h-24" />
      </div>

      {selected && (
        <ConstellationModal
          constellation={selected}
          isUnlocked={unlockedIds.has(selected.id)}
          userLocation={location}
          onClose={() => setSelected(null)}
          onUnlock={() => { setUnlockedIds(prev => new Set([...prev, selected.id])); loadData(location); }}
        />
      )}
    </div>
  );
}