import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getUserProfile } from "@/api/getUserProfile";
import { saveDiscovery } from "@/api/saveDiscovery";
import { identifyPlant } from "@/api/identifyPlant";
import { uploadPhoto } from "@/api/uploadPhoto";
import { createPageUrl } from "@/utils";
import { feedback } from "@/utils/feedback";
import { Camera, User, Zap, Shield, WifiOff, Flame, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { fadeInUp } from "@/motion/variants";
import { useScrollReveal } from "@/motion/hooks/useScrollReveal";
import CameraCapture from "@/components/identify/CameraCapture";
import PlantResult from "@/components/identify/PlantResult";
import AchievementToast from "@/components/identify/AchievementToast";
import LevelUpCelebration from "@/components/shared/LevelUpCelebration";
import XPLevelBar, { getCurrentLevel } from "@/components/home/XPLevelBar";
import XPLevelModule from "@/components/home/XPLevelModule";
import LocalZoneWidget from "@/components/home/LocalZoneWidget";
import CurrentZoneStatus from "@/components/home/CurrentZoneStatus";
import PullToRefresh from "@/components/shared/PullToRefresh";
import BlockErrorBoundary from "@/components/shared/BlockErrorBoundary";

import { Link } from "react-router-dom";
import { Component } from "react";
import { getPendingQueue, updateQueueItem, removeFromQueue, addToQueue } from "@/utils/offlineQueue";
import { useIsActivePage } from "@/lib/ActivePageContext";
import { useAuth } from "@/lib/AuthContext";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const G = "var(--v1v-green)";
const GD = "var(--v1v-green-ghost)";
const GDB = "var(--v1v-green-bg)";

const GREETINGS = [
  { min: 6,  max: 12, text: (name) => `BONNE CHASSE, ${name}.` },
  { min: 12, max: 18, text: () => "LE TERRAIN T'ATTEND." },
  { min: 18, max: 23, text: () => "L'HEURE DES NOCTURNES." },
  { min: 23, max: 30, text: () => "CIEL DÉGAGÉ CE SOIR ?" }, // 23-30 covers 23-6 (24+6)
];

function getGreeting(name = "RANGER") {
  const h = new Date().getHours();
  const normalH = h < 6 ? h + 24 : h;
  for (const g of GREETINGS) {
    if (normalH >= g.min && normalH < g.max) return g.text(name.toUpperCase());
  }
  return `BONNE CHASSE, ${name.toUpperCase()}.`;
}

const SCAN_TEXTS = [
  "POINTE VERS LE VIVANT.",
  "IDENTIFIE. COLLECTE. GAGNE.",
  "LA NATURE T'ATTEND.",
];

const RANK_COLORS = {
  Scout:       "#2D7A1F",
  Tracker:     "#3AAF1A",
  Observer:    "#3AB8A5",
  "Field Agent": "#3A7AB8",
  Specialist:  "#7A3AB8",
  Expert:      "#B87A3A",
  Analyst:     "#B83A3A",
  Elite:       "#B8983A",
  Phantom:     "#A0A0A0",
  Ghost:       "#E0E0E0",
};

function SkeletonBlock({ className, style }) {
  return (
    <div
      className={className}
      style={{ background: "rgba(45,122,31,0.1)", animation: "skeletonPulse 1.4s ease-in-out infinite", ...style }}
    />
  );
}

function ScrollRevealSection({ children, threshold = 0.1 }) {
  const [ref, isVisible] = useScrollReveal({ once: true, threshold });
  return (
    <motion.div
      ref={ref}
      variants={fadeInUp}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  );
}

export default function Home() {
  const isActive = useIsActivePage("Home");
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const hasLoadedRef = useRef(false);
  const [userData, setUserData] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [result, setResult] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [scanPulse, setScanPulse] = useState(false);
  const [scanTextIdx, setScanTextIdx] = useState(0);
  const [geoCoords, setGeoCoords] = useState(null);
  const [geoPermission, setGeoPermission] = useState(() => {
    try { return localStorage.getItem("geo_permission") || "unknown"; } catch { return "unknown"; }
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [queueProgress, setQueueProgress] = useState(null); // { current, total }
  const [scanPhase, setScanPhase] = useState(0); // 0=init 1=analyse 2=classification
  const [scanTimeout, setScanTimeout] = useState(false);
  const [streakWarning, setStreakWarning] = useState(false);
  const [identifyMode, setIdentifyMode] = useState("plant");
  const [showAudio, setShowAudio] = useState(false);
  const [levelUpData, setLevelUpData] = useState(null);
  const geoRef = useRef(null);
  const userDataSnapshot = useRef(null);

  // Ne charger qu'à la première activation de la page
  // isActive est la dépendance — se déclenche à la première activation
  useEffect(() => {
    if (!isActive || hasLoadedRef.current) return;
    // Ne pas charger si l'auth n'est pas encore résolue ou si non authentifié
    if (isLoadingAuth) return;
    if (!isAuthenticated) return; // App.jsx/AuthContext gérera la redirection
    hasLoadedRef.current = true;
    loadUserData();
    const params = new URLSearchParams(window.location.search);
    if (params.get("openCamera") === "true") {
      setShowCamera(true);
      // Nettoyer l'URL sans rechargement
      window.history.replaceState({}, "", window.location.pathname);
    }
    const iv = setInterval(() => setScanPulse(p => !p), 2000);
    const iv2 = setInterval(() => setScanTextIdx(i => (i + 1) % SCAN_TEXTS.length), 3000);
    // Géolocalisation — si déjà accordée, récupérer silencieusement
    if (localStorage.getItem("geo_permission") === "granted") {
      navigator.geolocation?.getCurrentPosition(
        pos => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          geoRef.current = c;
          setGeoCoords(c);
        },
        () => {},
        { timeout: 10000, maximumAge: 300000 }
      );
    }
    // Détection réseau + traitement de la queue
    const handleOnline = () => {
      processOfflineQueue();
    };
    const handleOffline = () => {};
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Vérifier la queue au montage
    if (navigator.onLine) processOfflineQueue();

    return () => {
      clearInterval(iv);
      clearInterval(iv2);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isActive, isAuthenticated, isLoadingAuth]);

  const processOfflineQueue = async () => {
    const queue = (await getPendingQueue()).filter(i => i.status !== 'error' || i.attempts < 3);
    if (!queue.length) return;

    setPendingCount(queue.length);
    setToast(`Connexion rétablie — identification de ${queue.length} photo${queue.length > 1 ? "s" : ""} en attente...`);

    let successCount = 0;

    for (let idx = 0; idx < queue.length; idx++) {
      const item = queue[idx];
      setQueueProgress({ current: idx + 1, total: queue.length });
      try {
        await updateQueueItem(item.id, { status: "processing", attempts: (item.attempts || 0) + 1 });

        const res = { data: await identifyPlant({ imageBase64: item.imageBase64 }) };

        if (res.data?.error || !res.data?.top_result) {
          const attempts = (item.attempts || 0) + 1;
          await updateQueueItem(item.id, { status: attempts >= 3 ? "error" : "pending", attempts });
          continue;
        }

        const top = res.data.top_result;
        await saveDiscovery({
          ...top,
          category: res.data.category || "plant",
          photo_url: item.imageBase64,
          thumbnail_url: item.imageBase64,
          latitude: item.latitude,
          longitude: item.longitude,
        });

        await removeFromQueue(item.id);
        successCount++;
      } catch (e) {
        const attempts = (item.attempts || 0) + 1;
        await updateQueueItem(item.id, { status: attempts >= 3 ? "error" : "pending", attempts });
      }
    }

    setQueueProgress(null);
    setPendingCount(0);

    if (successCount > 0) {
      setToast(`${successCount} espèce${successCount > 1 ? "s" : ""} ajoutée${successCount > 1 ? "s" : ""} depuis ta session hors ligne.`);
      loadUserData();
    }

    // Vérifier les erreurs persistantes
    const remaining = await getPendingQueue();
    const errors = remaining.filter(i => i.status === "error");
    if (errors.length > 0) {
      setTimeout(() => setToast(`${errors.length} photo${errors.length > 1 ? "s" : ""} n'ont pas pu être identifiées. Ouvre l'app pour réessayer.`), 3000);
    }
  };

  const loadUserData = async () => {
    setLoadError(false);
    try {
      // getUserProfile récupère auth + profil en une fois
      let profileData = null;
      try {
        profileData = await getUserProfile();
      } catch (profileErr) {
        console.error("[Home] getUserProfile failed:", profileErr?.message || profileErr);
        if (profileErr?.message === 'Unauthorized') {
          setLoadError({ type: "auth", message: "Non connecté" });
          return;
        }
        // Degrade gracefully — show page without profile data
        profileData = { user: null, profile: null, achievements: [] };
      }
      setUserData(profileData);

      const localOnboardingDone = localStorage.getItem("onboarding_completed") === "1";
      console.log("[Home] onboarding check — local:", localOnboardingDone, "| backend:", profileData?.profile?.onboarding_completed);
      if (!localOnboardingDone && profileData?.profile && !profileData.profile.onboarding_completed) {
        window.location.href = createPageUrl("Onboarding");
      }
      // Nettoyage du flag local une fois le backend confirmé
      if (profileData?.profile?.onboarding_completed && localOnboardingDone) {
        localStorage.removeItem("onboarding_completed");
      }

      // Streak warning
      const lastScan = profileData?.profile?.last_scan_date;
      const todayStr = new Date().toISOString().split('T')[0];
      const yd = new Date();
      yd.setDate(yd.getDate() - 1);
      const yesterdayStr = yd.toISOString().split('T')[0];
      const streakDays = profileData?.profile?.streak_days || 0;
      if (streakDays >= 2 && lastScan === yesterdayStr) {
        setStreakWarning(true);
      }

    } catch (e) {
      console.error("[Home] loadUserData unexpected error:", e?.message || e);
      setLoadError({ type: "unknown", message: e?.message });
    }
  };

  const handleCapture = async (imageBase64) => {
    console.log("handleCapture called", {
      hasImage: !!imageBase64,
      imageLength: imageBase64?.length,
      imageStart: imageBase64?.substring(0, 50)
    });
    if (!imageBase64) {
      setToast("Erreur : image vide. Réessaie.");
      return;
    }
    // Ensure data URI format for <img src>
    const dataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
    setShowCamera(false);
    setIdentifying(true);
    setIdentifyMode("plant");
    setShowAudio(false);
    setCapturedImage(dataUri);
    setScanPhase(1);
    setScanTimeout(false);
    const phaseTimer1 = setTimeout(() => setScanPhase(2), 3000);
    const phaseTimer2 = setTimeout(() => setScanPhase(3), 7000);
    const timeoutTimer = setTimeout(() => setScanTimeout(true), 20000);
    const clearTimers = () => {
      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);
      clearTimeout(timeoutTimer);
    };
    // Snapshot for rollback
    const countSnapshot = userData?.profile?.daily_identifications_count ?? 0;

    const rollbackCounter = () => setUserData(prev => prev ? {
      ...prev,
      profile: prev.profile ? { ...prev.profile, daily_identifications_count: countSnapshot } : prev.profile
    } : prev);

    // Optimistic: increment daily count immediately
    setUserData(prev => {
      if (!prev) return prev;
      return { ...prev, profile: prev.profile ? { ...prev.profile, daily_identifications_count: (prev.profile.daily_identifications_count || 0) + 1 } : prev.profile };
    });

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    console.log("[SCAN] identifyPlant start — imageLength:", cleanBase64.length);
    if (cleanBase64.length > 2000000) console.warn("[SCAN] WARNING image très lourde:", Math.round(cleanBase64.length * 0.75 / 1024), "KB");
    let res;
    try {
      const data = await identifyPlant({ imageBase64: cleanBase64 });
      res = { data };
    } catch (err) {
      clearTimers();
      rollbackCounter();
      setIdentifying(false); setScanPhase(0);
      setCapturedImage(null);

      const msg = (err?.message || "").toLowerCase();
      const status = err?.status || err?.response?.status || 0;
      console.error("[SCAN] identifyPlant failed", { status, message: err?.message, imageLength: cleanBase64.length });

      // Vrai problème réseau uniquement → queue offline
      const isNetworkError = msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network error") || msg.includes("timeout") || status === 0;

      if (isNetworkError) {
        const isPro = userData?.profile?.is_pro || false;
        try {
          await addToQueue(imageBase64, geoRef.current, isPro);
          setToast("Réseau instable — photo mise en file hors ligne. Elle sera identifiée dès ta reconnexion.");
        } catch (qErr) {
          setToast(qErr.message === "QUEUE_FULL"
            ? isPro ? "File hors ligne pleine (50/50). Reconnecte-toi." : "File hors ligne pleine (5/5). Passe Pro pour plus de capacité."
            : "Erreur réseau — réessaie."
          );
        }
      } else if (status === 401 || status === 403 || msg.includes("401") || msg.includes("unauthorized")) {
        setToast("Session expirée — reconnecte-toi.");
      } else if (status === 429 || msg.includes("limit_reached") || msg.includes("429")) {
        setShowLimitModal(true);
      } else if (status === 413 || msg.includes("413") || msg.includes("payload too large") || msg.includes("body too large")) {
        setToast("Photo trop lourde — compression insuffisante, réessaie.");
      } else if (status === 500 || msg.includes("500")) {
        setToast("Erreur serveur — réessaie dans un instant.");
      } else {
        setToast("Erreur lors du scan — réessaie.");
      }
      return;
    }

    if (res.data?.error === "LIMIT_REACHED") { clearTimers(); rollbackCounter(); setShowLimitModal(true); setIdentifying(false); setScanPhase(0); return; }
    if (res.data?.error === "FAKE_IMAGE") {
      clearTimers();
      rollbackCounter();
      setToast("Photo non valide — prends une vraie photo dans la nature.");
      setIdentifying(false); setScanPhase(0); setCapturedImage(null); return;
    }
    if (res.data?.error === "NO_PLANT_FOUND") { clearTimers(); setToast("Aucun spécimen détecté. Essaie un autre angle."); setIdentifying(false); setScanPhase(0); return; }
    if (!res.data?.top_result) { clearTimers(); setToast("Aucun spécimen détecté."); setIdentifying(false); setScanPhase(0); return; }
    clearTimers();
    setScanPhase(0);
    setResult(res.data);
    setIdentifying(false);
    loadUserData();
  };



  const handleSave = async () => {
    if (!result) return;
    const top = identifyMode === "plant" ? result.top_result : result;
    const savedResult = result;
    const savedImage = capturedImage;

    // Snapshot pour rollback
    const snapshot = userData ? JSON.parse(JSON.stringify(userData)) : null;

    // Optimistic UI — NE PAS nullifier result/capturedImage avant succès serveur
    setSaving(true);
    setToast(`Identification de ${top.common_name}...`);
    setUserData(prev => prev ? {
      ...prev,
      profile: prev.profile ? {
        ...prev.profile,
        total_plants: (prev.profile.total_plants || 0) + 1,
        total_points: (prev.profile.total_points || 0) + 10,
      } : prev.profile
    } : prev);

    try {
      let lat, lng;
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {}

      let photoUrl = "";
      try {
        console.log("[SCAN][Home] UploadFile start");
        const dataUri = savedImage.startsWith("data:") ? savedImage : `data:image/jpeg;base64,${savedImage}`;
        photoUrl = await uploadPhoto(dataUri);
        console.log("[SCAN][Home] UploadFile success:", photoUrl);
      } catch (e) {
        console.error("[SCAN][Home] UploadFile failed:", e?.message);
        setSaving(false);
        if (snapshot) setUserData(snapshot);
        window.dispatchEvent(new CustomEvent("optimistic-error", { detail: { message: "Impossible d'envoyer la photo — réessaie." } }));
        return;
      }

      console.log("[SCAN][Home] saveDiscovery start");
      const saveRes = await saveDiscovery({
        category: savedResult.category || "plant",
        common_name: top.common_name,
        scientific_name: top.scientific_name,
        family: top.family,
        photo_url: photoUrl,
        latitude: lat,
        longitude: lng,
        confidence: top.confidence,
        rarity: top.rarity,
        is_edible: top.is_edible,
        is_toxic: top.is_toxic,
        description: top.description,
        habitat: top.habitat,
        ecological_role: top.ecological_role,
        biodiversity_importance: top.biodiversity_importance,
        edibility_details: top.edibility_details,
        medicinal_uses: top.medicinal_uses,
        anecdote: top.anecdote,
      });

      if (saveRes?.error) throw new Error(saveRes.error);

      // Succès — on ferme maintenant
      setResult(null);
      setCapturedImage(null);
      setSaving(false);
      const xp = saveRes?.xp_earned || 10;
      const lvl = saveRes?.level;
      const prevLvl = getCurrentLevel(snapshot?.profile?.total_points || 0)?.level;
      const levelUp = lvl && prevLvl && lvl > prevLvl;

      // Feedback haptique et sonore selon le résultat
      if (levelUp) {
        const currentLevelData = getCurrentLevel(snapshot?.profile?.total_points || 0);
        const newLevelData = getCurrentLevel((snapshot?.profile?.total_points || 0) + xp);
        setLevelUpData({
          level: newLevelData.level,
          label: newLevelData.label,
          xp: xp,
        });
      } else if (top.rarity === 'legendaire') {
        feedback('legendary', { haptic: true, sound: true });
        setToast(`✨ LÉGENDAIRE! +${xp} XP — ${top.common_name}`);
      } else if (top.rarity === 'rare') {
        feedback('rare', { haptic: true, sound: false });
        setToast(`⭐ RARE! +${xp} XP — ${top.common_name}`);
      } else {
        feedback('success', { haptic: true, sound: false });
        setToast(`+${xp} XP — ${top.common_name} ajouté.`);
      }

      if (saveRes?.new_achievements?.length > 0) {
        setAchievementQueue(saveRes.new_achievements);
      }
      loadUserData();

    } catch (err) {
      // Rollback — result et capturedImage sont toujours intacts, l'utilisateur peut réessayer
      if (snapshot) setUserData(snapshot);
      setSaving(false);
      setToast(null);
      window.dispatchEvent(new CustomEvent("optimistic-error", {
        detail: { message: "Save failed — réessaie." }
      }));
      console.error("handleSave error:", err);
    }
  };

  const requestGeo = () => {
    navigator.geolocation?.getCurrentPosition(
      pos => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        geoRef.current = c;
        setGeoCoords(c);
        setGeoPermission("granted");
        try { localStorage.setItem("geo_permission", "granted"); } catch {}
      },
      () => {
        setGeoPermission("denied");
        try { localStorage.setItem("geo_permission", "denied"); } catch {}
      },
      { timeout: 10000 }
    );
  };

  const profile = userData?.profile;
  const totalXP = profile?.total_points || 0;
  const currentLevel = getCurrentLevel(totalXP);
  const dataLoaded = userData !== null;

  // Auth loading — spinner minimal, ne pas afficher d'erreur
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--v1v-bg)" }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: "var(--v1v-green)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  // Non authentifié — afficher écran de connexion clair
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-8" style={{ background: "var(--v1v-bg)" }}>
        <p className="text-[8px] font-black uppercase tracking-[0.5em]" style={{ color: "var(--v1v-green-muted)" }}>W1LD Field OS</p>
        <p className="text-lg font-black uppercase tracking-[0.1em] text-center" style={{ color: "var(--v1v-fg)" }}>Connexion requise</p>
        <p className="text-[10px] text-center" style={{ color: "var(--v1v-fg-faint)" }}>Connecte-toi pour accéder à ton terrain.</p>
        <button
          onClick={() => navigateToLogin()}
          className="px-8 py-3 text-xs font-black uppercase tracking-[0.3em] transition-all active:scale-95"
          style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
        >
          Se connecter
        </button>
      </div>
    );
  }

  if (loadError) {
    const errType = loadError?.type || "unknown";
    const isAuth = errType === "auth";
    const isNetwork = errType === "network";
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8" style={{ background: "var(--v1v-bg)" }}>
        <WifiOff className="w-8 h-8" style={{ color: isAuth ? "rgba(196,154,10,0.5)" : "rgba(45,122,31,0.3)" }} />
        <p className="text-xs font-black uppercase tracking-[0.4em] text-center" style={{ color: isAuth ? "rgba(196,154,10,0.6)" : "rgba(45,122,31,0.5)" }}>
          {isAuth ? "Session expirée" : isNetwork ? "Hors ligne" : "Erreur de chargement"}
        </p>
        <p className="text-[10px] text-center" style={{ color: "rgba(45,122,31,0.35)" }}>
          {isAuth ? "Reconnecte-toi pour accéder à l'app." : isNetwork ? "Vérifie ta connexion et réessaie." : "Le serveur est temporairement indisponible."}
        </p>
        {loadError?.message && (
          <p className="text-[9px] font-mono text-center px-4" style={{ color: "rgba(45,122,31,0.25)", maxWidth: 280 }}>{loadError.message}</p>
        )}
        <button onClick={loadUserData} className="px-6 py-3 text-xs font-black uppercase tracking-[0.3em]" style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}>Réessayer</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>

      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        background: "radial-gradient(ellipse 70% 50% at 10% 0%, rgba(57,184,20,0.05) 0%, transparent 65%)"
      }} />

      {/* Toast — via portal pour échapper au stacking context */}
      {toast && createPortal(
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[9999] px-4 py-3 text-xs font-black uppercase tracking-wide flex items-center gap-3 max-w-sm w-[calc(100%-2rem)]"
          style={{
            top: "calc(52px + env(safe-area-inset-top) + 16px)",
            background: "var(--v1v-green)",
            color: "var(--v1v-bg)",
            boxShadow: "0 0 16px rgba(45,122,31,0.4)",
          }}
        >
          <Zap className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1 leading-snug">{toast}</span>
          <button className="opacity-40 text-base leading-none min-h-[44px] min-w-[44px] flex items-center justify-center" onClick={() => setToast(null)} aria-label="Dismiss">×</button>
        </div>,
        document.body
      )}

      {achievementQueue.length > 0 && (
        <AchievementToast achievements={achievementQueue} onDone={() => setAchievementQueue([])} />
      )}

      {levelUpData && (
        <LevelUpCelebration
          level={levelUpData.level}
          label={levelUpData.label}
          xp={levelUpData.xp}
          onClose={() => setLevelUpData(null)}
        />
      )}

      {showCamera && (
        <ErrorBoundary fallback={
          <div style={{ position: "fixed", inset: 0, background: "#F2EDE4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 50, gap: 16 }}>
            <p style={{ fontWeight: "bold", fontSize: 13, color: "#1A1A0F" }}>Erreur d'affichage. Ferme et réessaie.</p>
            <button onClick={() => setShowCamera(false)} style={{ padding: "12px 24px", background: "#2D7A1F", color: "#F2EDE4", fontWeight: "bold", fontSize: 12 }}>Fermer</button>
          </div>
        }>
          <CameraCapture onCapture={handleCapture} onClose={() => setShowCamera(false)} coords={geoCoords} isPro={profile?.is_pro || false} />
        </ErrorBoundary>
      )}


      {result && capturedImage && (
        <PlantResult result={result} imageBase64={capturedImage} isPro={profile?.is_pro}
          onSave={handleSave} onClose={() => { setResult(null); setCapturedImage(null); }} />
      )}

      {identifying && !showCamera && !showAudio && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "rgba(0,0,0,0.92)" }}>

          {/* Photo en fond floutée */}
          {capturedImage && (
            <div className="absolute inset-0">
              <img src={capturedImage} alt="" className="w-full h-full object-cover"
                style={{ opacity: 0.15, filter: "blur(8px)", transform: "scale(1.05)" }} />
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center px-8 w-full max-w-sm">

            {/* Photo nette au centre */}
            {capturedImage && (
              <div className="relative mb-8" style={{ width: 140, height: 140 }}>
                <img src={capturedImage} alt="" className="w-full h-full object-cover"
                  style={{ border: "2px solid var(--v1v-green)", opacity: 1 }} />
                {/* Scan line animée */}
                <div className="absolute inset-0 overflow-hidden">
                  <div style={{
                    position: "absolute", left: 0, right: 0, height: "2px",
                    background: "var(--v1v-green)",
                    boxShadow: "0 0 8px var(--v1v-green)",
                    animation: "scanLine 2s ease-in-out infinite"
                  }} />
                </div>
                {/* Coins */}
                <span className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: "var(--v1v-green)" }} />
                <span className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: "var(--v1v-green)" }} />
                <span className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: "var(--v1v-green)" }} />
                <span className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: "var(--v1v-green)" }} />
              </div>
            )}

            {/* Phase label */}
            <p className="text-[9px] tracking-[0.5em] uppercase mb-3 font-black"
              style={{ color: "rgba(45,122,31,0.6)" }}>
              {scanPhase <= 1 && "Détection en cours..."}
              {scanPhase === 2 && "Analyse de l'espèce..."}
              {scanPhase >= 3 && "Identification finale..."}
            </p>

            {/* Barre de progression simulée */}
            <div className="w-full h-0.5 mb-6" style={{ background: "rgba(45,122,31,0.15)" }}>
              <div className="h-0.5 transition-all duration-1000 ease-out"
                style={{
                  background: "var(--v1v-green)",
                  width: scanTimeout ? "95%" : scanPhase === 1 ? "30%" : scanPhase === 2 ? "65%" : "90%",
                  boxShadow: "0 0 6px var(--v1v-green)"
                }} />
            </div>

            {/* Titre principal */}
            <p className="text-2xl font-black uppercase tracking-[0.2em] mb-2"
              style={{ color: "var(--v1v-green)" }}>
              {scanTimeout ? "Toujours en cours..." : "Identification"}
            </p>

            {/* Sous-titre dynamique */}
            <p className="text-xs tracking-[0.3em] uppercase text-center"
              style={{ color: "rgba(45,122,31,0.5)" }}>
              {scanTimeout
                ? "Le réseau est lent — encore quelques secondes"
                : scanPhase <= 1 ? "Reconnaissance de l'espèce"
                : scanPhase === 2 ? "Consultation de la base de données"
                : "Finalisation de l'identification"
              }
            </p>

            {/* Bouton annuler — apparaît après 20s */}
            {scanTimeout && (
              <button
                onClick={() => { setIdentifying(false); setScanTimeout(false); setScanPhase(0); }}
                className="mt-8 text-xs uppercase tracking-widest font-black px-6 py-3"
                style={{ border: "1px solid rgba(45,122,31,0.3)", color: "rgba(45,122,31,0.6)" }}
              >
                Annuler
              </button>
            )}
          </div>

          <style>{`
            @keyframes scanLine {
              0% { top: 0%; }
              50% { top: calc(100% - 2px); }
              100% { top: 0%; }
            }
          `}</style>
        </div>
      )}

      {saving && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: "var(--v1v-bg-overlay-heavy)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22 }}
        >
          <motion.p
            className="text-xs tracking-[0.5em] uppercase mb-8"
            style={{ color: "var(--v1v-green-muted)" }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Enregistrement en cours...
          </motion.p>
          <div className="relative mb-8">
            <motion.div
              className="w-20 h-20 rounded-full border-2"
              style={{ borderColor: "var(--v1v-green)", borderTopColor: "transparent" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
            >
              <Zap className="w-6 h-6 absolute inset-0 m-auto" style={{ color: "var(--v1v-green)" }} />
            </motion.div>
          </div>
          <motion.p
            className="text-3xl font-black uppercase tracking-[0.3em]"
            style={{ color: "var(--v1v-green)" }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
            Gain XP
          </motion.p>
          <motion.p
            className="text-xs tracking-[0.4em] uppercase mt-2"
            style={{ color: "var(--v1v-green-muted)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            Ajout à ton journal...
          </motion.p>
        </motion.div>
      )}

      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "var(--v1v-bg-overlay-full)" }}>
          <div className="w-full max-w-sm p-6 text-center" style={{ background: "var(--v1v-bg-card)", border: "1px solid var(--v1v-green-ghost)", boxShadow: "0 0 40px rgba(45,122,31,0.15)" }}>
            <Shield className="w-8 h-8 mx-auto mb-4" style={{ color: "var(--v1v-green)" }} />
            <p className="text-xs tracking-[0.5em] uppercase mb-3" style={{ color: "var(--v1v-green-muted)" }}>Limite quotidienne atteinte</p>
            <h2 className="text-2xl font-black uppercase tracking-wider mb-3" style={{ color: "var(--v1v-fg)" }}>Quota épuisé</h2>
            <p className="text-sm mb-6" style={{ color: "var(--v1v-fg-muted)" }}>5 scans gratuits utilisés aujourd'hui.<br/>Passe Elite — scans illimités.</p>
            <Link to={createPageUrl("Pricing")}>
              <button className="w-full py-4 text-sm font-black uppercase tracking-[0.3em] mb-3 transition-all" style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}>
                Débloquer l'accès Elite →
              </button>
            </Link>
            <button onClick={() => setShowLimitModal(false)} className="text-xs uppercase tracking-widest" style={{ color: "var(--v1v-green-muted)" }}>Annuler</button>
          </div>
        </div>
      )}

      <PullToRefresh onRefresh={loadUserData}>
        {/* ── HEADER COMPACT ── */}
        <div className="relative z-10 px-5" style={{
          background: "linear-gradient(180deg, rgba(5,12,5,1) 0%, var(--v1v-bg) 100%)",
          paddingTop: 16,
          paddingBottom: 12,
        }}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] tracking-[0.35em] uppercase font-black mb-0.5" style={{ color: "rgba(57,184,20,0.45)" }}>EXPLORATEUR EN MISSION</p>
              <p className="font-black uppercase leading-tight text-2xl tracking-[0.08em] truncate" style={{ color: G }}>
                {(userData?.user?.full_name?.split(" ")[0] || "RANGER").toUpperCase()}
              </p>
            </div>
            <Link to={createPageUrl("Profile")} aria-label="Profile" className="ml-3 flex-shrink-0">
              <div className="w-10 h-10 flex items-center justify-center transition-all active:opacity-60" style={{ border: `1px solid rgba(57,184,20,0.4)`, background: "rgba(57,184,20,0.08)" }}>
                <User className="w-4 h-4" style={{ color: G }} />
              </div>
            </Link>
          </div>
        </div>

        {/* BLOC 1 — Progression */}
        <BlockErrorBoundary label="Progression indisponible">
          {!dataLoaded ? (
            <div className="px-5 py-3">
              <SkeletonBlock className="h-12" style={{ border: "1px solid rgba(45,122,31,0.1)" }} />
            </div>
          ) : (
            <ScrollRevealSection>
              <div className="px-5 py-3">
                <XPLevelModule totalXP={totalXP} />
              </div>
            </ScrollRevealSection>
          )}
        </BlockErrorBoundary>

        {/* BLOC 2 — Zone actuelle + CTA explorer */}
        <BlockErrorBoundary label="Zone indisponible">
          {dataLoaded && geoPermission === "granted" && geoCoords && (
            <ScrollRevealSection>
              <div className="px-5 py-3">
                <LocalZoneWidget userEmail={userData?.user?.email} geoCoords={geoCoords} />
                <Link to={createPageUrl("TerritorialMap")} className="block mt-3">
                  <button className="w-full py-3 text-xs font-black uppercase tracking-[0.3em] transition-all" style={{ background: "rgba(45,122,31,0.2)", border: "1px solid rgba(45,122,31,0.4)", color: G }}>
                    Voir la carte de contrôle →
                  </button>
                </Link>
              </div>
            </ScrollRevealSection>
          )}
        </BlockErrorBoundary>

        {/* Geo permission banner */}
        {geoPermission === "unknown" && (
          <div className="mx-5 my-3 px-3 py-2.5 flex items-center gap-3 relative z-10" style={{ background: "rgba(45,122,31,0.07)", border: "1px solid rgba(45,122,31,0.2)" }}>
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: G }} />
            <p className="text-[9px] font-black uppercase tracking-wider flex-1" style={{ color: "var(--v1v-fg-muted)" }}>Géoloc requise pour territoires</p>
            <button onClick={requestGeo} className="text-[8px] font-black uppercase tracking-wider px-2.5 py-1.5 flex-shrink-0 transition-opacity active:opacity-60" style={{ background: G, color: "var(--v1v-bg)" }}>Autoriser</button>
          </div>
        )}

        {/* BLOC 2.5 — Zone actuelle status */}
        <BlockErrorBoundary label="Statut zone indisponible">
          {dataLoaded && userData?.user?.email && geoCoords && (
            <ScrollRevealSection>
              <div className="px-5 py-0">
                <CurrentZoneStatus
                  userEmail={userData.user.email}
                  lat={geoCoords.lat}
                  lng={geoCoords.lng}
                  userPlants={userData?.discoveries?.length || 0}
                />
              </div>
            </ScrollRevealSection>
          )}
        </BlockErrorBoundary>

        {/* BLOC 3 — Scanner principal */}
        <BlockErrorBoundary label="Scanner indisponible">
          <ScrollRevealSection>
            <div className="px-5 py-3 relative z-10">
              <button
              onClick={() => {
                feedback('scan', { haptic: true, sound: false });
                setShowCamera(true);
              }}
              onPointerDown={(e) => {
                e.currentTarget.style.transform = "scale(0.97)";
                feedback('tap', { haptic: true, sound: false });
              }}
              onPointerUp={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
              className="w-full relative overflow-hidden transition-all"
              style={{
                background: G,
                color: "var(--v1v-bg)",
                paddingTop: 40,
                paddingBottom: 40,
                boxShadow: "0 0 40px rgba(57,184,20,0.35), inset 0 0 60px rgba(0,0,0,0.15)",
              }}
            >
              <span className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2" style={{ borderColor: "rgba(0,0,0,0.4)" }} />
              <span className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2" style={{ borderColor: "rgba(0,0,0,0.4)" }} />
              <span className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2" style={{ borderColor: "rgba(0,0,0,0.4)" }} />
              <span className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2" style={{ borderColor: "rgba(0,0,0,0.4)" }} />
              <div className="flex flex-col items-center" style={{ position: "relative", zIndex: 1 }}>
                <div style={{ position: "relative", width: 56, height: 56, marginBottom: 10 }}>
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.35)", animation: "scanPulse 2.5s ease-in-out infinite" }} />
                  <div style={{ position: "absolute", inset: 10, borderRadius: "50%", border: "1.5px solid rgba(0,0,0,0.25)" }} />
                  <div style={{ position: "absolute", inset: 22, borderRadius: "50%", background: "rgba(0,0,0,0.3)" }} />
                </div>
                <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.45em", textTransform: "uppercase", color: "rgba(0,0,0,0.75)" }}>SCANNER BIODIV</p>
              </div>
            </button>
            <div className="flex items-center justify-center gap-3 mt-3">
              <div className="flex-1 h-px" style={{ background: "rgba(45,122,31,0.15)" }} />
              <p key={scanTextIdx} className="text-[9px] tracking-[0.4em] uppercase font-black" style={{ color: "rgba(57,184,20,0.45)", animation: "fadeInText 0.4s ease-in" }}>
                {SCAN_TEXTS[scanTextIdx]}
              </p>
              <div className="flex-1 h-px" style={{ background: "rgba(45,122,31,0.15)" }} />
            </div>
            </div>
          </ScrollRevealSection>
        </BlockErrorBoundary>

        {/* Spacer pour bottom nav */}
        <div className="h-32" aria-hidden="true" />

        <style>{`
         @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
         @keyframes skeletonPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }
         @keyframes cornerPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
         @keyframes fadeInText { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        </PullToRefresh>
        </div>
        );
        }