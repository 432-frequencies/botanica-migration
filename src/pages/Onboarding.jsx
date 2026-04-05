import { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { identifyPlant } from "@/api/identifyPlant";
import { saveDiscovery } from "@/api/saveDiscovery";
import { uploadPhoto } from "@/api/uploadPhoto";
import { createPageUrl } from "@/utils";
import { Scan, Zap, Trophy, MapPin, ChevronRight } from "lucide-react";
import CameraCapture from "@/components/identify/CameraCapture";

const G = "var(--v1v-green)";
const GDB = "var(--v1v-green-bg)";

const FEATURES = [
  {
    icon: Scan,
    title: "Scan",
    text: "Pointe ton téléphone vers n'importe quelle espèce. L'IA identifie en 5 secondes.",
  },
  {
    icon: Zap,
    title: "Collecte",
    text: "Chaque découverte unique rapporte des XP. 100 espèces différentes = Légende Naturelle.",
  },
  {
    icon: Trophy,
    title: "Conquête",
    text: "Domine les zones de 500m autour de toi. Sois le premier découvreur de ta région.",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [identifying, setIdentifying] = useState(false);
  const [geoCoords, setGeoCoords] = useState(null);
  const [geoStatus, setGeoStatus] = useState("unknown");
  const [visibleFeatures, setVisibleFeatures] = useState([false, false, false]);
  const [completeError, setCompleteError] = useState(null);
  const userDataRef = useRef(null);

  // Étape 2 — animation staggered features
  useEffect(() => {
    if (step === 1) {
      setVisibleFeatures([false, false, false]);
      const timers = [
        setTimeout(() => setVisibleFeatures(v => [true, v[1], v[2]]), 200),
        setTimeout(() => setVisibleFeatures(v => [v[0], true, v[2]]), 500),
        setTimeout(() => setVisibleFeatures(v => [v[0], v[1], true]), 800),
      ];
      return () => timers.forEach(t => clearTimeout(t));
    }
  }, [step]);

  // Récupérer user data au montage
  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userDataRef.current = user;
      } catch (e) {}
    };
    load();
  }, []);

  const handleRequestGeo = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGeoCoords(coords);
        setGeoStatus("granted");
        try {
          localStorage.setItem("geo_permission", "granted");
        } catch {}
        setTimeout(() => setStep(3), 1500);
      },
      () => {
        setGeoStatus("denied");
        try {
          localStorage.setItem("geo_permission", "denied");
        } catch {}
      },
      { timeout: 10000 }
    );
  };

  const handleSkipGeo = () => {
    try {
      localStorage.setItem("geo_permission", "denied");
    } catch {}
    setStep(3);
  };

  const handleCapture = async (imageBase64) => {
    if (!imageBase64) {
      setScanError("Image vide. Réessaie.");
      return;
    }
    setShowCamera(false);
    setIdentifying(true);
    setScanError(null);

    // Step 1 — identifyPlant
    let res;
    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      res = await identifyPlant({ imageBase64: cleanBase64 });
      console.log("[SCAN][Onboarding] identifyPlant success", res?.top_result?.common_name);
    } catch (e) {
      console.error("[SCAN][Onboarding] identifyPlant failed:", e?.message);
      setScanError("Erreur réseau — réessaie.");
      setIdentifying(false);
      return;
    }

    if (res?.error === "LIMIT_REACHED") { setScanError("Limite quotidienne atteinte."); setIdentifying(false); return; }
    if (res?.error === "FAKE_IMAGE") { setScanError("Photo non valide — prends une vraie photo du spécimen."); setIdentifying(false); return; }
    if (res?.error === "NO_PLANT_FOUND") { setScanError("Aucun spécimen détecté — réessaie."); setIdentifying(false); return; }
    if (res?.error || !res?.top_result) { setScanError("Identification échouée. Réessaie."); setIdentifying(false); return; }

    const top = res.top_result;

    // Step 2 — Upload photo
    const dataUri = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    const photoUrl = await uploadPhoto(dataUri);

    // Step 3 — saveDiscovery
    try {
      await saveDiscovery({
        category: res.category || "plant",
        common_name: top.common_name,
        scientific_name: top.scientific_name,
        photo_url: photoUrl,
        rarity: top.rarity,
        is_edible: top.is_edible,
        is_toxic: top.is_toxic,
        latitude: geoCoords?.lat,
        longitude: geoCoords?.lng,
        confidence: top.confidence,
      });
    } catch (e) {
      console.error("[SCAN][Onboarding] saveDiscovery failed:", e?.message);
    }

    setScanResult({
      commonName: top.common_name,
      rarity: top.rarity,
      xp: 10,
    });
    setIdentifying(false);
  };

  const handleNextFromScan = () => {
    setStep(4);
    setScanResult(null);
  };

  const handleSkipScan = () => {
    setStep(4);
    setScanResult(null);
  };

  const handleComplete = async () => {
    setCompleteError(null);
    setLoading(true);
    let res;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_profiles')
          .update({ onboarding_completed: true })
          .eq('user_email', user.email);
      }
      res = { data: { success: true } };
      console.log("[Onboarding] completeOnboarding success");
    } catch (e) {
      console.error("[Onboarding] completeOnboarding failed:", e?.message, e);
      setLoading(false);
      const msg = e?.message?.toLowerCase() || "";
      if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("auth")) {
        setCompleteError("Session expirée — reconnecte-toi pour continuer.");
      } else if (msg.includes("network") || msg.includes("fetch") || msg.includes("timeout")) {
        setCompleteError("Erreur réseau — vérifie ta connexion.");
      } else {
        setCompleteError("Impossible de finaliser l'onboarding — réessaie.");
      }
      return;
    }
    if (res.data?.error) {
      console.error("[Onboarding] completeOnboarding error payload:", res.data);
      setLoading(false);
      setCompleteError(res.data.error === "Unauthorized"
        ? "Session expirée — reconnecte-toi pour continuer."
        : "Impossible de finaliser l'onboarding — réessaie."
      );
      return;
    }
    localStorage.setItem("onboarding_completed", "1");
    window.location.href = createPageUrl("Home");
  };

  const renderStep = () => {
    // Étape 0 — Accroche
    if (step === 0) {
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <h1
            className="font-black uppercase mb-6"
            style={{ fontSize: "56px", color: G, textShadow: `0 0 40px ${G}`, letterSpacing: "0.08em" }}
          >
            W1LD
          </h1>
          <h2 className="text-4xl font-black uppercase tracking-wider mb-6" style={{ color: "var(--v1v-fg)" }}>
            La nature t'attend.
          </h2>
          <p
            className="text-sm leading-relaxed max-w-sm"
            style={{ color: "var(--v1v-fg-muted)" }}
          >
            Identifie chaque espèce que tu croises. Collectionne. Conquiers des zones. Protège le vivant.
          </p>
        </div>
      );
    }

    // Étape 1 — La promesse (features animées)
    if (step === 1) {
      return (
        <div className="flex flex-col items-center justify-center flex-1">
          <h2 className="text-3xl font-black uppercase tracking-wider mb-12" style={{ color: "var(--v1v-fg)" }}>
            Comment ça marche
          </h2>
          <div className="w-full max-w-sm space-y-6">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div
                  key={i}
                  className="transition-all duration-300"
                  style={{
                    opacity: visibleFeatures[i] ? 1 : 0,
                    transform: visibleFeatures[i] ? "translateY(0)" : "translateY(8px)",
                  }}
                >
                  <div className="flex gap-4 items-start">
                    <div
                      className="w-12 h-12 flex-shrink-0 flex items-center justify-center mt-0.5"
                      style={{
                        background: "rgba(46,168,15,0.1)",
                        border: "1px solid rgba(46,168,15,0.2)",
                        borderRadius: "6px",
                      }}
                    >
                      <Icon className="w-6 h-6" style={{ color: G }} />
                    </div>
                    <div className="text-left flex-1">
                      <h3 className="font-black uppercase tracking-wider text-sm mb-1" style={{ color: G }}>
                        {feat.title}
                      </h3>
                      <p className="text-sm" style={{ color: "var(--v1v-fg-muted)" }}>
                        {feat.text}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Étape 2 — Permission GPS
    if (step === 2) {
      return (
        <div className="flex flex-col items-center justify-center flex-1">
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 60%, rgba(46,168,15,0.4) 0%, transparent 40%), radial-gradient(circle at 70% 40%, rgba(46,168,15,0.3) 0%, transparent 50%)",
            }}
          />
          <div className="relative z-10">
            <MapPin className="w-16 h-16 mx-auto mb-6" style={{ color: G }} />
            <h2 className="text-3xl font-black uppercase tracking-wider mb-4 text-center" style={{ color: "var(--v1v-fg)" }}>
              Où es-tu ?
            </h2>
            <p
              className="text-sm leading-relaxed max-w-sm text-center mb-8"
              style={{ color: "var(--v1v-fg-muted)" }}
            >
              La localisation est au cœur de W1LD — pour les zones à conquérir, les espèces proches de toi, et marquer tes découvertes sur la carte mondiale.
            </p>

            {geoStatus === "granted" && (
              <div className="mb-6 text-center">
                <p className="text-sm font-black uppercase tracking-wider" style={{ color: G }}>
                  ✓ Localisation obtenue
                </p>
              </div>
            )}

            <div className="w-full max-w-sm space-y-3">
              {geoStatus !== "granted" && (
                <button
                  onClick={handleRequestGeo}
                  className="w-full py-4 text-sm font-black uppercase tracking-[0.3em] transition-all"
                  style={{
                    background: G,
                    color: "var(--v1v-bg)",
                  }}
                >
                  Autoriser la localisation
                </button>
              )}
              <button
                onClick={handleSkipGeo}
                className="w-full py-4 text-sm font-black uppercase tracking-[0.3em] transition-all"
                style={{
                  border: `1px solid rgba(46,168,15,0.3)`,
                  color: G,
                }}
              >
                {geoStatus === "granted" ? "Continuer" : "Plus tard"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Étape 3 — Premier scan
    if (step === 3) {
      if (showCamera) {
        return (
          <div className="absolute inset-0 z-50">
            <CameraCapture onCapture={handleCapture} onClose={() => setShowCamera(false)} coords={geoCoords} />
          </div>
        );
      }

      if (identifying) {
        return (
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="w-16 h-16 rounded-full border-2 animate-spin mb-6" style={{ borderColor: G, borderTopColor: "transparent" }} />
            <p className="text-sm font-black uppercase tracking-widest" style={{ color: G }}>
              Identification en cours...
            </p>
          </div>
        );
      }

      if (scanResult) {
        return (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <div
              className="w-20 h-20 flex items-center justify-center mb-6"
              style={{
                background: "rgba(46,168,15,0.15)",
                border: `1px solid ${G}`,
                borderRadius: "8px",
              }}
            >
              <Scan className="w-10 h-10" style={{ color: G }} />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-wider mb-2" style={{ color: "var(--v1v-fg)" }}>
              {scanResult.commonName}
            </h3>
            <p className="text-sm uppercase tracking-widest mb-4" style={{ color: G }}>
              Rareté: {scanResult.rarity}
            </p>
            <p className="text-lg font-black tracking-wider mb-6" style={{ color: G }}>
              +{scanResult.xp} XP
            </p>
            <p className="text-sm mb-8" style={{ color: "var(--v1v-fg-muted)" }}>
              Ta première découverte est enregistrée.
            </p>
            <button
              onClick={handleNextFromScan}
              className="w-full max-w-sm py-4 text-sm font-black uppercase tracking-[0.3em]"
              style={{ background: G, color: "var(--v1v-bg)" }}
            >
              Continuer
            </button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center flex-1">
          <h2 className="text-3xl font-black uppercase tracking-wider mb-4 text-center" style={{ color: "var(--v1v-fg)" }}>
            Ton premier scan
          </h2>
          <p
            className="text-sm leading-relaxed max-w-sm text-center mb-8"
            style={{ color: "var(--v1v-fg-muted)" }}
          >
            Pointe vers n'importe quelle plante, arbre, oiseau, champignon ou roche dans ton environnement réel.
          </p>

          {scanError && (
            <p className="text-sm text-center mb-6" style={{ color: "rgba(208,48,48,0.7)" }}>
              {scanError}
            </p>
          )}

          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={() => setShowCamera(true)}
              className="w-full py-6 text-sm font-black uppercase tracking-[0.3em] transition-all"
              style={{ background: G, color: "var(--v1v-bg)" }}
            >
              <Scan className="w-5 h-5 inline mr-2" />
              Lancer le scan
            </button>
            <button
              onClick={handleSkipScan}
              className="w-full py-4 text-sm font-black uppercase tracking-[0.3em]"
              style={{ color: G, border: `1px solid rgba(46,168,15,0.3)` }}
            >
              Passer cette étape
            </button>
          </div>
        </div>
      );
    }

    // Étape 4 — Bienvenue personnalisé
    if (step === 4) {
      const firstName = userDataRef.current?.full_name?.split(" ")[0] || "Explorateur";
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <h2 className="text-3xl font-black uppercase tracking-wider mb-2" style={{ color: G }}>
            Bienvenue dans W1LD
          </h2>
          <p className="text-lg mb-8" style={{ color: "var(--v1v-fg)" }}>
            {firstName}
          </p>

          <div className="w-full max-w-sm mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(226,234,224,0.7)" }}>
                Rang de départ
              </p>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: G }}>
                Scout
              </p>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--v1v-fg-muted)" }}>
              100 XP pour devenir Tracker
            </p>
            <div className="w-full h-2" style={{ background: "rgba(46,168,15,0.1)", borderRadius: "1px" }}>
              <div
                className="h-2 transition-all duration-500"
                style={{
                  width: "0%",
                  background: G,
                  borderRadius: "1px",
                  boxShadow: `0 0 8px ${G}`,
                }}
              />
            </div>
          </div>

          {completeError && (
            <p className="text-sm text-center mb-4 px-2" style={{ color: "rgba(208,48,48,0.85)" }}>
              {completeError}
            </p>
          )}
          <button
            onClick={handleComplete}
            disabled={loading}
            className="w-full max-w-sm py-5 text-sm font-black uppercase tracking-[0.3em] transition-all"
            style={{
              background: G,
              color: "var(--v1v-bg)",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Chargement..." : "Entrer dans le terrain"}
          </button>
        </div>
      );
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col px-6 pt-16 pb-10 relative overflow-hidden"
      style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}
    >
      {/* Ambient */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(57,184,20,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Progress dots */}
      <div className="relative z-10 flex gap-1.5 justify-center mb-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="transition-all duration-300"
            style={{
              width: i === step ? "24px" : "6px",
              height: "6px",
              borderRadius: "3px",
              background: i <= step ? G : "rgba(57,184,20,0.15)",
              boxShadow: i === step ? `0 0 8px ${G}` : "none",
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        className="relative z-10 flex-1 w-full max-w-sm mx-auto flex flex-col transition-all duration-250 overflow-hidden"
        style={{
          animation: `slideIn 250ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        {renderStep()}
      </div>

      {/* Navigation buttons — étapes 0 et 1 */}
      {step < 2 && (
        <div className="relative z-10 w-full max-w-sm mx-auto">
          <button
            onClick={() => setStep(s => s + 1)}
            className="w-full py-5 text-sm font-black uppercase tracking-[0.35em] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: G,
              color: "var(--v1v-bg)",
              boxShadow: `0 0 30px rgba(46,168,15,0.3)`,
            }}
          >
            {step === 0 ? "Commencer" : "Suivant"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(32px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}