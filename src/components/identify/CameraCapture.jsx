import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera, X, WifiOff, Clock } from "lucide-react";
import { addToQueue, getQueueCount, QUEUE_LIMIT_PRO, QUEUE_LIMIT_FREE, getStorageMode } from "@/utils/offlineQueue";

const G = "#2D7A1F";
const ORANGE = "#E87A00";

export default function CameraCapture({ onCapture, onClose, coords, isPro = false }) {
  const maxQueue = isPro ? QUEUE_LIMIT_PRO : QUEUE_LIMIT_FREE;
  const [preview, setPreview] = useState(null);
  const [compressed, setCompressed] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [persistentStorage, setPersistentStorage] = useState(true);
  const cameraRef = useRef();

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    getQueueCount().then(setPendingCount);
    // Vérifier après init IndexedDB (légèrement différé)
    setTimeout(() => setPersistentStorage(getStorageMode() !== 'memory'), 600);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 1024;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = (height * MAX) / width; width = MAX; }
            else { width = (width * MAX) / height; height = MAX; }
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          const b64 = dataUrl.split(',')[1];
          console.log("[SCAN] CameraCapture compressed — length:", b64.length, "~", Math.round(b64.length * 0.75 / 1024), "KB");
          resolve(dataUrl);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (file) => {
    if (!file) return;
    setQueued(false);
    const dataUrl = await compressImage(file);
    setPreview(dataUrl);                    // data URI complet pour <img src>
    setCompressed(dataUrl.split(",")[1]);   // base64 pur pour l'API
  };

  const handleAnalyse = async () => {
    if (!compressed) {
      alert("Image non disponible. Reprends la photo.");
      return;
    }
    if (navigator.vibrate) navigator.vibrate(50);

    if (!isOnline) {
      // Offline — queue
      try {
        await addToQueue(compressed, coords, isPro);
        const count = await getQueueCount();
        setPendingCount(count);
        setQueued(true);
        setPreview(null);
        setCompressed(null);
      } catch (e) {
        if (e.message === "QUEUE_FULL") {
          alert(isPro
            ? `File hors ligne pleine (${QUEUE_LIMIT_PRO}/${QUEUE_LIMIT_PRO}). Reconnecte-toi pour synchroniser.`
            : `File hors ligne pleine (${QUEUE_LIMIT_FREE}/${QUEUE_LIMIT_FREE}). Passe Pro pour stocker jusqu'à ${QUEUE_LIMIT_PRO} photos.`
          );
        } else {
          alert("Erreur lors de la mise en attente. Réessaie.");
        }
      }
      return;
    }

    onCapture(compressed);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--v1v-bg)", paddingTop: "44px" }}>

      {/* Bannière hors ligne */}
      {!persistentStorage && (
        <div className="flex items-center gap-2 px-4 py-2" style={{ background: "rgba(180,100,0,0.85)" }}>
          <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: "#fff" }}>
            Stockage temporaire sur cet appareil — les photos en attente peuvent être perdues si tu fermes l'app avant reconnexion.
          </p>
        </div>
      )}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-2" style={{ background: ORANGE }}>
          <WifiOff className="w-3 h-3 flex-shrink-0" style={{ color: "#fff" }} />
          <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: "#fff" }}>
            Hors ligne — La photo sera identifiée dès le retour du réseau
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(46,168,15,0.12)" }}>
        <div>
          <p className="text-[8px] tracking-[0.5em] uppercase" style={{ color: "var(--v1v-green-muted)" }}>W1LD — Scan</p>
          <p className="text-xs font-black uppercase tracking-wider mt-0.5" style={{ color: "var(--v1v-fg)" }}>Identifier un specimen</p>
        </div>
        <button
          onClick={onClose}
          className="transition-opacity hover:opacity-50 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" style={{ color: "var(--v1v-fg-faint)" }} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-6 gap-6" style={{ paddingTop: "2rem" }}>

        {/* Confirmation après mise en queue */}
        {queued && (
          <div className="w-full max-w-sm p-4 text-center" style={{ background: "rgba(232,122,0,0.08)", border: "1px solid rgba(232,122,0,0.3)" }}>
            <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: ORANGE }} />
            <p className="text-xs font-black uppercase tracking-wider mb-1" style={{ color: ORANGE }}>
              Photo enregistrée
            </p>
            <p className="text-[10px]" style={{ color: "rgba(26,26,15,0.6)" }}>
              Identification en attente de connexion.
            </p>
            <p className="text-[10px] font-black mt-1" style={{ color: ORANGE }}>
              {pendingCount} / {maxQueue} en attente
              </p>
            <button
              className="mt-3 text-[9px] font-black uppercase tracking-wider px-4 py-2"
              style={{ background: ORANGE, color: "#fff" }}
              onClick={() => setQueued(false)}
            >
              Reprendre une autre photo
            </button>
          </div>
        )}

        {!queued && preview ? (
          <div className="w-full max-w-sm">
            <img
              src={preview}
              alt="preview"
              className="w-full object-cover max-h-80"
              style={{ border: "1px solid rgba(46,168,15,0.2)" }}
            />
            {!isOnline && (
              <p className="text-[9px] font-black uppercase tracking-wider text-center mt-2" style={{ color: ORANGE }}>
                Mode hors ligne — sera mis en file d'attente
              </p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 py-3 text-xs font-black uppercase tracking-[0.3em] min-h-[44px]"
                style={{ border: "1px solid rgba(46,168,15,0.3)", color: G, background: "transparent" }}
                onClick={() => { setPreview(null); setCompressed(null); }}
              >
                Reprendre
              </button>
              <button
                className="flex-1 py-3 text-xs font-black uppercase tracking-[0.3em] min-h-[44px]"
                style={{ background: isOnline ? G : ORANGE, color: "var(--v1v-bg)" }}
                onClick={handleAnalyse}
              >
                {isOnline ? "Analyser →" : "Mettre en attente →"}
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
              Prends une photo du spécimen
            </p>
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2" style={{ background: "rgba(232,122,0,0.08)", border: "1px solid rgba(232,122,0,0.25)" }}>
                <Clock className="w-3 h-3 flex-shrink-0" style={{ color: ORANGE }} />
                <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: ORANGE }}>
                  {pendingCount} / {maxQueue} en attente d'identification
                </p>
              </div>
            )}
            <div className="w-full max-w-sm flex flex-col gap-3">
              <button
                className="w-full py-5 text-sm font-black uppercase tracking-[0.4em] flex items-center justify-center gap-2 min-h-[44px]"
                style={{ background: G, color: "var(--v1v-bg)" }}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera className="w-5 h-5" /> Appareil photo
              </button>

            </div>
          </>
        ) : null}
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
    </div>,
    document.body
  );
}