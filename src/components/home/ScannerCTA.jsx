const SCAN_TEXTS = [
  "POINTE VERS LE VIVANT.",
  "IDENTIFIE. COLLECTE. GAGNE.",
  "LA NATURE T'ATTEND.",
];

export default function ScannerCTA({ onScan, scanTextIdx }) {
  return (
    <div className="px-5 py-3 relative z-10">
      <button
        onClick={onScan}
        className="w-full relative overflow-hidden transition-all active:scale-[0.97]"
        style={{
          background: "var(--v1v-green)",
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
            <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(0,0,0,0.2)", transform: "translateY(-50%)" }} />
            <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.2)", transform: "translateX(-50%)" }} />
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
  );
}