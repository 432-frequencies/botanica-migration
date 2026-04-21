import { useState, useEffect, useRef, Suspense, lazy } from "react";
import { createPortal } from "react-dom";
import { getUserDiscoveries, getUserProfile } from "@/api/getUserProfile";
import { saveDiscovery } from "@/api/saveDiscovery";
import { identifyPlant } from "@/api/identifyPlant";
import { identifySound } from "@/api/identifySound";
import { uploadPhoto } from "@/api/uploadPhoto";
import { getNearbyActivity } from "@/api/getNearbyActivity";
import { getNearbySpots } from "@/api/getNearbySpots";
import { getNearbyWildPhotos } from "@/api/getNearbyWildPhotos";
import { createPageUrl } from "@/utils";
import { feedback } from "@/utils/feedback";
import { User, Zap, Shield, WifiOff, MapPin, RefreshCw, Clock3, Users, Volume2 } from "lucide-react";
import { useScrollReveal } from "@/motion/hooks/useScrollReveal";
import { getCurrentLevel, getNextLevel } from "@/components/home/XPLevelBar";
import PullToRefresh from "@/components/shared/PullToRefresh";
import BlockErrorBoundary from "@/components/shared/BlockErrorBoundary";

import { Link } from "react-router-dom";
import { Component } from "react";
import { addToQueue, getQueueSummary, OFFLINE_QUEUE_EVENT, retryErroredQueueItems } from "@/utils/offlineQueue";
import { useIsActivePage } from "@/lib/ActivePageContext";
import { useAuth } from "@/lib/AuthContext";
import { hasLaunchAccess, shouldShowPremiumUpsell } from "@/lib/app-config";
import { translateLevelLabel, useTranslation } from "@/lib/i18n";
import { syncOfflineQueue } from "@/utils/syncQueue";
import { useCurrentZoneData } from "@/hooks/useCurrentZoneData";
import { usePremium } from "@/lib/PremiumContext";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const G = "var(--v1v-green)";
const CameraCapture = lazy(() => import("@/components/identify/CameraCapture"));
const AudioCapture = lazy(() => import("@/components/identify/AudioCapture"));
const PlantResult = lazy(() => import("@/components/identify/PlantResult"));
const SoundResult = lazy(() => import("@/components/identify/SoundResult"));
const AchievementToast = lazy(() => import("@/components/identify/AchievementToast"));
const LevelUpCelebration = lazy(() => import("@/components/shared/LevelUpCelebration"));

const MIN_SCAN_MS = 3200;
const IS_DEV = import.meta.env.DEV;

function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

function getScanPhaseLabel(progress, t) {
  if (progress < 20) return t("home.scanPhase1");
  if (progress < 58) return t("home.scanPhase2");
  if (progress < 88) return t("home.scanPhase3");
  if (progress < 100) return t("home.scanPhase4");
  return t("home.scanDone");
}

function getAudioPhaseLabel(progress, t) {
  if (progress < 24) return t("home.audioPhase1");
  if (progress < 58) return t("home.audioPhase2");
  if (progress < 88) return t("home.audioPhase3");
  if (progress < 100) return t("home.audioPhase4");
  return t("home.scanDone");
}

function debugLog(...args) {
  if (IS_DEV) {
    console.log(...args);
  }
}

function debugError(...args) {
  if (IS_DEV) {
    console.error(...args);
  }
}

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
    <div
      ref={ref}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 280ms ease-out, transform 280ms ease-out",
      }}
    >
      {children}
    </div>
  );
}

function ModalFallback({ label }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.82)" }}>
      <div className="px-6 py-5 text-center" style={{ background: "var(--v1v-bg-card)", border: "1px solid var(--v1v-green-ghost)" }}>
        <div className="w-7 h-7 rounded-full border-2 mx-auto mb-3 animate-spin" style={{ borderColor: "var(--v1v-green)", borderTopColor: "transparent" }} />
        <p className="text-[9px] font-black uppercase tracking-[0.35em]" style={{ color: "var(--v1v-green-faint)" }}>{label}</p>
      </div>
    </div>
  );
}

function ScanOverlay({ image, progress, phase, timedOut, onCancel, mode = "visual", t }) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress || 0)));
  const confirmed = safeProgress >= 100;
  const isAudio = mode === "audio";
  const title = confirmed ? t("home.overlayConfirmed") : isAudio ? t("home.overlayListening") : t("home.overlayReading");
  const subtitle = timedOut
    ? isAudio
      ? t("home.overlayAudioSlow")
      : t("home.overlayImageSlow")
    : confirmed
      ? t("home.overlayPreparing")
      : isAudio
        ? t("home.overlayAudioSubtitle")
        : t("home.overlayImageSubtitle");

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{
        "--scan-progress": `${safeProgress}%`,
        background: "#020604",
        color: "var(--v1v-fg)",
        animation: "scanOverlayFade 220ms ease-out both",
      }}
      aria-live="polite"
    >
      {image && (
        <>
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              filter: "blur(24px) brightness(0.48) saturate(1.1)",
              transform: "scale(1.08)",
              opacity: 0.62,
            }}
          />
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-contain"
            style={{
              filter: "brightness(0.94) saturate(1.08) contrast(1.04)",
            }}
          />
        </>
      )}
      {!image && isAudio && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex h-40 w-40 items-center justify-center rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(174,255,188,0.18), rgba(57,184,20,0.05) 55%, transparent 72%)",
              border: "1px solid rgba(174,255,188,0.18)",
              boxShadow: "0 0 80px rgba(57,184,20,0.18)",
              animation: "scanBreath 2.4s ease-in-out infinite",
            }}
          >
            <Volume2 className="h-16 w-16" style={{ color: "rgba(174,255,188,0.82)" }} />
          </div>
        </div>
      )}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.28)" }} />
      <div
        className="scan-atmosphere absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, rgba(174,255,188,0.2) 0%, transparent 34%), radial-gradient(circle at 20% 72%, rgba(57,184,20,0.12) 0%, transparent 30%), linear-gradient(180deg, rgba(1,8,4,0.08) 0%, rgba(1,8,4,0.72) 100%)",
          boxShadow: "inset 0 0 120px rgba(0,255,150,0.14)",
        }}
      />
      <div className="scan-grain absolute inset-0 pointer-events-none" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="scan-line" />
        <div className="scan-glow-band" />
      </div>
      <div className="absolute inset-5 pointer-events-none" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="scan-corner scan-corner-tl" />
        <div className="scan-corner scan-corner-tr" />
        <div className="scan-corner scan-corner-bl" />
        <div className="scan-corner scan-corner-br" />
      </div>

      <div
        className="absolute left-0 right-0 px-5"
        style={{
          top: "calc(18px + env(safe-area-inset-top))",
        }}
      >
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
          <div
            className="rounded-full px-4 py-2"
            style={{
              background: "rgba(3,12,7,0.5)",
              border: "1px solid rgba(174,255,188,0.18)",
              backdropFilter: "blur(16px)",
            }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "rgba(222,255,232,0.82)" }}>
              {t("home.seeDifferently")}
            </p>
          </div>
          <div
            className="h-11 w-11 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(174,255,188,0.24), rgba(174,255,188,0.04) 62%, transparent 64%)",
              border: "1px solid rgba(174,255,188,0.22)",
              boxShadow: "0 0 28px rgba(57,184,20,0.28)",
              animation: "scanBreath 1.9s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      <div
        className="absolute left-0 right-0 px-6"
        style={{
          bottom: "calc(24px + env(safe-area-inset-bottom))",
        }}
      >
        <div
          className="mx-auto w-full max-w-md p-5"
          style={{
            background: "linear-gradient(145deg, rgba(4,14,8,0.68), rgba(3,9,5,0.52))",
            border: `1px solid ${confirmed ? "rgba(174,255,188,0.38)" : "rgba(135,255,181,0.22)"}`,
            borderRadius: 26,
            backdropFilter: "blur(18px)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-end justify-between gap-4 mb-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.38em]" style={{ color: "rgba(155,255,189,0.74)" }}>
                {isAudio ? t("home.listenModule") : t("home.readingLife")}
              </p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em]" style={{ color: "rgba(243,255,246,0.96)" }}>
                {title}
              </p>
              <p className="mt-2 text-sm font-black" style={{ color: "rgba(174,255,188,0.88)" }}>
                {timedOut ? t("home.timedOutPhase") : phase}
              </p>
            </div>
            <p className="text-4xl font-black tabular-nums tracking-[-0.08em]" style={{ color: "rgba(160,255,190,0.96)" }}>
              {safeProgress}%
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden" style={{ background: "rgba(190,255,205,0.12)", borderRadius: 999 }}>
            <div
              className="h-full"
              style={{
                width: `${safeProgress}%`,
                background: "linear-gradient(90deg, rgba(87,214,121,0.72), rgba(174,255,188,0.98), rgba(244,255,246,0.9))",
                boxShadow: "0 0 22px rgba(0,255,150,0.48)",
                transition: "width 300ms ease-out",
              }}
            />
          </div>
          <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "rgba(243,255,246,0.72)" }}>
            {subtitle}
          </p>
          {timedOut && (
            <button
              onClick={onCancel}
              className="mt-4 min-h-[44px] w-full text-[10px] font-black uppercase tracking-[0.28em]"
              style={{
                border: "1px solid rgba(155,255,189,0.22)",
                color: "rgba(210,255,220,0.72)",
                borderRadius: 14,
              }}
            >
              {t("home.cancelReading")}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .scan-grain {
          opacity: 0.16;
          background-image:
            linear-gradient(rgba(174,255,188,0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(174,255,188,0.05) 1px, transparent 1px);
          background-size: 44px 44px;
          mix-blend-mode: screen;
        }
        .scan-line {
          position: absolute;
          width: 100%;
          height: 3px;
          top: calc(100% - var(--scan-progress));
          background: linear-gradient(90deg, transparent, rgba(174,255,188,0.96), rgba(0,255,150,0.86), transparent);
          box-shadow: 0 0 14px rgba(0,255,150,0.72), 0 0 46px rgba(0,255,150,0.28);
          transition: top 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease;
        }
        .scan-glow-band {
          position: absolute;
          left: 0;
          right: 0;
          height: 104px;
          top: calc(100% - var(--scan-progress) - 52px);
          background: linear-gradient(180deg, transparent, rgba(174,255,188,0.13), rgba(0,255,150,0.07), transparent);
          filter: blur(3px);
          transition: top 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease;
        }
        .scan-corner {
          position: absolute;
          width: 42px;
          height: 42px;
          border-color: rgba(174,255,188,0.54);
          filter: drop-shadow(0 0 12px rgba(57,184,20,0.28));
        }
        .scan-corner-tl { top: 0; left: 0; border-top: 2px solid; border-left: 2px solid; }
        .scan-corner-tr { top: 0; right: 0; border-top: 2px solid; border-right: 2px solid; }
        .scan-corner-bl { bottom: 0; left: 0; border-bottom: 2px solid; border-left: 2px solid; }
        .scan-corner-br { bottom: 0; right: 0; border-bottom: 2px solid; border-right: 2px solid; }
        .scan-atmosphere {
          animation: scanBreath 2.8s ease-in-out infinite;
        }
        @keyframes scanOverlayFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scanBreath {
          0%, 100% { opacity: 0.82; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.015); }
        }
      `}</style>
    </div>
  );
}

function ObservationStatusOverlay({ image, mode = "saving", variant = "visual", t }) {
  const done = mode === "saved";
  const isAudio = variant === "audio";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden px-5"
      style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom))", animation: "observationFade 240ms ease-out both" }}
    >
      {image && (
        <>
          <img
            src={image}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: "blur(22px) brightness(0.5) saturate(1.04)", transform: "scale(1.08)", opacity: 0.58 }}
          />
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-contain" style={{ filter: "saturate(1.04) contrast(1.02)" }} />
        </>
      )}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.42)" }} />
      <div
        className="relative w-full max-w-md p-5"
        style={{
          background: "rgba(5,15,9,0.68)",
          border: done ? "1px solid rgba(174,255,188,0.26)" : "1px solid rgba(57,184,20,0.18)",
          borderRadius: 24,
          backdropFilter: "blur(20px)",
          boxShadow: "0 22px 64px rgba(0,0,0,0.44), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: done ? "rgba(174,255,188,0.16)" : "rgba(57,184,20,0.1)",
              border: "1px solid rgba(174,255,188,0.18)",
            }}
          >
            {done ? (
              <span className="text-xl" aria-hidden="true">✓</span>
            ) : (
              <div className="h-5 w-5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(174,255,188,0.9)", borderTopColor: "transparent" }} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.34em]" style={{ color: "rgba(174,255,188,0.68)" }}>
              {done ? t("home.observationSaved") : t("home.observationSaving")}
            </p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(244,255,246,0.86)" }}>
              {done
                ? isAudio
                  ? t("home.savedAudioThanks")
                  : t("home.savedVisualThanks")
                : isAudio
                  ? t("home.savingAudio")
                  : t("home.savingVisual")}
            </p>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes observationFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function QueueStatusCard({ queueStatus, syncingQueue, onSync, t }) {
  if (!queueStatus || (queueStatus.total === 0 && queueStatus.storageMode !== "memory")) {
    return null;
  }

  const hasErrors = queueStatus.error > 0;
  const hasPending = queueStatus.pending > 0 || queueStatus.processing > 0;
  const title = hasErrors
    ? t("home.queueTitleErrors")
    : hasPending
      ? t("home.queueTitlePending")
      : t("home.queueTitleTemp");
  const body = hasErrors
    ? t("home.queueBodyErrors")
    : hasPending
      ? t("home.queueBodyPending")
      : t("home.queueBodyTemp");

  return (
    <div
      className="v1v-surface-card-soft mt-3 p-4"
      style={{
        border: `1px solid ${hasErrors ? "rgba(232,122,0,0.28)" : "rgba(45,122,31,0.18)"}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 flex items-center justify-center flex-shrink-0"
          style={{
            background: hasErrors ? "rgba(232,122,0,0.12)" : "rgba(45,122,31,0.1)",
            borderRadius: 12,
          }}
        >
          {hasErrors ? (
            <RefreshCw className="w-4 h-4" style={{ color: "#E87A00" }} />
          ) : (
            <Clock3 className="w-4 h-4" style={{ color: G }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.32em] mb-1" style={{ color: hasErrors ? "#E87A00" : "rgba(57,184,20,0.55)" }}>
            {t("home.offlineQueue")}
          </p>
          <p className="text-sm font-black mb-1" style={{ color: "var(--v1v-fg)" }}>{title}</p>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>{body}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {queueStatus.pending > 0 && (
              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em]" style={{ background: "rgba(45,122,31,0.08)", color: G, borderRadius: 999 }}>
                {queueStatus.pending} {t("home.pendingShort")}
              </span>
            )}
            {queueStatus.processing > 0 && (
              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em]" style={{ background: "rgba(21,101,192,0.1)", color: "var(--v1v-blue)", borderRadius: 999 }}>
                {queueStatus.processing} {t("home.processingShort")}
              </span>
            )}
            {queueStatus.error > 0 && (
              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em]" style={{ background: "rgba(232,122,0,0.12)", color: "#E87A00", borderRadius: 999 }}>
                {queueStatus.error} {t("home.retryShort")}
              </span>
            )}
            {queueStatus.storageMode === "memory" && (
              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--v1v-fg-faint)", borderRadius: 999 }}>
                {t("home.temporaryStorage")}
              </span>
            )}
          </div>
          {(hasErrors || hasPending) && (
            <button
              onClick={onSync}
              disabled={syncingQueue}
              className="mt-3 min-h-[44px] px-4 text-[10px] font-black uppercase tracking-[0.24em] transition-opacity disabled:opacity-50"
              style={{ background: hasErrors ? "#E87A00" : G, color: "var(--v1v-bg)", borderRadius: 12 }}
            >
              {syncingQueue ? t("home.syncing") : hasErrors ? t("home.retryNow") : t("home.syncNow")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getUniqueSpeciesCount(discoveries = []) {
  const species = new Set();
  for (const discovery of discoveries) {
    const key = String(discovery?.scientific_name || discovery?.common_name || "").trim().toLowerCase();
    if (key) species.add(key);
  }
  return species.size;
}

function HomeHero({
  locationLabel,
  activeExplorers,
  geoPermission,
  onRequestGeo,
  onScan,
  onListen,
  t,
}) {
  return (
    <section
      className="relative w-full max-w-full overflow-hidden px-5 pt-7 pb-5"
      style={{
        background:
          "radial-gradient(circle at 20% 4%, rgba(174,255,188,0.12), transparent 34%), radial-gradient(circle at 88% 18%, rgba(111,180,161,0.1), transparent 32%)",
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.34em]" style={{ color: "rgba(174,255,188,0.52)" }}>
            {t("home.aroundYou")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" style={{ color: G }} />
              <p className="text-sm font-black" style={{ color: "var(--v1v-fg)" }}>
              {locationLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: "rgba(174,255,188,0.58)" }} />
              <p className="text-sm font-black" style={{ color: "rgba(244,255,246,0.7)" }}>
                {t("home.active", { count: activeExplorers })}
              </p>
            </div>
          </div>
        </div>
        <Link to={createPageUrl("Profile")} aria-label={t("home.profile")} className="flex-shrink-0">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <User className="h-4 w-4" style={{ color: "rgba(244,255,246,0.76)" }} />
          </div>
        </Link>
      </div>

        <button
          onClick={onScan}
        className="scanner-module group relative flex min-h-[168px] w-full items-center overflow-hidden rounded-[34px] p-4 text-left transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.985]"
          style={{
          background: "linear-gradient(145deg, #06100A 0%, #0B1A10 48%, #030604 100%)",
            color: "#F2EDE4",
          border: "1px solid rgba(174,255,188,0.24)",
          boxShadow: "0 22px 58px rgba(0,0,0,0.42), 0 0 38px rgba(57,184,20,0.16), inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
        >
          <div
          className="scanner-module-tint absolute inset-0 opacity-90 transition-opacity duration-300 group-hover:opacity-100"
            style={{
            background: "radial-gradient(circle at 22% 50%, rgba(174,255,188,0.26), transparent 34%), radial-gradient(circle at 80% 8%, rgba(111,180,161,0.12), transparent 28%), linear-gradient(90deg, rgba(255,255,255,0.06), transparent 44%)",
            }}
          />
        <div className="absolute -left-24 -top-20 h-56 w-56 rounded-full scanner-module-halo" />
        <div className="absolute -bottom-28 right-0 h-52 w-52 rounded-full scanner-module-halo-secondary" />
          <div className="relative flex w-full min-w-0 items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-5">
              <div
              className="scanner-core relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full"
                style={{
                background: "radial-gradient(circle, rgba(174,255,188,0.24), rgba(57,184,20,0.08) 54%, rgba(0,0,0,0.2) 100%)",
                border: "1px solid rgba(174,255,188,0.34)",
                boxShadow: "0 0 34px rgba(57,184,20,0.32), inset 0 0 24px rgba(174,255,188,0.08)",
                }}
              >
              <div className="absolute inset-3 rounded-full" style={{ border: "1px solid rgba(174,255,188,0.24)" }} />
              <div className="absolute inset-6 rounded-full" style={{ border: "1px solid rgba(174,255,188,0.14)" }} />
              <div className="h-5 w-5 rounded-full" style={{ background: "rgba(174,255,188,0.92)", boxShadow: "0 0 22px rgba(174,255,188,0.72)" }} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.36em]" style={{ color: "rgba(174,255,188,0.74)" }}>
                  {t("home.scannerModule")}
                </p>
              <p className="mt-2 text-[34px] font-black uppercase leading-none tracking-[-0.06em]" style={{ color: "#F2EDE4" }}>
                  {t("home.scanner")}
                </p>
              <p className="mt-3 text-[13px] font-black" style={{ color: "rgba(242,237,228,0.64)" }}>
                  {t("home.scannerSubtitle")}
                </p>
              </div>
            </div>
            <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-black transition-transform duration-300 group-hover:translate-x-1"
              style={{
                background: "rgba(174,255,188,0.14)",
                color: "rgba(222,255,232,0.94)",
                border: "1px solid rgba(174,255,188,0.2)",
              }}
            >
              →
            </div>
          </div>
        </button>

        <button
          onClick={onListen}
          className="mt-4 flex min-h-[64px] w-full items-center justify-between rounded-3xl px-5 text-left transition-transform active:scale-[0.985]"
          style={{
            background: "linear-gradient(135deg, rgba(174,255,188,0.08), rgba(111,180,161,0.045))",
            color: "var(--v1v-fg)",
            border: "1px solid rgba(174,255,188,0.14)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ background: "rgba(174,255,188,0.1)", border: "1px solid rgba(174,255,188,0.16)" }}
            >
              <Volume2 className="h-5 w-5" style={{ color: "rgba(174,255,188,0.84)" }} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: "rgba(174,255,188,0.62)" }}>
                {t("home.listenModule")}
              </p>
              <p className="mt-1 truncate text-sm font-black" style={{ color: "rgba(244,255,246,0.78)" }}>
                {t("home.listenSubtitle")}
              </p>
            </div>
          </div>
          <span className="text-xl font-black" style={{ color: "rgba(174,255,188,0.72)" }}>→</span>
        </button>

        {geoPermission !== "granted" && (
          <button
            onClick={onRequestGeo}
          className="relative mt-4 min-h-[44px] w-full rounded-2xl text-[10px] font-black uppercase tracking-[0.24em]"
          style={{ background: "rgba(255,255,255,0.045)", color: "rgba(244,255,246,0.66)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            {t("home.enableLocation")}
          </button>
        )}

      <style>{`
        .scanner-module {
          animation: scannerModuleBreath 7.5s ease-in-out infinite;
        }
        .scanner-module-tint {
          animation: scannerTintDrift 9s ease-in-out infinite;
        }
        .scanner-module-halo {
          background: rgba(174,255,188,0.14);
          filter: blur(28px);
          animation: scannerHaloBreath 8s ease-in-out infinite;
        }
        .scanner-module-halo-secondary {
          background: rgba(111,180,161,0.1);
          filter: blur(34px);
          animation: scannerHaloBreath 9.5s ease-in-out infinite reverse;
        }
        .scanner-core {
          animation: scannerCoreBreath 6.8s ease-in-out infinite;
        }
        @keyframes scannerModuleBreath {
          0%, 100% {
            box-shadow: 0 22px 58px rgba(0,0,0,0.42), 0 0 34px rgba(57,184,20,0.14), inset 0 1px 0 rgba(255,255,255,0.08);
            filter: brightness(1);
          }
          50% {
            box-shadow: 0 24px 62px rgba(0,0,0,0.46), 0 0 48px rgba(111,180,161,0.2), inset 0 1px 0 rgba(255,255,255,0.1);
            filter: brightness(1.035);
          }
        }
        @keyframes scannerTintDrift {
          0%, 100% { opacity: 0.74; }
          50% { opacity: 1; }
        }
        @keyframes scannerHaloBreath {
          0%, 100% { opacity: 0.58; transform: scale(0.98); }
          50% { opacity: 0.9; transform: scale(1.06); }
        }
        @keyframes scannerCoreBreath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.025); }
        }
      `}</style>
    </section>
  );
}

function formatNearbyDistance(distanceMeters, t) {
  const distance = Number(distanceMeters);
  if (!Number.isFinite(distance)) return t("common.nearYou");
  if (distance >= 1000) return `${(distance / 1000).toFixed(distance >= 10000 ? 0 : 1)} km`;
  return `${Math.max(40, Math.round(distance / 5) * 5)} m`;
}

function getCoordsDistanceMeters(from, to) {
  const lat1 = Number(from?.lat);
  const lng1 = Number(from?.lng);
  const lat2 = Number(to?.lat);
  const lng2 = Number(to?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Infinity;

  const earthRadius = 6371000;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function shouldUpdateCoords(previous, next) {
  if (!previous) return true;
  return getCoordsDistanceMeters(previous, next) > 25;
}

function LocalOpportunityCard({ spot, t }) {
  const habitatLabel = spot?.habitatLabel || t("home.livingPlace");

  return (
    <section className="w-full max-w-full overflow-hidden px-5">
      <div className="v1v-surface-card-soft p-5" style={{ borderRadius: 26, border: "1px solid rgba(174,255,188,0.14)" }}>
        <p className="text-[9px] font-black uppercase tracking-[0.32em]" style={{ color: "rgba(174,255,188,0.58)" }}>
          {t("home.localOpportunity")}
        </p>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black leading-tight tracking-[-0.04em]" style={{ color: "var(--v1v-fg)" }}>
              {spot?.name || t("home.nearbyPlace")}
            </h2>
            <p className="mt-1 text-sm font-black" style={{ color: G }}>
              {formatNearbyDistance(spot?.distanceMeters, t)} · {habitatLabel}
            </p>
          </div>
          <MapPin className="mt-1 h-5 w-5 flex-shrink-0" style={{ color: "rgba(174,255,188,0.72)" }} />
        </div>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
          {spot?.opportunity || t("home.opportunityFallback")}
        </p>
      </div>
    </section>
  );
}

function PersonalProgressCard({ totalXP, language, t }) {
  const current = getCurrentLevel(totalXP);
  const next = getNextLevel(totalXP);
  const progress = next ? Math.min(100, ((totalXP - current.xp) / (next.xp - current.xp)) * 100) : 100;
  const observationsBeforeNext = next ? Math.max(1, Math.ceil((next.xp - totalXP) / 15)) : 0;
  const currentLabel = translateLevelLabel(current?.label || t("home.explorer"), language);
  const nextLabel = next ? translateLevelLabel(next.label, language) : "";

  return (
    <section className="w-full max-w-full overflow-hidden px-5">
      <div className="v1v-surface-card-soft p-5" style={{ borderRadius: 26, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.32em]" style={{ color: "var(--v1v-fg-faint)" }}>
              {t("home.personalProgress")}
            </p>
            <h2 className="mt-2 text-xl font-black" style={{ color: "var(--v1v-fg)" }}>
              {currentLabel}
            </h2>
          </div>
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black"
            style={{ background: "rgba(57,184,20,0.12)", color: G, border: "1px solid rgba(57,184,20,0.2)" }}
          >
            {current?.level || 1}
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, rgba(116,227,137,0.86), rgba(174,255,188,0.96))",
              boxShadow: "0 0 18px rgba(57,184,20,0.28)",
              transition: "width 600ms ease",
            }}
          />
        </div>
        <p className="mt-3 text-sm" style={{ color: "var(--v1v-fg-muted)" }}>
          {next
            ? t("home.observationsBefore", {
                count: observationsBeforeNext,
                plural: observationsBeforeNext > 1 ? "s" : "",
                label: nextLabel,
              })
            : t("home.rareMilestone")}
        </p>
      </div>
    </section>
  );
}

function LocalImpactCard({ speciesCount, observationsCount, territoriesCount, t }) {
  const items = [
    { label: t("home.species"), value: speciesCount },
    { label: t("home.observations"), value: observationsCount },
    { label: t("home.territories"), value: territoriesCount },
  ];

  return (
    <section className="w-full max-w-full overflow-hidden px-5">
      <div className="v1v-surface-card-soft p-5" style={{ borderRadius: 26, border: "1px solid rgba(111,180,161,0.14)" }}>
        <p className="text-[9px] font-black uppercase tracking-[0.32em]" style={{ color: "rgba(111,180,161,0.64)" }}>
          {t("home.localImpact")}
        </p>
        <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {items.map((item) => (
            <div key={item.label} className="min-w-0 rounded-2xl px-3 py-3" style={{ background: "rgba(255,255,255,0.035)" }}>
              <p className="text-2xl font-black tabular-nums" style={{ color: "var(--v1v-fg)" }}>
                {item.value}
              </p>
              <p className="mt-1 truncate text-[8px] font-black uppercase leading-tight tracking-[0.1em]" style={{ color: "var(--v1v-fg-faint)" }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatPhotoDistance(distanceMeters, t) {
  if (!Number.isFinite(distanceMeters)) return t("common.nearYou");
  if (distanceMeters < 1000) return `${Math.max(60, Math.round(distanceMeters / 10) * 10)} m`;
  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10000 ? 1 : 0)} km`;
}

function WildPhotosCard({ photos = [], hasPreciseLocation, t }) {
  const hasPhotos = photos.length > 0;
  const verifiedWild = photos.some((photo) => photo.contextVerified);
  const referenceFallback = hasPhotos && photos.every((photo) => photo.source === "reference");
  const referenceCount = Math.max(0, photos.length);

  return (
    <section className="w-full max-w-full overflow-x-clip px-5">
      <div
        className="relative min-w-0 overflow-hidden p-5"
        style={{
          borderRadius: 30,
          background: "linear-gradient(145deg, rgba(8,22,13,0.9), rgba(2,7,4,0.96))",
          border: "1px solid rgba(174,255,188,0.13)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full"
          style={{
            background: "rgba(174,255,188,0.1)",
            filter: "blur(34px)",
          }}
        />

        <div className="relative mb-5 flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="text-[9px] font-black uppercase tracking-[0.34em]" style={{ color: "rgba(174,255,188,0.56)" }}>
              {t("home.lifeAround")}
            </p>
            <h2
              className="mt-2 max-w-full text-[1.12rem] font-black leading-tight tracking-[-0.035em] sm:text-2xl"
              style={{
                color: "var(--v1v-fg)",
                overflowWrap: "anywhere",
                wordBreak: "normal",
                hyphens: "auto",
              }}
            >
              {t("home.speciesNearYou")}
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(244,255,246,0.58)" }}>
              {!hasPhotos
                ? t("home.syncingReferences")
                : referenceFallback
                ? t("home.closestReferences")
                : verifiedWild && hasPreciseLocation
                ? t("home.outsideNow")
                : t("home.recentClues")}
            </p>
          </div>
          <div
            className="hidden shrink-0 rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-[0.2em] sm:block"
            style={{ color: "rgba(174,255,188,0.7)", background: "rgba(174,255,188,0.07)" }}
          >
            {hasPhotos ? `${referenceCount} ${referenceFallback ? t("home.references") : t("home.clues")}` : t("common.soon")}
          </div>
        </div>

        {hasPhotos ? (
          <div
            className="relative flex gap-3 overflow-x-auto pb-1"
            style={{
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              overscrollBehaviorX: "contain",
              touchAction: "pan-x",
            }}
          >
            {photos.map((photo, index) => (
            <article
              key={photo.id || `${photo.photoUrl}-${index}`}
              className="group relative h-48 w-[148px] shrink-0 overflow-hidden rounded-[24px]"
              style={{
                scrollSnapAlign: "start",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 18px 42px rgba(0,0,0,0.32)",
              }}
            >
              {photo.photoUrl ? (
                <img
                  src={photo.photoUrl}
                  alt={photo.commonName}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 34%, rgba(174,255,188,0.16), transparent 34%), linear-gradient(145deg, rgba(15,39,25,0.95), rgba(3,10,6,0.98))",
                  }}
                >
                  <div
                    className="mb-3 h-12 w-12 rounded-full"
                    style={{
                      border: "1px solid rgba(174,255,188,0.24)",
                      boxShadow: "0 0 34px rgba(174,255,188,0.12), inset 0 0 18px rgba(174,255,188,0.08)",
                    }}
                  />
                  <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(174,255,188,0.5)" }}>
                    {t("home.localReference")}
                  </p>
                </div>
              )}
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.1) 42%, rgba(0,0,0,0.76) 100%)" }} />
              <div
                className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em]"
                style={{ background: "rgba(2,7,4,0.56)", color: "rgba(222,255,232,0.78)", backdropFilter: "blur(10px)" }}
              >
                {formatPhotoDistance(photo.distanceMeters, t)}
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="truncate text-[12px] font-black leading-tight" style={{ color: "rgba(244,255,246,0.94)" }}>
                  {photo.commonName}
                </p>
                {photo.scientificName && (
                  <p className="mt-1 truncate text-[10px] italic" style={{ color: "rgba(244,255,246,0.56)" }}>
                    {photo.scientificName}
                  </p>
                )}
              </div>
            </article>
            ))}
          </div>
        ) : (
          <div
            className="rounded-[24px] px-5 py-6"
            style={{
              background: "rgba(174,255,188,0.045)",
              border: "1px solid rgba(174,255,188,0.11)",
            }}
          >
            <p className="text-sm font-bold leading-relaxed" style={{ color: "rgba(244,255,246,0.72)" }}>
              {t("home.noReference")}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const isActive = useIsActivePage("Home");
  const { language, t } = useTranslation();
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const { isPremium, isAvailable: premiumAvailable } = usePremium();
  const hasLoadedRef = useRef(false);
  const [userData, setUserData] = useState(null);
  const [discoveries, setDiscoveries] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showAudioCapture, setShowAudioCapture] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [result, setResult] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [geoCoords, setGeoCoords] = useState(null);
  const [geoPermission, setGeoPermission] = useState(() => {
    try { return localStorage.getItem("geo_permission") || "unknown"; } catch { return "unknown"; }
  });
  const [scanProgress, setScanProgress] = useState(0);
  const [scanTimeout, setScanTimeout] = useState(false);
  const [identifyMode, setIdentifyMode] = useState("plant");
  const [levelUpData, setLevelUpData] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [savedObservation, setSavedObservation] = useState(null);
  const [nearbyActivity, setNearbyActivity] = useState(null);
  const [nearbySpots, setNearbySpots] = useState([]);
  const [nearbyWildPhotos, setNearbyWildPhotos] = useState([]);
  const geoRef = useRef(null);
  const capturedImageRef = useRef(null);
  const scanPulseRef = useRef(0);

  const refreshQueueStatus = async () => {
    try {
      const summary = await getQueueSummary();
      setQueueStatus(summary);
    } catch {
      setQueueStatus(null);
    }
  };

  const currentZoneData = useCurrentZoneData({
    userEmail: userData?.user?.email,
    discoveries,
    geoCoords,
    active: isActive && !!userData?.user?.email && geoPermission === "granted",
    nearbyRadius: 3,
    includeOwnedZonesCount: true,
  });

  const clearCapturedMedia = () => {
    if (capturedImageRef.current) {
      URL.revokeObjectURL(capturedImageRef.current);
      capturedImageRef.current = null;
    }
    setCapturedImage(null);
    setCapturedBlob(null);
  };

  const setCapturedMedia = (blob) => {
    if (!blob) {
      clearCapturedMedia();
      return null;
    }

    if (capturedImageRef.current) {
      URL.revokeObjectURL(capturedImageRef.current);
    }

    const objectUrl = URL.createObjectURL(blob);
    capturedImageRef.current = objectUrl;
    setCapturedBlob(blob);
    setCapturedImage(objectUrl);
    return objectUrl;
  };

  useEffect(() => () => {
    if (capturedImageRef.current) {
      URL.revokeObjectURL(capturedImageRef.current);
      capturedImageRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshQueueStatus();

    const handleQueueChange = () => { void refreshQueueStatus(); };
    window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
    window.addEventListener("focus", handleQueueChange);
    window.addEventListener("online", handleQueueChange);

    return () => {
      window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
      window.removeEventListener("focus", handleQueueChange);
      window.removeEventListener("online", handleQueueChange);
    };
  }, [isAuthenticated]);

  // Ne charger qu'à la première activation de la page
  // isActive est la dépendance — se déclenche à la première activation
  useEffect(() => {
    if (!isActive || hasLoadedRef.current) return;
    // Ne pas charger si l'auth n'est pas encore résolue ou si non authentifié
    if (isLoadingAuth) return;
    if (!isAuthenticated) return; // App.jsx/AuthContext gérera la redirection
    hasLoadedRef.current = true;
    loadUserData({ includeDiscoveries: false }).then((profileData) => {
      void loadDiscoveries(profileData?.user?.email);
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get("openCamera") === "true") {
      setShowCamera(true);
      // Nettoyer l'URL sans rechargement
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [isActive, isAuthenticated, isLoadingAuth]);

  useEffect(() => {
    if (!isActive || !isAuthenticated || geoPermission !== "granted") return undefined;
    if (!navigator.geolocation?.watchPosition) return undefined;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!shouldUpdateCoords(geoRef.current, c)) return;
        geoRef.current = c;
        setGeoCoords(c);
      },
      () => {},
      { timeout: 12000, maximumAge: 60000, enableHighAccuracy: false }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [geoPermission, isActive, isAuthenticated]);

  useEffect(() => {
    if (!identifying) return;

    const progressTimer = window.setInterval(() => {
      setScanProgress((current) => {
        if (current >= 96) return current;
        const increment = current < 12 ? 2.4 : current < 42 ? 3.8 : current < 75 ? 2.4 : current < 92 ? 1.1 : 0.32;
        return Math.min(96, current + increment);
      });
    }, 160);

    return () => window.clearInterval(progressTimer);
  }, [identifying]);

  useEffect(() => {
    if (!identifying) {
      scanPulseRef.current = 0;
      return;
    }

    const milestones = [18, 52, 84];
    const nextMilestone = milestones[scanPulseRef.current];
    if (nextMilestone && scanProgress >= nextMilestone) {
      vibrate(8);
      scanPulseRef.current += 1;
    }
  }, [identifying, scanProgress]);

  useEffect(() => {
    if (userData === null) return;

    let cancelled = false;
    const coords = geoCoords || geoRef.current || null;

    Promise.all([
      getNearbyActivity({ coords, userEmail: userData?.user?.email }),
      getNearbySpots({ coords }),
      getNearbyWildPhotos({ coords }),
    ])
      .then(([activity, spots, photos]) => {
        if (cancelled) return;
        setNearbyActivity(activity);
        setNearbySpots(spots || []);
        setNearbyWildPhotos(photos || []);
      })
      .catch(() => {
        if (cancelled) return;
        setNearbyActivity({ activeExplorers: 9, radiusMeters: 2000 });
        setNearbySpots([]);
        setNearbyWildPhotos([]);
      });

    return () => {
      cancelled = true;
    };
  }, [geoCoords, userData]);

  const loadDiscoveries = async (userEmail) => {
    if (!userEmail) return;
    try {
      const nextDiscoveries = await getUserDiscoveries(userEmail);
      setDiscoveries(nextDiscoveries);
    } catch (error) {
      debugError("[Home] loadDiscoveries failed:", error?.message || error);
    }
  };

  const loadUserData = async ({ includeDiscoveries = true } = {}) => {
    setLoadError(false);
    try {
      // getUserProfile récupère auth + profil en une fois
      let profileData = null;
      try {
        profileData = await getUserProfile({ includeDiscoveries });
      } catch (profileErr) {
        debugError("[Home] getUserProfile failed:", profileErr?.message || profileErr);
        if (profileErr?.message === 'Unauthorized') {
          setLoadError({ type: "auth", message: "Non connecté" });
          return null;
        }
        // Degrade gracefully — show page without profile data
        profileData = { user: null, profile: null, achievements: [] };
      }
      setUserData(profileData);
      if (includeDiscoveries) {
        setDiscoveries(profileData?.discoveries || []);
      }

      const localOnboardingDone = localStorage.getItem("onboarding_completed") === "1";
      debugLog("[Home] onboarding check — local:", localOnboardingDone, "| backend:", profileData?.profile?.onboarding_completed);
      if (!localOnboardingDone && profileData?.profile && !profileData.profile.onboarding_completed) {
        window.location.href = createPageUrl("Onboarding");
      }
      // Nettoyage du flag local une fois le backend confirmé
      if (profileData?.profile?.onboarding_completed && localOnboardingDone) {
        localStorage.removeItem("onboarding_completed");
      }
      return profileData;
    } catch (e) {
      debugError("[Home] loadUserData unexpected error:", e?.message || e);
      setLoadError({ type: "unknown", message: e?.message });
      return null;
    }
  };

  const refreshHomeData = async () => {
    const profileData = await loadUserData({ includeDiscoveries: false });
    await loadDiscoveries(profileData?.user?.email);
  };

  const handleCapture = async (capturePayload) => {
    const captured = capturePayload?.blob instanceof Blob ? capturePayload.blob : null;

    if (!captured) {
      setToast(t("home.imageEmpty"));
      return;
    }

    setShowCamera(false);
    setIdentifying(true);
    setIdentifyMode("plant");
    setCapturedMedia(captured);
    setScanProgress(0);
    setScanTimeout(false);
    vibrate([10, 24, 10]);
    const timeoutTimer = setTimeout(() => setScanTimeout(true), 20000);
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

    let cleanBase64 = "";
    try {
      cleanBase64 = await blobToBase64(captured);
    } catch {
      clearTimeout(timeoutTimer);
      rollbackCounter();
      clearCapturedMedia();
      setIdentifying(false);
      setScanProgress(0);
      setToast(t("home.preparePhotoFailed"));
      return;
    }

    debugLog("[SCAN] identifyPlant start — imageLength:", cleanBase64.length);
    let res;
    const scanStartedAt = Date.now();
    try {
      const data = await identifyPlant({ imageBase64: cleanBase64 });
      const elapsed = Date.now() - scanStartedAt;
      if (elapsed < MIN_SCAN_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SCAN_MS - elapsed));
      }
      debugLog("[SCAN] identifyPlant success", {
        error: data?.error || null,
        hasTopResult: !!data?.top_result,
        category: data?.category || null,
        commonName: data?.top_result?.common_name || null,
      });
      res = { data };
    } catch (err) {
      clearTimeout(timeoutTimer);
      rollbackCounter();
      setIdentifying(false);
      setScanProgress(0);
      clearCapturedMedia();

      const msg = (err?.message || "").toLowerCase();
      const status = err?.status || err?.response?.status || 0;
      debugError("[SCAN] identifyPlant failed", { status, message: err?.message, imageLength: cleanBase64.length });

      // Vrai problème réseau uniquement → queue offline
      const isNetworkError = msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("network error") || msg.includes("timeout") || status === 0;

      if (isNetworkError) {
        const isPro = hasLaunchAccess(userData?.profile, isPremium);
        try {
          await addToQueue(cleanBase64, geoRef.current, isPro);
          setToast(t("home.networkQueued"));
        } catch (qErr) {
          setToast(qErr.message === "QUEUE_FULL"
            ? isPro ? t("camera.queueFullPro", { limit: 50 }) : t("camera.queueFullFree", { limit: 10 })
            : t("home.networkRetry")
          );
        }
      } else if (status === 401 || status === 403 || msg.includes("401") || msg.includes("unauthorized")) {
        setToast(t("home.sessionExpired"));
        window.setTimeout(() => navigateToLogin(), 900);
      } else if (status === 429 || msg.includes("limit_reached") || msg.includes("429")) {
        setShowLimitModal(true);
      } else if (status === 413 || msg.includes("413") || msg.includes("payload too large") || msg.includes("body too large")) {
        setToast(t("home.photoTooLarge"));
      } else if (msg.includes("réponse serveur invalide") || msg.includes("réponse vide du serveur") || msg.includes("unexpected token")) {
        setToast(t("home.incompleteScan"));
      } else if (status === 500 || msg.includes("500")) {
        setToast(t("home.serverError"));
      } else {
        setToast(t("home.scanError"));
      }
      return;
    }

    if (res.data?.error === "LIMIT_REACHED") { clearTimeout(timeoutTimer); rollbackCounter(); clearCapturedMedia(); setShowLimitModal(true); setIdentifying(false); setScanProgress(0); return; }
    if (res.data?.error === "FAKE_IMAGE") {
      clearTimeout(timeoutTimer);
      rollbackCounter();
      setToast(t("home.invalidPhoto"));
      setIdentifying(false); setScanProgress(0); clearCapturedMedia(); return;
    }
    if (res.data?.error === "NO_PLANT_FOUND") { clearTimeout(timeoutTimer); rollbackCounter(); clearCapturedMedia(); setToast(t("home.noSpecimenDetected")); setIdentifying(false); setScanProgress(0); return; }
    if (!res.data?.top_result?.common_name) {
      clearTimeout(timeoutTimer);
      rollbackCounter();
      setToast(t("home.unusableScan"));
      setIdentifying(false);
      setScanProgress(0);
      clearCapturedMedia();
      return;
    }
    clearTimeout(timeoutTimer);
    setScanProgress(100);
    vibrate([14, 34, 14]);
    await new Promise((resolve) => setTimeout(resolve, 760));
    setResult(res.data);
    setIdentifying(false);
  };

  const handleAudioCapture = async (audioPayload) => {
    if (!audioPayload?.audioBase64) {
      setToast(t("home.soundEmpty"));
      return;
    }

    setShowAudioCapture(false);
    setIdentifyMode("audio");
    clearCapturedMedia();
    setIdentifying(true);
    setScanProgress(0);
    setScanTimeout(false);
    vibrate([8, 22, 8]);

    const timeoutTimer = setTimeout(() => setScanTimeout(true), 22000);
    const countSnapshot = userData?.profile?.daily_identifications_count ?? 0;
    const rollbackCounter = () => setUserData(prev => prev ? {
      ...prev,
      profile: prev.profile ? { ...prev.profile, daily_identifications_count: countSnapshot } : prev.profile
    } : prev);

    setUserData(prev => {
      if (!prev) return prev;
      return { ...prev, profile: prev.profile ? { ...prev.profile, daily_identifications_count: (prev.profile.daily_identifications_count || 0) + 1 } : prev.profile };
    });

    try {
      const startedAt = Date.now();
      const data = await identifySound(audioPayload);
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_SCAN_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SCAN_MS - elapsed));
      }

      if (data?.error === "LIMIT_REACHED") {
        clearTimeout(timeoutTimer);
        rollbackCounter();
        setShowLimitModal(true);
        setIdentifying(false);
        setScanProgress(0);
        return;
      }

      if (!data?.common_name) {
        clearTimeout(timeoutTimer);
        rollbackCounter();
        setToast(t("home.soundNoResult"));
        setIdentifying(false);
        setScanProgress(0);
        return;
      }

      clearTimeout(timeoutTimer);
      setScanProgress(100);
      vibrate([12, 30, 12]);
      await new Promise((resolve) => setTimeout(resolve, 640));
      setResult(data);
      setIdentifying(false);
    } catch (error) {
      clearTimeout(timeoutTimer);
      rollbackCounter();
      setIdentifying(false);
      setScanProgress(0);
      const status = error?.status || 0;
      if (status === 401 || status === 403) {
        setToast(t("home.sessionExpired"));
        window.setTimeout(() => navigateToLogin(), 900);
      } else if (status === 429) {
        setShowLimitModal(true);
      } else {
        setToast(t("home.soundFailed"));
      }
    }
  };



  const handleSave = async ({ observationContext = "unknown" } = {}) => {
    if (!result) return;
    const top = identifyMode === "plant" ? result.top_result : result;
    const savedResult = result;
    const savedImage = capturedImage;
    const savedBlob = capturedBlob;

    // Snapshot pour rollback
    const snapshot = userData ? JSON.parse(JSON.stringify(userData)) : null;

    // Garde l'UI stable jusqu'au retour serveur pour éviter des stats fantômes.
    setSaving(true);
    setToast(t("home.transmittingObservation", { name: top.common_name }));

    try {
      let lat, lng;
      try {
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {}

      let photoUrl = "";
      const hasVisualMedia = Boolean(savedBlob || savedImage);
      if (hasVisualMedia) {
        try {
          photoUrl = await uploadPhoto(savedBlob || savedImage);
        } catch (e) {
          debugError("[SCAN][Home] UploadFile failed:", e?.message);
          setSaving(false);
          if (snapshot) setUserData(snapshot);
          window.dispatchEvent(new CustomEvent("optimistic-error", { detail: { message: t("home.uploadPhotoFailed") } }));
          return;
        }
      }
      const photoUploadFailed = hasVisualMedia && !photoUrl;

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
        edibility_status: top.edibility_status,
        safety_notes: top.safety_notes,
        description: top.description,
        habitat: top.habitat,
        ecological_role: top.ecological_role,
        biodiversity_importance: top.biodiversity_importance,
        edibility_details: top.edibility_details,
        medicinal_uses: top.medicinal_uses,
        anecdote: top.anecdote,
        observation_context: observationContext || "unknown",
      });

      if (saveRes?.error) {
        if (/unauthorized/i.test(saveRes.error)) {
          setToast(t("home.sessionExpired"));
          window.setTimeout(() => navigateToLogin(), 900);
        }
        throw new Error(saveRes.error);
      }

      // Succès — transition légère avant de revenir à la Home.
      setResult(null);
      setSaving(false);
      setSavedObservation({ image: savedImage, name: top.common_name });
      window.setTimeout(() => {
        setSavedObservation(null);
        clearCapturedMedia();
      }, 2600);
      vibrate([18, 45, 18]);
      const xp = saveRes?.xp_earned || 10;
      const lvl = saveRes?.level;
      const prevLvl = getCurrentLevel(snapshot?.profile?.total_points || 0)?.level;
      const levelUp = lvl && prevLvl && lvl > prevLvl;

      // Feedback haptique et sonore selon le résultat
      if (levelUp) {
        const newLevelData = getCurrentLevel((snapshot?.profile?.total_points || 0) + xp);
        setLevelUpData({
          level: newLevelData.level,
          label: newLevelData.label,
          xp: xp,
        });
      } else if (top.rarity === 'legendaire') {
        feedback('legendary', { haptic: true, sound: true });
        setToast(t("home.legendaryToast", { xp, name: top.common_name }));
      } else if (top.rarity === 'rare') {
        feedback('rare', { haptic: true, sound: false });
        setToast(t("home.rareToast", { xp, name: top.common_name }));
      } else {
        feedback('success', { haptic: true, sound: false });
        setToast(t("home.addedToJournal", { name: top.common_name }));
      }

      if (photoUploadFailed) {
        window.dispatchEvent(new CustomEvent("optimistic-error", {
          detail: { message: t("home.savedPhotoWarning") }
        }));
      }

      if (saveRes?.new_achievements?.length > 0) {
        setAchievementQueue(saveRes.new_achievements);
      }
      refreshHomeData();
      return { ok: true };

    } catch (err) {
      // Rollback — result et capturedImage sont toujours intacts, l'utilisateur peut réessayer
      if (snapshot) setUserData(snapshot);
      setSaving(false);
      setToast(null);
      window.dispatchEvent(new CustomEvent("optimistic-error", {
        detail: { message: t("home.saveFailed") }
      }));
      debugError("handleSave error:", err);
      return { ok: false };
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
        setToast(t("home.locationDenied"));
      },
      { timeout: 10000 }
    );
  };

  const profile = userData?.profile;
  const totalXP = profile?.total_points || 0;
  const hasFullAccess = hasLaunchAccess(profile, isPremium);
  const shouldOfferPremium = shouldShowPremiumUpsell(profile, isPremium) && premiumAvailable;
  const dataLoaded = userData !== null;
  const primarySpot = nearbySpots[0] || null;
  const activeExplorers = nearbyActivity?.activeExplorers || 8;
  const locationLabel = geoPermission === "granted"
    ? currentZoneData?.zoneName || t("home.nearbySector")
    : geoPermission === "denied"
      ? t("home.locationHidden")
      : t("home.locationNeeded");
  const speciesCount = getUniqueSpeciesCount(discoveries);
  const territoriesFromScores = Object.values(currentZoneData?.zoneScores || {}).filter((count) => count > 0).length;
  const territoriesCount = Math.max(currentZoneData?.ownedZonesCount || 0, territoriesFromScores);
  const openScanner = () => {
    feedback('scan', { haptic: true, sound: false });
    setShowCamera(true);
  };

  const openAudioScanner = () => {
    feedback('scan', { haptic: true, sound: false });
    setShowAudioCapture(true);
  };

  const handleQueueSync = async () => {
    if (!navigator.onLine) {
      setToast(t("home.syncWait"));
      return;
    }
    setSyncingQueue(true);
    try {
      const retried = await retryErroredQueueItems();
      await syncOfflineQueue();
      await refreshQueueStatus();
      if (retried > 0) {
        setToast(t("home.retryCount", { count: retried, plural: retried > 1 ? "s" : "" }));
      } else {
        setToast(t("home.syncRestarted"));
      }
    } catch {
      setToast(t("home.syncFailed"));
    } finally {
      setSyncingQueue(false);
    }
  };

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
        <p className="text-lg font-black uppercase tracking-[0.1em] text-center" style={{ color: "var(--v1v-fg)" }}>{t("home.authRequired")}</p>
        <p className="text-[10px] text-center" style={{ color: "var(--v1v-fg-faint)" }}>{t("home.authRequiredBody")}</p>
        <button
          onClick={() => navigateToLogin()}
          className="px-8 py-3 text-xs font-black uppercase tracking-[0.3em] transition-all active:scale-95"
          style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
        >
          {t("login.signIn")}
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
          {isAuth ? t("home.sessionExpired") : isNetwork ? t("home.offline") : t("home.loadingError")}
        </p>
        <p className="text-[10px] text-center" style={{ color: "rgba(45,122,31,0.35)" }}>
          {isAuth ? t("home.sessionExpiredBody") : isNetwork ? t("home.offlineBody") : t("home.serverUnavailable")}
        </p>
        {loadError?.message && (
          <p className="text-[9px] font-mono text-center px-4" style={{ color: "rgba(45,122,31,0.25)", maxWidth: 280 }}>{loadError.message}</p>
        )}
        <button onClick={refreshHomeData} className="px-6 py-3 text-xs font-black uppercase tracking-[0.3em]" style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}>{t("common.retry")}</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>

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
          <button className="opacity-40 text-base leading-none min-h-[44px] min-w-[44px] flex items-center justify-center" onClick={() => setToast(null)} aria-label={t("common.close")}>×</button>
        </div>,
        document.body
      )}

      {achievementQueue.length > 0 && (
        <Suspense fallback={null}>
          <AchievementToast achievements={achievementQueue} onDone={() => setAchievementQueue([])} />
        </Suspense>
      )}

      {levelUpData && (
        <Suspense fallback={null}>
          <LevelUpCelebration
            level={levelUpData.level}
            label={levelUpData.label}
            xp={levelUpData.xp}
            onClose={() => setLevelUpData(null)}
          />
        </Suspense>
      )}

      {showCamera && (
        <ErrorBoundary fallback={
          <div style={{ position: "fixed", inset: 0, background: "#F2EDE4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 50, gap: 16 }}>
            <p style={{ fontWeight: "bold", fontSize: 13, color: "#1A1A0F" }}>{t("home.scannerDisplayError")}</p>
            <button onClick={() => setShowCamera(false)} style={{ padding: "12px 24px", background: "#2D7A1F", color: "#F2EDE4", fontWeight: "bold", fontSize: 12 }}>{t("common.close")}</button>
          </div>
        }>
          <Suspense fallback={<ModalFallback label={t("home.openScanner")} />}>
            <CameraCapture onCapture={handleCapture} onClose={() => setShowCamera(false)} coords={geoCoords} isPro={hasFullAccess} />
          </Suspense>
        </ErrorBoundary>
      )}

      {showAudioCapture && (
        <ErrorBoundary fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.88)" }}>
            <div className="w-full max-w-sm p-6 text-center" style={{ background: "var(--v1v-bg-card)", border: "1px solid var(--v1v-green-ghost)" }}>
              <p className="text-[9px] font-black uppercase tracking-[0.35em] mb-3" style={{ color: "var(--v1v-green-faint)" }}>{t("home.listenUnavailable")}</p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--v1v-fg-muted)" }}>
                {t("home.listenUnavailableBody")}
              </p>
              <button
                onClick={() => setShowAudioCapture(false)}
                className="px-6 py-3 text-xs font-black uppercase tracking-[0.3em]"
                style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        }>
          <Suspense fallback={<ModalFallback label={t("home.openingListen")} />}>
            <AudioCapture onCapture={handleAudioCapture} onCancel={() => setShowAudioCapture(false)} />
          </Suspense>
        </ErrorBoundary>
      )}

      {result && identifyMode === "plant" && capturedImage && (
        <ErrorBoundary fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.88)" }}>
            <div className="w-full max-w-sm p-6 text-center" style={{ background: "var(--v1v-bg-card)", border: "1px solid var(--v1v-green-ghost)" }}>
              <p className="text-[9px] font-black uppercase tracking-[0.35em] mb-3" style={{ color: "var(--v1v-green-faint)" }}>{t("home.resultUnavailable")}</p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--v1v-fg-muted)" }}>
                {t("home.visualResultError")}
              </p>
              <button
                onClick={() => { setResult(null); clearCapturedMedia(); setIdentifying(false); setScanProgress(0); }}
                className="px-6 py-3 text-xs font-black uppercase tracking-[0.3em]"
                style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        }>
          <Suspense fallback={<ModalFallback label={t("home.preparingResult")} />}>
            <PlantResult result={result} imageBase64={capturedImage} isPro={hasFullAccess}
              onSave={handleSave} onClose={() => { setResult(null); clearCapturedMedia(); }} />
          </Suspense>
        </ErrorBoundary>
      )}

      {result && identifyMode === "audio" && (
        <ErrorBoundary fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "rgba(0,0,0,0.88)" }}>
            <div className="w-full max-w-sm p-6 text-center" style={{ background: "var(--v1v-bg-card)", border: "1px solid var(--v1v-green-ghost)" }}>
              <p className="text-[9px] font-black uppercase tracking-[0.35em] mb-3" style={{ color: "var(--v1v-green-faint)" }}>{t("home.resultUnavailable")}</p>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--v1v-fg-muted)" }}>
                {t("home.audioResultError")}
              </p>
              <button
                onClick={() => { setResult(null); setIdentifying(false); setScanProgress(0); }}
                className="px-6 py-3 text-xs font-black uppercase tracking-[0.3em]"
                style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        }>
          <Suspense fallback={<ModalFallback label={t("home.preparingAudioResult")} />}>
            <SoundResult
              result={result}
              onSave={handleSave}
              onRetry={() => { setResult(null); setShowAudioCapture(true); }}
              onClose={() => setResult(null)}
              saving={saving}
              userProfile={profile}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {identifying && !showCamera && !showAudioCapture && (
        <ScanOverlay
          image={capturedImage}
          progress={scanProgress}
          phase={identifyMode === "audio" ? getAudioPhaseLabel(scanProgress, t) : getScanPhaseLabel(scanProgress, t)}
          timedOut={scanTimeout}
          mode={identifyMode === "audio" ? "audio" : "visual"}
          t={t}
          onCancel={() => {
            setIdentifying(false);
            setScanTimeout(false);
            setScanProgress(0);
            clearCapturedMedia();
          }}
        />
      )}

      {saving && (
        <ObservationStatusOverlay image={capturedImage} mode="saving" variant={identifyMode === "audio" ? "audio" : "visual"} t={t} />
      )}

      {savedObservation && !saving && (
        <ObservationStatusOverlay image={savedObservation.image} mode="saved" variant={identifyMode === "audio" ? "audio" : "visual"} t={t} />
      )}

      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "var(--v1v-bg-overlay-full)" }}>
          <div className="w-full max-w-sm p-6 text-center" style={{ background: "var(--v1v-bg-card)", border: "1px solid var(--v1v-green-ghost)", boxShadow: "0 0 40px rgba(45,122,31,0.15)" }}>
            <Shield className="w-8 h-8 mx-auto mb-4" style={{ color: "var(--v1v-green)" }} />
            <p className="text-xs tracking-[0.5em] uppercase mb-3" style={{ color: "var(--v1v-green-muted)" }}>{t("home.quotaTitle")}</p>
            <h2 className="text-2xl font-black uppercase tracking-wider mb-3" style={{ color: "var(--v1v-fg)" }}>{t("home.quotaHeading")}</h2>
            <p className="text-sm mb-6" style={{ color: "var(--v1v-fg-muted)" }}>
              {t("home.quotaBody")}
            </p>
            {shouldOfferPremium ? (
              <Link to={createPageUrl("Pricing")} className="block">
                <button
                  onClick={() => setShowLimitModal(false)}
                  className="w-full py-4 text-sm font-black uppercase tracking-[0.3em] mb-3 transition-all"
                  style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
                >
                  {t("home.discoverPlus")}
                </button>
              </Link>
            ) : (
              <button
                onClick={() => setShowLimitModal(false)}
                className="w-full py-4 text-sm font-black uppercase tracking-[0.3em] mb-3 transition-all"
                style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
              >
                {t("home.continueExploration")}
              </button>
            )}
            <button onClick={() => setShowLimitModal(false)} className="text-xs uppercase tracking-widest" style={{ color: "var(--v1v-green-muted)" }}>{t("common.close")}</button>
          </div>
        </div>
      )}

      <PullToRefresh onRefresh={refreshHomeData}>
        {/* HERO — lisible en 3 secondes */}
        <BlockErrorBoundary label={t("home.scannerUnavailable")}>
          <ScrollRevealSection>
            <div className="relative z-10">
              <HomeHero
                locationLabel={locationLabel}
                activeExplorers={activeExplorers}
                geoPermission={geoPermission}
                onRequestGeo={requestGeo}
                onScan={openScanner}
                onListen={openAudioScanner}
                t={t}
              />
              <div className="px-5">
                <QueueStatusCard queueStatus={queueStatus} syncingQueue={syncingQueue} onSync={handleQueueSync} t={t} />
              </div>
            </div>
          </ScrollRevealSection>
        </BlockErrorBoundary>

        <div className="grid w-full max-w-full gap-4 overflow-x-hidden py-4">
          {/* OPPORTUNITÉ LOCALE */}
          <BlockErrorBoundary label={t("home.opportunityUnavailable")}>
            {!dataLoaded ? (
              <div className="px-5 py-3">
                <SkeletonBlock className="h-32 rounded-[26px]" style={{ border: "1px solid rgba(45,122,31,0.1)" }} />
              </div>
            ) : (
              <ScrollRevealSection>
                <LocalOpportunityCard spot={primarySpot} t={t} />
              </ScrollRevealSection>
            )}
          </BlockErrorBoundary>

          {/* PROGRESSION PERSONNELLE */}
          <BlockErrorBoundary label={t("home.progressUnavailable")}>
            {dataLoaded && (
              <ScrollRevealSection>
                <PersonalProgressCard totalXP={totalXP} language={language} t={t} />
              </ScrollRevealSection>
            )}
          </BlockErrorBoundary>

          {/* IMPACT LOCAL */}
          <BlockErrorBoundary label={t("home.impactUnavailable")}>
            {dataLoaded && (
              <ScrollRevealSection>
                <LocalImpactCard
                  speciesCount={speciesCount}
                  observationsCount={discoveries.length}
                  territoriesCount={territoriesCount}
                  t={t}
                />
              </ScrollRevealSection>
            )}
          </BlockErrorBoundary>

          {/* PREUVE VISUELLE LOCALE */}
          <BlockErrorBoundary label={t("home.photosUnavailable")}>
            {dataLoaded && (
              <ScrollRevealSection>
                <WildPhotosCard photos={nearbyWildPhotos} hasPreciseLocation={geoPermission === "granted"} t={t} />
              </ScrollRevealSection>
            )}
          </BlockErrorBoundary>
        </div>

        {/* Spacer pour bottom nav */}
        <div className="h-32" aria-hidden="true" />

        <style>{`
         @keyframes skeletonPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.2; } }
        `}</style>
        </PullToRefresh>
        </div>
        );
        }
