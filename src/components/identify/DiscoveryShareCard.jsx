import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { useTranslation } from "@/lib/i18n";

const RARITY = {
  commune: {
    label: "Commune",
    badgeBg: "rgba(120,120,120,0.25)",
    badgeColor: "#ccc",
    cardBg: "linear-gradient(180deg, #0d1a0d 0%, #111 100%)",
    border: "none",
    glow: "none",
    stars: false,
    particles: false,
  },
  peu_commune: {
    label: "Peu commune",
    badgeBg: "rgba(30,80,200,0.35)",
    badgeColor: "#6ab0ff",
    cardBg: "linear-gradient(180deg, #091428 0%, #0d1a2e 100%)",
    border: "1px solid rgba(100,160,255,0.25)",
    glow: "0 0 40px rgba(60,120,255,0.15)",
    stars: false,
    particles: false,
  },
  rare: {
    label: "Rare",
    badgeBg: "rgba(100,30,200,0.4)",
    badgeColor: "#c084fc",
    cardBg: "linear-gradient(160deg, #0e0520 0%, #1a0a35 50%, #0a1020 100%)",
    border: "1px solid rgba(160,80,255,0.3)",
    glow: "0 0 60px rgba(120,40,255,0.2)",
    stars: true,
    particles: false,
  },
  legendaire: {
    label: "Légendaire",
    badgeBg: "rgba(200,150,0,0.4)",
    badgeColor: "#FFD700",
    cardBg: "linear-gradient(160deg, #0a0800 0%, #1a1200 40%, #0d0d00 100%)",
    border: "2px solid rgba(255,215,0,0.6)",
    glow: "0 0 80px rgba(255,200,0,0.3), inset 0 0 80px rgba(255,200,0,0.05)",
    stars: true,
    particles: true,
  },
};

const W1LD_LOGO_SRC = "/icons/w1ld-icon-512.png";
const RARITY_LABEL_KEYS = {
  commune: "result.rarityCommune",
  peu_commune: "result.rarityPeuCommune",
  rare: "result.rarityRare",
  legendaire: "result.rarityLegendaire",
};

// Inline star background for rare/legendary
function StarField({ count = 60 }) {
  const stars = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.6 + 0.2,
    duration: Math.random() * 3 + 2,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: "inherit" }}>
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: "#fff",
            opacity: s.opacity,
            animation: `twinkle ${s.duration}s ease-in-out infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}

// Gold particles for legendary
function GoldParticles({ count = 24 }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 4,
    duration: Math.random() * 4 + 4,
    size: Math.random() * 4 + 2,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius: "inherit" }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: "radial-gradient(circle, #FFD700, #FFA500)",
            animation: `floatUp ${p.duration}s ${p.delay}s ease-in-out infinite`,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

// The actual card DOM (rendered offscreen for html2canvas)
export function ShareCardDOM({ data, format, qrDataUrl, cardRef, t, language }) {
  const cfg = RARITY[data.rarity] || RARITY.commune;
  const rarityLabel = t ? t(RARITY_LABEL_KEYS[data.rarity] || "result.rarityCommune") : cfg.label;
  const isStory = format === "story";
  const W = 1080;
  const H = isStory ? 1920 : 1080;

  const photoHeight = isStory ? H * 0.52 : H * 0.55;
  const qrSize = isStory ? 210 : 168;

  return (
    <div
      ref={cardRef || undefined}
      style={{
        width: W,
        height: H,
        position: "relative",
        overflow: "hidden",
        background: cfg.cardBg,
        boxShadow: cfg.glow,
        border: cfg.border,
        fontFamily: "'Montserrat', 'Inter', sans-serif",
        flexShrink: 0,
      }}
    >
      {/* Stars */}
      {cfg.stars && <StarField count={isStory ? 100 : 70} />}
      {cfg.particles && <GoldParticles count={30} />}

      {/* Photo zone */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: photoHeight,
          background: "#050805",
          overflow: "hidden",
        }}
      >
        {data.photo_url ? (
          <>
            <img
              src={data.photo_url}
              alt=""
              aria-hidden="true"
              crossOrigin="anonymous"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(34px) brightness(0.52) saturate(1.18)",
                transform: "scale(1.12)",
                opacity: 0.9,
              }}
            />
            <img
              src={data.photo_url}
              alt={data.common_name}
              crossOrigin="anonymous"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
                display: "block",
                padding: isStory ? 58 : 36,
                filter: "drop-shadow(0 26px 70px rgba(0,0,0,0.42))",
              }}
            />
          </>
        ) : (
          <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.04)" }} />
        )}
        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "62%",
            background: "linear-gradient(to top, rgba(4,8,4,0.96) 0%, rgba(4,8,4,0.54) 42%, transparent 100%)",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: 42,
            right: 42,
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "14px 20px",
            background: "rgba(0,0,0,0.42)",
            border: "1px solid rgba(255,255,255,0.14)",
            backdropFilter: "blur(12px)",
          }}
        >
          <img src={W1LD_LOGO_SRC} alt="" crossOrigin="anonymous" style={{ width: 50, height: 50, objectFit: "contain" }} />
          <div style={{ fontSize: 28, fontWeight: 900, color: "#DDF9E1", letterSpacing: "0.22em" }}>W1LD</div>
        </div>

        {/* Rarity badge top-left */}
        <div
          style={{
            position: "absolute",
            top: 42,
            left: 42,
            padding: "10px 24px",
            background: cfg.badgeBg,
            border: `1px solid ${cfg.badgeColor}`,
            color: cfg.badgeColor,
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            backdropFilter: "blur(8px)",
            animation: data.rarity === "rare" || data.rarity === "legendaire" ? "shimmer 2s infinite" : "none",
          }}
        >
          {rarityLabel}
        </div>

        {/* Audio badge top-right */}
        {data.detection_method === "audio" && (
          <div
            style={{
              position: "absolute",
              top: 126,
              right: 42,
              padding: "10px 20px",
              background: "rgba(0,0,0,0.5)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "rgba(255,255,255,0.7)",
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: "0.2em",
              backdropFilter: "blur(8px)",
            }}
          >
            🎙 AUDIO
          </div>
        )}
      </div>

      {/* Content zone */}
      <div
        style={{
          padding: isStory ? "62px 68px 46px" : "42px 56px 34px",
          flex: 1,
          background:
            "radial-gradient(circle at 8% 10%, rgba(57,184,20,0.16), transparent 32%), linear-gradient(180deg, rgba(4,10,5,0.92), rgba(1,3,2,0.98))",
        }}
      >
        {/* Species names */}
        <div style={{ marginBottom: isStory ? 70 : 34 }}>
          <h1
            style={{
              fontSize: isStory ? 82 : 66,
              fontWeight: 900,
              color: data.rarity === "legendaire" ? "#FFD700" : "#ffffff",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              lineHeight: 0.98,
              margin: 0,
              textShadow: data.rarity === "legendaire" ? "0 0 40px rgba(255,215,0,0.4)" : "none",
            }}
          >
            {data.common_name}
          </h1>
          <p
            style={{
              fontSize: isStory ? 36 : 28,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.55)",
              marginTop: 16,
              letterSpacing: "0.02em",
            }}
          >
            {data.scientific_name}
          </p>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginBottom: isStory ? 72 : 36,
          }}
        >
          {/* XP */}
          <div
            style={{
              flex: 1,
              padding: "24px",
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 28,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 52, fontWeight: 900, color: "#39B814", letterSpacing: "0.02em" }}>
              +{data.xp_gained || 10}
            </div>
            <div style={{ fontSize: 22, color: "rgba(255,255,255,0.45)", letterSpacing: "0.3em", textTransform: "uppercase", marginTop: 8 }}>
              XP
            </div>
          </div>

          {/* Discovery rank */}
          {data.discovery_rank && (
            <div
              style={{
                flex: 1.5,
                padding: "24px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 28,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 900, color: cfg.badgeColor, letterSpacing: "0.02em" }}>
                {data.discovery_rank}
              </div>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.4)", letterSpacing: "0.25em", textTransform: "uppercase", marginTop: 8 }}>
                {t ? t("result.worldDiscoverer") : "Découvreur mondial"}
              </div>
            </div>
          )}

          {/* FLORA tokens */}
          {data.flora_gained > 0 && (
            <div
              style={{
                flex: 1,
                padding: "24px",
                background: "rgba(255,215,0,0.08)",
                border: "1px solid rgba(255,215,0,0.25)",
                borderRadius: 28,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 52, fontWeight: 900, color: "#FFD700", letterSpacing: "0.02em" }}>
                +{data.flora_gained}
              </div>
              <div style={{ fontSize: 22, color: "rgba(255,215,0,0.55)", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 8 }}>
                $FLORA
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22, minWidth: 0 }}>
            <img
              src={W1LD_LOGO_SRC}
              alt="W1LD"
              crossOrigin="anonymous"
              style={{
                width: isStory ? 90 : 76,
                height: isStory ? 90 : 76,
                objectFit: "contain",
                filter: "drop-shadow(0 0 26px rgba(57,184,20,0.32))",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isStory ? 46 : 38, fontWeight: 900, color: "#9DFFB0", letterSpacing: "0.22em", textTransform: "uppercase" }}>
                W1LD
              </div>
              <div style={{ fontSize: isStory ? 22 : 18, color: "rgba(255,255,255,0.45)", letterSpacing: "0.18em", marginTop: 6 }}>
                {t ? t("result.discoveredVia") : "Découvert via W1LD"} · {data.date || new Date().toLocaleDateString(language === "en" ? "en-US" : "fr-FR")}
              </div>
              {data.user_name && (
                <div style={{ fontSize: isStory ? 22 : 18, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em", marginTop: 6 }}>
                  {t ? t("result.byUser", { name: data.user_name }) : `par ${data.user_name}`}
                </div>
              )}
            </div>
          </div>
          {qrDataUrl && (
            <div
              style={{
                width: qrSize + 26,
                height: qrSize + 26,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 28,
                flexShrink: 0,
              }}
            >
              <img
                src={qrDataUrl}
                alt="QR"
                style={{ width: qrSize, height: qrSize, opacity: 0.94 }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Legendary border glow overlay */}
      {data.rarity === "legendaire" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "3px solid rgba(255,215,0,0.5)",
            pointerEvents: "none",
            boxShadow: "inset 0 0 120px rgba(255,180,0,0.08)",
          }}
        />
      )}

      {/* CSS keyframes injected */}
      <style>{`
        @keyframes twinkle { from { opacity: 0.15; } to { opacity: 0.9; } }
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 0.7; }
          100% { transform: translateY(-120px) scale(0.3); opacity: 0; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

// Main component — the modal with preview + export buttons
export default function DiscoveryShareCard({ data, onClose }) {
  const { language, t } = useTranslation();
  const [format, setFormat] = useState("square"); // "square" | "story"
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [preparedShare, setPreparedShare] = useState(null);
  const cardRef = useRef(null);

  const cfg = RARITY[data.rarity] || RARITY.commune;

  useEffect(() => {
    QRCode.toDataURL("https://w1ld.app", {
      width: 200,
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    }).then(setQrDataUrl).catch(() => {});
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const getCanvas = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const el = cardRef.current;
    return html2canvas(el, {
      useCORS: true,
      allowTaint: true,
      scale: 1,
      width: el.offsetWidth,
      height: el.offsetHeight,
      backgroundColor: null,
      logging: false,
    });
  };

  const getFilename = () => `w1ld-${data.common_name?.replace(/\s+/g, "-").toLowerCase()}-${format}.png`;

  const getBlob = async () => {
    const canvas = await getCanvas();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    timeoutId = window.setTimeout(async () => {
      try {
        const blob = await getBlob();
        if (cancelled || !blob) return;

        const file = new File([blob], getFilename(), { type: "image/png" });
        const url = URL.createObjectURL(blob);

        setPreparedShare((prev) => {
          if (prev?.url) URL.revokeObjectURL(prev.url);
          return { blob, file, url };
        });
      } catch {
        if (!cancelled) {
          setPreparedShare((prev) => {
            if (prev?.url) URL.revokeObjectURL(prev.url);
            return null;
          });
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [data.common_name, data.photo_url, data.rarity, data.scientific_name, data.user_name, format, qrDataUrl]);

  useEffect(() => () => {
    if (preparedShare?.url) URL.revokeObjectURL(preparedShare.url);
  }, [preparedShare?.url]);

  const handleDownload = async () => {
    setExporting(true);
    try {
      const link = document.createElement("a");
      link.download = getFilename();
      if (preparedShare?.url) {
        link.href = preparedShare.url;
      } else {
        const canvas = await getCanvas();
        link.href = canvas.toDataURL("image/png");
      }
      link.click();
    } finally {
      setExporting(false);
    }
  };

  const handleCopy = async () => {
    setCopying(true);
    try {
      const blob = preparedShare?.blob || await getBlob();
      if (!blob) throw new Error("blob_missing");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    } finally {
      setCopying(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const file = preparedShare?.file || null;

      if (navigator.share && file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `W1LD • ${data.common_name}`,
          text: `${data.common_name} • ${data.scientific_name || "Signal terrain"}`,
          files: [file],
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: `W1LD • ${data.common_name}`,
          text: `${data.common_name} • ${data.scientific_name || "Signal terrain"}`,
          url: "https://w1ld.app",
        });
        return;
      }

      await handleDownload();
    } catch (error) {
      if (error?.name !== "AbortError") {
        await handleDownload();
      }
    } finally {
      setSharing(false);
    }
  };

  const isStory = format === "story";
  const CARD_W = isStory ? 1080 : 1080;
  const CARD_H = isStory ? 1920 : 1080;
  const SCALE = isStory ? 0.2 : 0.29;
  const previewW = Math.round(CARD_W * SCALE);
  const previewH = Math.round(CARD_H * SCALE);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-end overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)", overscrollBehavior: "contain" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-auto"
        onClick={(event) => event.stopPropagation()}
        style={{ touchAction: "manipulation", paddingTop: 24 }}
      >
      {/* Header */}
      <div className="w-full flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-[8px] tracking-[0.5em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>W1LD</p>
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#fff" }}>{t("result.shareTitle")}</p>
        </div>
        <button onClick={onClose} className="text-white opacity-40 hover:opacity-70 text-xl font-bold">✕</button>
      </div>

      {/* Format toggle */}
      <div className="flex gap-2 mb-4">
        {["square", "story"].map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className="px-5 py-2 text-[10px] font-black uppercase tracking-[0.3em] transition-all"
            style={{
              background: format === f ? cfg.badgeColor : "rgba(255,255,255,0.07)",
              color: format === f ? "#000" : "rgba(255,255,255,0.4)",
              border: format === f ? "none" : "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {f === "square" ? t("result.shareSquare") : t("result.shareStory")}
          </button>
        ))}
      </div>

      {/* Card preview — the export DOM stays full-size, only the preview wrapper scales it. */}
      <div
        style={{
          width: previewW,
          height: previewH,
          position: "relative",
          overflow: "hidden",
          borderRadius: "4px",
          flexShrink: 0,
          marginBottom: 20,
          boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: CARD_W,
            height: CARD_H,
            pointerEvents: "none",
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
          }}
        >
          <ShareCardDOM
            data={data}
            format={format}
            qrDataUrl={qrDataUrl}
            cardRef={null}
            t={t}
            language={language}
          />
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: -12000,
          width: CARD_W,
          height: CARD_H,
          pointerEvents: "none",
        }}
      >
        <ShareCardDOM
          data={data}
          format={format}
          qrDataUrl={qrDataUrl}
          cardRef={cardRef}
          t={t}
          language={language}
        />
      </div>

      {/* Actions */}
      <div className="w-full px-5 pb-8 space-y-3">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="w-full py-4 font-black uppercase text-sm tracking-[0.3em] transition-all disabled:opacity-40"
          style={{ background: "var(--v1v-green)", color: "#000" }}
        >
          {sharing ? t("result.sharing") : preparedShare?.file ? t("result.shareNow") : t("result.preparingShare")}
        </button>
        <button
          onClick={handleDownload}
          disabled={exporting}
          className="w-full py-4 font-black uppercase text-sm tracking-[0.3em] transition-all disabled:opacity-40"
          style={{ background: cfg.badgeColor === "#FFD700" ? "#FFD700" : "rgba(255,255,255,0.08)", color: cfg.badgeColor === "#FFD700" ? "#000" : "#fff", border: cfg.badgeColor === "#FFD700" ? "none" : "1px solid rgba(255,255,255,0.15)" }}
        >
          {exporting ? t("result.exportingPng") : t("result.downloadPng")}
        </button>
        <button
          onClick={handleCopy}
          disabled={copying}
          className="w-full py-4 font-black uppercase text-sm tracking-[0.3em] transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          {copying ? t("result.copyingImage") : t("result.copyImage")}
        </button>
      </div>
      </div>
    </div>
    ,
    document.body
  );
}
