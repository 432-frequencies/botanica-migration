import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { APP_NAME, APP_SITE_URL } from "@/lib/app-config";

const STATUS_STYLES = {
  reference: {
    accent: "#C8960A",
    accentSoft: "rgba(200,150,10,0.16)",
    label: "Référence locale",
    background: "linear-gradient(180deg, #090700 0%, #120d02 38%, #060806 100%)",
    glow: "0 0 70px rgba(200,150,10,0.18)",
  },
  milestone: {
    accent: "#39B814",
    accentSoft: "rgba(57,184,20,0.16)",
    label: "Contribution décisive",
    background: "linear-gradient(180deg, #040b04 0%, #08140a 42%, #030703 100%)",
    glow: "0 0 70px rgba(57,184,20,0.18)",
  },
  opening: {
    accent: "#53C1FF",
    accentSoft: "rgba(83,193,255,0.14)",
    label: "Zone à initier",
    background: "linear-gradient(180deg, #03070d 0%, #07111c 42%, #040706 100%)",
    glow: "0 0 70px rgba(83,193,255,0.14)",
  },
  progress: {
    accent: "#39B814",
    accentSoft: "rgba(57,184,20,0.12)",
    label: "Progression locale",
    background: "linear-gradient(180deg, #050907 0%, #09110b 40%, #040604 100%)",
    glow: "0 0 70px rgba(57,184,20,0.12)",
  },
  champion: {
    accent: "#C8960A",
    accentSoft: "rgba(200,150,10,0.16)",
    label: "Référence locale",
    background: "linear-gradient(180deg, #090700 0%, #120d02 38%, #060806 100%)",
    glow: "0 0 70px rgba(200,150,10,0.18)",
  },
  assault: {
    accent: "#39B814",
    accentSoft: "rgba(57,184,20,0.16)",
    label: "Contribution décisive",
    background: "linear-gradient(180deg, #040b04 0%, #08140a 42%, #030703 100%)",
    glow: "0 0 70px rgba(57,184,20,0.18)",
  },
  frontier: {
    accent: "#53C1FF",
    accentSoft: "rgba(83,193,255,0.14)",
    label: "Zone à initier",
    background: "linear-gradient(180deg, #03070d 0%, #07111c 42%, #040706 100%)",
    glow: "0 0 70px rgba(83,193,255,0.14)",
  },
  hunt: {
    accent: "#39B814",
    accentSoft: "rgba(57,184,20,0.12)",
    label: "Progression locale",
    background: "linear-gradient(180deg, #050907 0%, #09110b 40%, #040604 100%)",
    glow: "0 0 70px rgba(57,184,20,0.12)",
  },
};

function GridBackground({ accent }) {
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)
        `,
        backgroundSize: "120px 120px",
        maskImage: "linear-gradient(180deg, rgba(0,0,0,0.75), rgba(0,0,0,0.95))",
        boxShadow: `inset 0 0 0 2px ${accent}22`,
      }}
    />
  );
}

function ZoneShareCardDOM({ data, qrDataUrl, cardRef }) {
  const cfg = STATUS_STYLES[data.kind] || STATUS_STYLES.progress;
  const zoneDisplayName = data.zoneLabel || data.zoneId;
  const W = 1080;
  const H = 1920;
  const SCALE = 0.28;

  return (
    <div
      ref={cardRef}
      style={{
        width: W,
        height: H,
        position: "relative",
        overflow: "hidden",
        background: cfg.background,
        boxShadow: cfg.glow,
        transform: `scale(${SCALE})`,
        transformOrigin: "top left",
        color: "#F4F8F1",
        fontFamily: "'Montserrat', 'Inter', sans-serif",
      }}
    >
      <GridBackground accent={cfg.accent} />

      <div
        style={{
          position: "absolute",
          inset: 42,
          border: `4px solid ${cfg.accent}`,
          borderRadius: 42,
          opacity: 0.95,
        }}
      />

      <div style={{ position: "absolute", inset: 96, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 48 }}>
          <div>
            <div
              style={{
                display: "inline-flex",
                padding: "14px 24px",
                border: `1px solid ${cfg.accent}`,
                background: cfg.accentSoft,
                color: cfg.accent,
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
              }}
            >
              {cfg.label}
            </div>
            <p style={{ marginTop: 24, fontSize: 28, letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
              {zoneDisplayName}
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "0.2em", color: cfg.accent }}>
              {APP_NAME}
            </div>
            <div style={{ marginTop: 8, fontSize: 20, letterSpacing: "0.24em", color: "rgba(255,255,255,0.35)" }}>
              FIELD NOTES
            </div>
          </div>
        </div>

        <div style={{ marginTop: 70 }}>
          <p
            style={{
              fontSize: 108,
              fontWeight: 900,
              lineHeight: 0.92,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              color: cfg.accent,
              margin: 0,
            }}
          >
            {data.headline}
          </p>
          <p
            style={{
              marginTop: 32,
              maxWidth: 780,
              fontSize: 40,
              lineHeight: 1.3,
              color: "rgba(255,255,255,0.72)",
            }}
          >
            {data.detail}
          </p>
        </div>

        <div style={{ display: "flex", gap: 28, marginTop: 90 }}>
          <div
            style={{
              flex: 1.1,
              padding: "34px 38px",
              border: `2px solid ${cfg.accent}`,
              background: cfg.accentSoft,
            }}
          >
            <div style={{ fontSize: 122, fontWeight: 900, lineHeight: 1, color: "#ffffff" }}>
              {data.metricValue}
            </div>
            <div style={{ marginTop: 18, fontSize: 24, fontWeight: 900, letterSpacing: "0.28em", textTransform: "uppercase", color: cfg.accent }}>
              {data.metricLabel}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              padding: "34px 34px",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.05)",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
              Repère du jour
            </div>
            <div style={{ marginTop: 18, fontSize: 34, lineHeight: 1.25, color: "#ffffff" }}>
              {data.mission}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 44,
            padding: "24px 28px",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)" }}>
            À partager
          </div>
          <div style={{ marginTop: 18, fontSize: 34, lineHeight: 1.3, color: "#F4F8F1" }}>
            {data.broadcast}
          </div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: cfg.accent }}>
              {data.footerHeadline}
            </div>
            <div style={{ marginTop: 12, fontSize: 22, letterSpacing: "0.18em", color: "rgba(255,255,255,0.35)" }}>
              {data.footerDetail}
            </div>
            <div style={{ marginTop: 26, fontSize: 18, letterSpacing: "0.18em", color: "rgba(255,255,255,0.25)" }}>
              Documenté via {APP_NAME}
            </div>
          </div>

          {qrDataUrl && (
            <div style={{ textAlign: "center" }}>
              <img src={qrDataUrl} alt="QR" style={{ width: 132, height: 132, opacity: 0.82 }} />
              <div style={{ marginTop: 10, fontSize: 18, letterSpacing: "0.18em", color: "rgba(255,255,255,0.28)" }}>
                Rejoins l'exploration
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ZoneShareCard({ data, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [preparedShare, setPreparedShare] = useState(null);
  const cardRef = useRef(null);

  useEffect(() => {
    QRCode.toDataURL(APP_SITE_URL, {
      width: 220,
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

  const getBlob = async () => {
    const canvas = await getCanvas();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  };

  const getFilename = () => `w1ld-zone-${String(data.zoneId || "status").replace(/\s+/g, "-").toLowerCase()}.png`;

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
  }, [data.broadcast, data.detail, data.headline, data.metricLabel, data.metricValue, data.mission, data.shareText, data.zoneId, data.zoneLabel, qrDataUrl]);

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

  const handleCopyText = async () => {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(`${data.shareText} ${APP_SITE_URL}`);
    } finally {
      setTimeout(() => setCopying(false), 700);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const file = preparedShare?.file || null;

      if (navigator.share && file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${APP_NAME} • ${data.shareTitle}`,
          text: data.shareText,
          files: [file],
        });
        return;
      }

      if (!navigator.share) {
        await handleCopyText();
        return;
      }

      await navigator.share({
        title: `${APP_NAME} • ${data.shareTitle}`,
        text: data.shareText,
        url: APP_SITE_URL,
      });
    } catch (error) {
      if (error?.name !== "AbortError") {
        await handleCopyText();
      }
    } finally {
      setSharing(false);
    }
  };

  const CARD_W = 1080;
  const CARD_H = 1920;
  const SCALE = 0.28;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-end"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(14px)", overscrollBehavior: "contain" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md"
        onClick={(event) => event.stopPropagation()}
        style={{ touchAction: "manipulation" }}
      >
      <div className="w-full flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <p className="text-[8px] tracking-[0.5em] uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
            {APP_NAME}
          </p>
          <p className="text-sm font-black uppercase tracking-wider" style={{ color: "#fff" }}>
            Diffuser mon statut
          </p>
        </div>
        <button onClick={onClose} className="text-white opacity-40 hover:opacity-70 text-xl font-bold">
          ✕
        </button>
      </div>

      <div
        style={{
          width: Math.round(CARD_W * SCALE),
          height: Math.round(CARD_H * SCALE),
          position: "relative",
          overflow: "hidden",
          borderRadius: "4px",
          flexShrink: 0,
          marginBottom: 20,
          boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, width: CARD_W, height: CARD_H, pointerEvents: "none" }}>
          <ZoneShareCardDOM data={data} qrDataUrl={qrDataUrl} cardRef={cardRef} />
        </div>
      </div>

      <div className="w-full px-5 pb-8 space-y-3">
        <button
          onClick={handleShare}
          disabled={sharing}
          className="w-full py-4 font-black uppercase text-sm tracking-[0.28em] transition-all disabled:opacity-40"
          style={{ background: "var(--v1v-green)", color: "#000" }}
        >
          {sharing ? "Partage..." : preparedShare?.file ? "Partager le statut" : "Préparer le statut"}
        </button>
        <button
          onClick={handleDownload}
          disabled={exporting}
          className="w-full py-4 font-black uppercase text-sm tracking-[0.28em] transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          {exporting ? "Export..." : "Télécharger la carte"}
        </button>
        <button
          onClick={handleCopyText}
          disabled={copying}
          className="w-full py-4 font-black uppercase text-sm tracking-[0.28em] transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {copying ? "Message copié" : "Copier le message"}
        </button>
      </div>
      </div>
    </div>
    ,
    document.body
  );
}
