import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

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
export function ShareCardDOM({ data, format, qrDataUrl, cardRef }) {
  const cfg = RARITY[data.rarity] || RARITY.commune;
  const isStory = format === "story";
  const W = 1080;
  const H = isStory ? 1920 : 1080;
  const SCALE = isStory ? 0.28 : 0.31; // visual preview scale

  const photoHeight = isStory ? H * 0.48 : H * 0.58;

  return (
    <div
      ref={cardRef}
      style={{
        width: W,
        height: H,
        position: "relative",
        overflow: "hidden",
        background: cfg.cardBg,
        boxShadow: cfg.glow,
        border: cfg.border,
        fontFamily: "'Montserrat', 'Inter', sans-serif",
        transform: `scale(${SCALE})`,
        transformOrigin: "top left",
        flexShrink: 0,
      }}
    >
      {/* Stars */}
      {cfg.stars && <StarField count={isStory ? 100 : 70} />}
      {cfg.particles && <GoldParticles count={30} />}

      {/* Photo zone */}
      <div style={{ position: "relative", width: "100%", height: photoHeight }}>
        {data.photo_url ? (
          <img
            src={data.photo_url}
            alt={data.common_name}
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
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
            height: "55%",
            background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)",
          }}
        />

        {/* Rarity badge top-left */}
        <div
          style={{
            position: "absolute",
            top: 48,
            left: 48,
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
          {cfg.label}
        </div>

        {/* Audio badge top-right */}
        {data.detection_method === "audio" && (
          <div
            style={{
              position: "absolute",
              top: 48,
              right: 48,
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
      <div style={{ padding: "48px 60px 32px", flex: 1 }}>
        {/* Species names */}
        <div style={{ marginBottom: 48 }}>
          <h1
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: data.rarity === "legendaire" ? "#FFD700" : "#ffffff",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              lineHeight: 1.05,
              margin: 0,
              textShadow: data.rarity === "legendaire" ? "0 0 40px rgba(255,215,0,0.4)" : "none",
            }}
          >
            {data.common_name}
          </h1>
          <p
            style={{
              fontSize: 32,
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
            marginBottom: 48,
          }}
        >
          {/* XP */}
          <div
            style={{
              flex: 1,
              padding: "24px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
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
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 900, color: cfg.badgeColor, letterSpacing: "0.02em" }}>
                {data.discovery_rank}
              </div>
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.4)", letterSpacing: "0.25em", textTransform: "uppercase", marginTop: 8 }}>
                Découvreur mondial
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 900, color: "#39B814", letterSpacing: "0.25em", textTransform: "uppercase" }}>
              W1LD
            </div>
            <div style={{ fontSize: 20, color: "rgba(255,255,255,0.35)", letterSpacing: "0.25em", marginTop: 4 }}>
              Découvert via W1LD · {data.date || new Date().toLocaleDateString("fr-FR")}
            </div>
            {data.user_name && (
              <div style={{ fontSize: 20, color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em", marginTop: 4 }}>
                par {data.user_name}
              </div>
            )}
          </div>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="QR"
              style={{ width: 96, height: 96, opacity: 0.6 }}
            />
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
  const [format, setFormat] = useState("square"); // "square" | "story"
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const cardRef = useRef(null);

  const cfg = RARITY[data.rarity] || RARITY.commune;

  useEffect(() => {
    QRCode.toDataURL("https://w1ld.app", {
      width: 200,
      margin: 1,
      color: { dark: "#ffffff", light: "#00000000" },
    }).then(setQrDataUrl).catch(() => {});
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

  const handleDownload = async () => {
    setExporting(true);
    const canvas = await getCanvas();
    const link = document.createElement("a");
    link.download = `w1ld-${data.common_name?.replace(/\s+/g, "-").toLowerCase()}-${format}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setExporting(false);
  };

  const handleCopy = async () => {
    setCopying(true);
    const canvas = await getCanvas();
    canvas.toBlob(async (blob) => {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopying(false);
    });
  };

  const isStory = format === "story";
  const CARD_W = isStory ? 1080 : 1080;
  const CARD_H = isStory ? 1920 : 1080;
  const SCALE = isStory ? 0.28 : 0.31;
  const previewW = Math.round(CARD_W * SCALE);
  const previewH = Math.round(CARD_H * SCALE);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-end"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)" }}
    >
      {/* Header */}
      <div className="w-full max-w-md flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-[8px] tracking-[0.5em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>W1LD</p>
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#fff" }}>Partager ma découverte</p>
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
            {f === "square" ? "Carré" : "Story"}
          </button>
        ))}
      </div>

      {/* Card preview — offscreen rendering container */}
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
        {/* The actual DOM card (sized at full 1080px, scaled down visually) */}
        <div style={{ position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H, pointerEvents: "none" }}>
          <ShareCardDOM
            data={data}
            format={format}
            qrDataUrl={qrDataUrl}
            cardRef={cardRef}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-md px-5 pb-8 space-y-3">
        <button
          onClick={handleDownload}
          disabled={exporting}
          className="w-full py-4 font-black uppercase text-sm tracking-[0.3em] transition-all disabled:opacity-40"
          style={{ background: cfg.badgeColor === "#FFD700" ? "#FFD700" : "var(--v1v-green)", color: "#000" }}
        >
          {exporting ? "Export en cours..." : "⬇ Télécharger PNG"}
        </button>
        <button
          onClick={handleCopy}
          disabled={copying}
          className="w-full py-4 font-black uppercase text-sm tracking-[0.3em] transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          {copying ? "Copie..." : "📋 Copier l'image"}
        </button>
      </div>
    </div>
  );
}