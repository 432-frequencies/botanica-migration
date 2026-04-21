import { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { identifyPlant } from "@/api/identifyPlant";
import { saveDiscovery } from "@/api/saveDiscovery";
import { uploadPhoto } from "@/api/uploadPhoto";
import { createPageUrl } from "@/utils";
import { Scan, Zap, Trophy, MapPin, ChevronRight, Shield, CheckCircle2 } from "lucide-react";
import CameraCapture from "@/components/identify/CameraCapture";

const G = "var(--v1v-green)";
const IS_DEV = import.meta.env.DEV;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error || new Error("Blob conversion failed"));
    reader.readAsDataURL(blob);
  });
}

const FEATURES = [
  {
    icon: Scan,
    title: "Scan",
    text: "Cadre un spécimen réel. W1LD prépare une première fiche claire à partir de ta photo.",
  },
  {
    icon: Zap,
    title: "Journal",
    text: "Chaque observation enrichit ton journal du vivant et garde une trace utile de ce que tu as rencontré.",
  },
  {
    icon: Trophy,
    title: "Repères",
    text: "Tes observations aident à mieux lire les zones autour de toi et à devenir un repère local crédible.",
  },
];

function OnboardingPanel({ children, className = "", centered = false }) {
  return (
    <div className={`v1v-surface-card mx-auto w-full max-w-md px-5 py-6 ${centered ? "text-center" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}

function OnboardingButton({ children, variant = "primary", className = "", ...props }) {
  const baseClass = variant === "secondary" ? "v1v-button-secondary" : "v1v-button-primary";
  return (
    <button {...props} className={`${baseClass} w-full ${className}`.trim()}>
      {children}
    </button>
  );
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanNotice, setScanNotice] = useState(null);
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
      } catch {}
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

  const handleCapture = async (capturePayload) => {
    const blob = capturePayload?.blob instanceof Blob ? capturePayload.blob : null;

    if (!blob) {
      setScanError("Image vide. Réessaie.");
      return;
    }
    setShowCamera(false);
    setIdentifying(true);
    setScanError(null);
    setScanNotice(null);

    // Step 1 — identifyPlant
    let res;
    try {
      const cleanBase64 = await blobToBase64(blob);
      res = await identifyPlant({ imageBase64: cleanBase64 });
      if (IS_DEV) {
        console.log("[SCAN][Onboarding] identifyPlant success", res?.top_result?.common_name);
      }
    } catch (e) {
      if (IS_DEV) {
        console.error("[SCAN][Onboarding] identifyPlant failed:", e?.message);
      }
      const msg = (e?.message || "").toLowerCase();
      if (msg.includes("unauthorized")) {
        setScanError("Ta session a expiré. Reconnecte-toi puis relance ton premier scan.");
      } else {
        setScanError("Le scan n'a pas pu aboutir. Vérifie ta connexion et réessaie.");
      }
      setIdentifying(false);
      return;
    }

    if (res?.error === "LIMIT_REACHED") { setScanError("Le service de scan est temporairement en pause. Réessaie un peu plus tard."); setIdentifying(false); return; }
    if (res?.error === "FAKE_IMAGE") { setScanError("Photo non valide — prends une vraie photo du spécimen."); setIdentifying(false); return; }
    if (res?.error === "NO_PLANT_FOUND") { setScanError("Aucun spécimen détecté — réessaie."); setIdentifying(false); return; }
    if (res?.error || !res?.top_result) { setScanError("Identification échouée. Réessaie."); setIdentifying(false); return; }

    const top = res.top_result;

    // Step 2 — Upload photo
    let photoUrl = "";
    try {
      photoUrl = await uploadPhoto(blob);
    } catch (error) {
      if (IS_DEV) {
        console.error("[SCAN][Onboarding] uploadPhoto failed:", error?.message);
      }
    }
    const photoUploadFailed = !photoUrl;

    // Step 3 — saveDiscovery
    try {
      const saveRes = await saveDiscovery({
        category: res.category || "plant",
        common_name: top.common_name,
        scientific_name: top.scientific_name,
        photo_url: photoUrl,
        rarity: top.rarity,
        is_edible: top.is_edible,
        is_toxic: top.is_toxic,
        edibility_status: top.edibility_status,
        safety_notes: top.safety_notes,
        latitude: geoCoords?.lat,
        longitude: geoCoords?.lng,
        confidence: top.confidence,
      });
      if (saveRes?.error) {
        throw new Error(saveRes.error);
      }
    } catch (e) {
      if (IS_DEV) {
        console.error("[SCAN][Onboarding] saveDiscovery failed:", e?.message);
      }
      const msg = (e?.message || "").toLowerCase();
      setScanError(msg.includes("unauthorized")
        ? "Ta session a expiré. Reconnecte-toi puis réessaie."
        : "L'observation n'a pas pu être enregistrée pour le moment. Réessaie.");
      setIdentifying(false);
      return;
    }

    setScanResult({
      commonName: top.common_name,
      rarity: top.rarity,
      xp: 10,
      photoWarning: photoUploadFailed,
    });
    if (photoUploadFailed) {
      setScanNotice("L'observation a été enregistrée, mais la photo n'a pas encore pu être synchronisée.");
    }
    setIdentifying(false);
  };

  const handleNextFromScan = () => {
    setStep(4);
    setScanResult(null);
    setScanNotice(null);
    setScanError(null);
  };

  const handleSkipScan = () => {
    setStep(4);
    setScanResult(null);
    setScanNotice(null);
    setScanError(null);
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
      if (IS_DEV) {
        console.log("[Onboarding] completeOnboarding success");
      }
    } catch (e) {
      if (IS_DEV) {
        console.error("[Onboarding] completeOnboarding failed:", e?.message, e);
      }
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
      if (IS_DEV) {
        console.error("[Onboarding] completeOnboarding error payload:", res.data);
      }
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
        <div className="flex flex-col items-center justify-center flex-1">
          <OnboardingPanel centered>
            <p className="v1v-page-kicker mb-3">Bienvenue</p>
            <h1
              className="font-black uppercase mb-5"
              style={{ fontSize: "42px", color: G, letterSpacing: "0.08em" }}
            >
              W1LD
            </h1>
            <h2 className="text-[30px] font-black uppercase tracking-[0.08em] leading-tight mb-4" style={{ color: "var(--v1v-fg)" }}>
              Observe le vivant autour de toi.
            </h2>
            <p className="text-[13px] leading-relaxed max-w-sm mx-auto" style={{ color: "var(--v1v-fg-muted)" }}>
              W1LD t’aide à identifier, documenter et relire ce que tu rencontres sur le terrain avec une interface simple, calme et fiable.
            </p>
          </OnboardingPanel>
        </div>
      );
    }

    // Étape 1 — La promesse (features animées)
    if (step === 1) {
      return (
        <div className="flex flex-col items-center justify-center flex-1">
          <OnboardingPanel>
            <p className="v1v-page-kicker mb-3">Prise en main</p>
            <h2 className="text-[28px] font-black uppercase tracking-[0.08em] leading-tight mb-3" style={{ color: "var(--v1v-fg)" }}>
              Ce que tu vas faire ici
            </h2>
            <p className="text-[12px] leading-relaxed mb-6" style={{ color: "var(--v1v-fg-muted)" }}>
              Trois gestes simples suffisent pour transformer une rencontre sur le terrain en note utile et durable.
            </p>
            <div className="space-y-4">
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
                  <div className="v1v-surface-card-soft flex gap-4 items-start px-4 py-4">
                    <div
                      className="w-12 h-12 flex-shrink-0 flex items-center justify-center mt-0.5"
                      style={{
                        background: "rgba(46,168,15,0.1)",
                        border: "1px solid rgba(46,168,15,0.2)",
                        borderRadius: "12px",
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
          </OnboardingPanel>
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
          <OnboardingPanel centered className="relative z-10">
            <MapPin className="w-16 h-16 mx-auto mb-6" style={{ color: G }} />
            <p className="v1v-page-kicker mb-3">Zone locale</p>
            <h2 className="text-[28px] font-black uppercase tracking-[0.08em] mb-4 text-center" style={{ color: "var(--v1v-fg)" }}>
              Où es-tu ?
            </h2>
            <p
              className="text-sm leading-relaxed max-w-sm text-center mb-8"
              style={{ color: "var(--v1v-fg-muted)" }}
            >
              La localisation est au cœur de W1LD — pour documenter les zones autour de toi, repérer les espèces proches et situer tes découvertes sur la carte du vivant.
            </p>

            {geoStatus === "granted" && (
              <div className="mb-6 text-center p-4" style={{ background: "rgba(46,168,15,0.08)", border: "1px solid rgba(46,168,15,0.2)", borderRadius: 14 }}>
                <p className="text-sm font-black uppercase tracking-wider" style={{ color: G }}>
                  ✓ Localisation obtenue
                </p>
                <p className="text-[11px] mt-2" style={{ color: "var(--v1v-fg-muted)" }}>
                  Parfait. Tu verras les repères et les zones liées à ce que tu observes.
                </p>
              </div>
            )}

            {geoStatus === "denied" && (
              <div className="mb-6 text-center p-4" style={{ background: "rgba(232,122,0,0.08)", border: "1px solid rgba(232,122,0,0.22)", borderRadius: 14 }}>
                <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#E87A00" }}>
                  Localisation refusée
                </p>
                <p className="text-[11px] mt-2" style={{ color: "var(--v1v-fg-muted)" }}>
                  Tu peux continuer sans elle, mais les repères autour de toi resteront masqués jusqu'à autorisation.
                </p>
              </div>
            )}

            <div className="w-full max-w-sm space-y-3">
              {geoStatus !== "granted" && (
                <OnboardingButton onClick={handleRequestGeo}>
                  Autoriser la localisation
                </OnboardingButton>
              )}
              <OnboardingButton onClick={handleSkipGeo} variant="secondary">
                {geoStatus === "granted" ? "Continuer" : "Plus tard"}
              </OnboardingButton>
            </div>
          </OnboardingPanel>
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
            <OnboardingPanel centered>
            <div className="w-16 h-16 rounded-full border-2 animate-spin mb-6 mx-auto" style={{ borderColor: G, borderTopColor: "transparent" }} />
            <p className="text-sm font-black uppercase tracking-[0.28em]" style={{ color: G }}>
              Analyse de ton premier spécimen
            </p>
            <p className="text-[11px] text-center mt-3 max-w-[260px]" style={{ color: "var(--v1v-fg-muted)" }}>
              On vérifie les détails visibles et on prépare une première fiche fiable pour ton journal.
            </p>
            </OnboardingPanel>
          </div>
        );
      }

      if (scanResult) {
        return (
          <div className="flex flex-col items-center justify-center flex-1 text-center">
            <OnboardingPanel centered>
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
            {(scanNotice || scanResult.photoWarning) && (
              <div className="w-full max-w-sm mb-6 p-4 text-left" style={{ background: "rgba(232,122,0,0.08)", border: "1px solid rgba(232,122,0,0.22)", borderRadius: 14 }}>
                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#E87A00" }} />
                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                    {scanNotice}
                  </p>
                </div>
              </div>
            )}
            <OnboardingButton onClick={handleNextFromScan} className="max-w-sm">
              Continuer
            </OnboardingButton>
            </OnboardingPanel>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center flex-1">
          <OnboardingPanel centered>
          <p className="v1v-page-kicker mb-3">Premier scan</p>
          <h2 className="text-[28px] font-black uppercase tracking-[0.08em] mb-4 text-center" style={{ color: "var(--v1v-fg)" }}>
            Ton premier scan
          </h2>
          <p
            className="text-sm leading-relaxed max-w-sm text-center mb-8"
            style={{ color: "var(--v1v-fg-muted)" }}
          >
            Choisis une photo claire d'une plante, d'un arbre, d'un oiseau, d'un champignon ou d'une roche rencontrés en conditions réelles.
          </p>

          {scanError && (
            <div className="w-full max-w-sm mb-6 p-4 text-left" style={{ background: "rgba(208,48,48,0.08)", border: "1px solid rgba(208,48,48,0.22)", borderRadius: 14 }}>
              <div className="flex items-start gap-3">
                <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(208,48,48,0.8)" }} />
                <p className="text-[11px] leading-relaxed" style={{ color: "rgba(232,220,220,0.9)" }}>
                  {scanError}
                </p>
              </div>
            </div>
          )}

          {!scanError && (
            <div className="w-full max-w-sm mb-6 p-4 text-left" style={{ background: "rgba(46,168,15,0.08)", border: "1px solid rgba(46,168,15,0.18)", borderRadius: 14 }}>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: G }} />
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                  Essaie un sujet bien visible, net et centré. Plus la photo est claire, plus la fiche sera utile.
                </p>
              </div>
            </div>
          )}

          <div className="w-full max-w-sm space-y-3">
            <OnboardingButton onClick={() => setShowCamera(true)} className="py-5">
              <Scan className="w-5 h-5 inline mr-2" />
              Lancer le scan
            </OnboardingButton>
            <OnboardingButton onClick={handleSkipScan} variant="secondary">
              Passer cette étape
            </OnboardingButton>
          </div>
          </OnboardingPanel>
        </div>
      );
    }

    // Étape 4 — Bienvenue personnalisé
    if (step === 4) {
      const firstName = userDataRef.current?.full_name?.split(" ")[0] || "Explorateur";
      return (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <OnboardingPanel centered>
          <p className="v1v-page-kicker mb-3">Prêt à entrer</p>
          <h2 className="text-[28px] font-black uppercase tracking-[0.08em] mb-2" style={{ color: G }}>
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
            <div className="w-full max-w-sm mb-4 p-4 text-left" style={{ background: "rgba(208,48,48,0.08)", border: "1px solid rgba(208,48,48,0.22)", borderRadius: 14 }}>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(232,220,220,0.9)" }}>
                {completeError}
              </p>
            </div>
          )}
          <OnboardingButton
            onClick={handleComplete}
            disabled={loading}
            className="max-w-sm"
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Chargement..." : "Entrer dans le terrain"}
          </OnboardingButton>
          </OnboardingPanel>
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
