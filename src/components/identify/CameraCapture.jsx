import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera, X, WifiOff, Clock } from "lucide-react";
import { addToQueue, getQueueCount, QUEUE_LIMIT_PRO, QUEUE_LIMIT_FREE, getStorageMode } from "@/utils/offlineQueue";
import { useTranslation } from "@/lib/i18n";

const G = "#2D7A1F";
const ORANGE = "#E87A00";
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

export default function CameraCapture({ onCapture, onClose, coords, isPro = false }) {
  const { t } = useTranslation();
  const hasExtendedQueue = Boolean(isPro);
  const maxQueue = hasExtendedQueue ? QUEUE_LIMIT_PRO : QUEUE_LIMIT_FREE;
  const [preview, setPreview] = useState(null);
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [persistentStorage, setPersistentStorage] = useState(true);
  const [inlineMessage, setInlineMessage] = useState(null);
  const [awaitingPicker, setAwaitingPicker] = useState(false);
  const cameraRef = useRef();
  const previewRef = useRef(null);
  const compressedBlobRef = useRef(null);
  const awaitingPickerRef = useRef(false);

  const clearPreview = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreview(null);
    setCompressedBlob(null);
    compressedBlobRef.current = null;
  };

  useEffect(() => {
    awaitingPickerRef.current = awaitingPicker;
  }, [awaitingPicker]);

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    getQueueCount().then(setPendingCount);
    // Vérifier après init IndexedDB (légèrement différé)
    setTimeout(() => setPersistentStorage(getStorageMode() !== 'memory'), 600);

    const handleWindowFocus = () => {
      if (!awaitingPickerRef.current) return;
      window.setTimeout(() => {
        awaitingPickerRef.current = false;
        setAwaitingPicker(false);
        if (!previewRef.current && !compressedBlobRef.current) {
          setInlineMessage(t("camera.noPhoto"));
        }
      }, 250);
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [maxQueue]);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
        previewRef.current = null;
      }
    };
  }, []);

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 1536;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = (height * MAX) / width; width = MAX; }
            else { width = (width * MAX) / height; height = MAX; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);
          }
          const quality = Math.max(0.82, file.size > 5_000_000 ? 0.8 : 0.88);
          canvas.toBlob(
            (blob) => {
              if (IS_DEV && blob) {
                console.log(
                  "[SCAN] CameraCapture compressed — size:",
                  `${Math.round(blob.size / 1024)} KB`,
                  "| size:",
                  `${width}x${height}`,
                  "| quality:",
                  quality,
                );
              }
              resolve(blob || file);
            },
            "image/jpeg",
            quality,
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (file) => {
    awaitingPickerRef.current = false;
    setAwaitingPicker(false);
    if (!file) {
      setInlineMessage(t("camera.noSelection"));
      return;
    }
    setInlineMessage(null);
    setQueued(false);
    const blob = await compressImage(file);
    clearPreview();
    const previewUrl = URL.createObjectURL(blob);
    previewRef.current = previewUrl;
    compressedBlobRef.current = blob;
    setPreview(previewUrl);
    setCompressedBlob(blob);
  };

  const handleAnalyse = async () => {
    if (!compressedBlob) {
      setInlineMessage(t("camera.noImage"));
      return;
    }
    if (navigator.vibrate) navigator.vibrate(50);
    setInlineMessage(null);

    if (!isOnline) {
      // Offline — queue
      try {
        const imageBase64 = await blobToBase64(compressedBlob);
        await addToQueue(imageBase64, coords, hasExtendedQueue);
        const count = await getQueueCount();
        setPendingCount(count);
        setQueued(true);
        clearPreview();
      } catch (e) {
        if (e.message === "QUEUE_FULL") {
          setInlineMessage(hasExtendedQueue
            ? t("camera.queueFullPro", { limit: QUEUE_LIMIT_PRO })
            : t("camera.queueFullFree", { limit: QUEUE_LIMIT_FREE })
          );
        } else {
          setInlineMessage(t("camera.queueError"));
        }
      }
      return;
    }

    onCapture({ blob: compressedBlob });
  };

  const openPicker = () => {
    setInlineMessage(null);
    awaitingPickerRef.current = true;
    setAwaitingPicker(true);
    cameraRef.current?.click();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: "var(--v1v-bg)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)"
      }}
    >

      {/* Bannière hors ligne */}
      {!persistentStorage && (
        <div className="flex items-center gap-2 px-4 py-2" style={{ background: "rgba(180,100,0,0.85)" }}>
          <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: "#fff" }}>
            {t("camera.tempStorage")}
          </p>
        </div>
      )}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-2" style={{ background: ORANGE }}>
          <WifiOff className="w-3 h-3 flex-shrink-0" style={{ color: "#fff" }} />
          <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: "#fff" }}>
            {t("camera.offline")}
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(46,168,15,0.12)" }}>
        <div>
          <p className="text-[8px] tracking-[0.5em] uppercase" style={{ color: "var(--v1v-green-muted)" }}>{t("camera.title")}</p>
          <p className="text-xs font-black uppercase tracking-wider mt-0.5" style={{ color: "var(--v1v-fg)" }}>{t("camera.subtitle")}</p>
        </div>
        <button
          onClick={onClose}
          className="transition-opacity hover:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label={t("common.close")}
        >
          <X className="w-4 h-4" style={{ color: "var(--v1v-fg-faint)" }} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 overflow-y-auto">

        {/* Confirmation après mise en queue */}
        {queued && (
          <div className="w-full max-w-sm p-4 text-center" style={{ background: "rgba(232,122,0,0.08)", border: "1px solid rgba(232,122,0,0.3)" }}>
            <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: ORANGE }} />
            <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: ORANGE }}>
              {t("camera.photoSaved")}
            </p>
            <p className="text-[10px]" style={{ color: "rgba(26,26,15,0.6)" }}>
              {t("camera.pendingIdentification")}
            </p>
            <p className="text-[10px] font-black mt-1" style={{ color: ORANGE }}>
              {t("camera.pending", { count: pendingCount, limit: maxQueue })}
              </p>
            <button
              className="mt-3 text-[9px] font-black uppercase tracking-wider px-4 py-2"
              style={{ background: ORANGE, color: "#fff" }}
              onClick={() => setQueued(false)}
            >
              {t("camera.takeAnother")}
            </button>
          </div>
        )}

        {!queued && preview ? (
          <div className="w-full max-w-sm">
            <div
              className="w-full flex items-center justify-center overflow-hidden"
              style={{
                height: "min(54vh, 390px)",
                background: "rgba(2,10,5,0.55)",
                border: "1px solid rgba(46,168,15,0.22)",
                borderRadius: 18,
                boxShadow: "inset 0 0 42px rgba(46,168,15,0.08)",
              }}
            >
              <img
                src={preview}
                alt={t("camera.photoAlt")}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            {!isOnline && (
              <p className="text-[9px] font-black uppercase tracking-wider text-center mt-2" style={{ color: ORANGE }}>
                {t("camera.offlineQueue")}
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 py-3 text-xs font-black uppercase tracking-[0.3em] min-h-[44px]"
                style={{ border: "1px solid rgba(46,168,15,0.3)", color: G, background: "transparent" }}
                onClick={() => {
                  setInlineMessage(null);
                  clearPreview();
                }}
              >
                {t("camera.retake")}
              </button>
              <button
                className="flex-1 py-3 text-xs font-black uppercase tracking-[0.3em] min-h-[44px]"
                style={{ background: isOnline ? G : ORANGE, color: "var(--v1v-bg)" }}
                onClick={handleAnalyse}
              >
                {isOnline ? t("camera.analyze") : t("camera.queue")}
              </button>
            </div>
          </div>
        ) : !queued ? (
          <>
            <div
              className="w-56 h-56 flex items-center justify-center"
                style={{ border: "1px solid rgba(46,168,15,0.12)" }}
            >
              <Camera className="w-16 h-16" style={{ color: "rgba(45,122,31,0.2)" }} />
            </div>
            <p className="text-[9px] font-black tracking-[0.3em] uppercase text-center" style={{ color: "var(--v1v-green-muted)" }}>
              {t("camera.prompt")}
            </p>
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: "rgba(232,122,0,0.08)", border: "1px solid rgba(232,122,0,0.25)" }}>
                <Clock className="w-3 h-3 flex-shrink-0" style={{ color: ORANGE }} />
                <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: ORANGE }}>
                  {t("camera.pendingCount", { count: pendingCount, limit: maxQueue })}
                </p>
              </div>
            )}
            {inlineMessage && (
              <div className="w-full max-w-sm px-3 py-3" style={{ background: "rgba(232,122,0,0.08)", border: "1px solid rgba(232,122,0,0.25)" }}>
                <p className="text-[10px] leading-relaxed" style={{ color: ORANGE }}>
                  {inlineMessage}
                </p>
              </div>
            )}
            <div className="w-full max-w-sm flex flex-col gap-3">
              <button
                className="w-full py-5 text-sm font-black uppercase tracking-[0.4em] flex items-center justify-center gap-2 min-h-[44px]"
                style={{ background: G, color: "var(--v1v-bg)" }}
                onClick={openPicker}
              >
                <Camera className="w-5 h-5" /> {t("camera.addPhoto")}
              </button>

            </div>
          </>
        ) : null}
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
    </div>,
    document.body
  );
}
