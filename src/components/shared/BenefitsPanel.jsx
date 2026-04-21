import { useState } from "react";
import { Sparkles, Loader, ChevronDown } from "lucide-react";

const G = "#2D7A1F";

export default function BenefitsPanel({ species: _species, isOpen = false }) {
  const [benefits, setBenefits] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(isOpen);

  const handleFetch = async () => {
    if (benefits) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    // TODO: connecter via /api/benefits (Vercel + LLM) — retourne placeholder pour l'instant
    setBenefits({
      bienfaits: ["Données non disponibles — LLM non connecté."],
      utilisation: null,
      anecdote: null,
    });
    setLoading(false);
  };

  return (
    <div className="mt-3">
      <button
        onClick={handleFetch}
        aria-expanded={open}
        aria-controls="benefits-panel-content"
        className="flex items-center gap-2 w-full px-3 py-2.5 transition-all"
        style={{
          background: open ? "rgba(45,122,31,0.08)" : "rgba(45,122,31,0.05)",
          border: `1px solid rgba(45,122,31,0.25)`,
          color: G,
        }}
      >
        <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: G }} />
        <span className="text-[10px] font-black uppercase tracking-widest flex-1 text-left">
          En savoir plus — Bienfaits & Biodiversité
        </span>
        {loading
          ? <Loader className="w-3.5 h-3.5 animate-spin" style={{ color: G }} />
          : <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ color: G, transform: open ? "rotate(180deg)" : "none" }} />
        }
      </button>

      {open && !loading && benefits && (
        <div id="benefits-panel-content" className="px-3 py-3 space-y-3" style={{ background: "rgba(45,122,31,0.04)", border: `1px solid rgba(45,122,31,0.15)`, borderTop: "none" }}>
          {benefits.bienfaits?.length > 0 && (
            <div>
              <p className="text-[8px] uppercase tracking-widest font-black mb-1.5" style={{ color: "rgba(45,122,31,0.55)" }}>✦ Bienfaits</p>
              <ul className="space-y-1">
                {benefits.bienfaits.map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: G }} />
                    <span className="text-[11px] leading-relaxed" style={{ color: "rgba(26,26,15,0.7)" }}>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {benefits.utilisation && (
            <div>
              <p className="text-[8px] uppercase tracking-widest font-black mb-1" style={{ color: "rgba(45,122,31,0.55)" }}>🌍 Utilisation</p>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(26,26,15,0.65)" }}>{benefits.utilisation}</p>
            </div>
          )}
          {benefits.anecdote && (
            <div className="px-2.5 py-2" style={{ background: "rgba(45,122,31,0.05)", border: `1px solid rgba(45,122,31,0.15)` }}>
              <p className="text-[8px] uppercase tracking-widest font-black mb-1" style={{ color: "rgba(45,122,31,0.5)" }}>💡 Le savais-tu ?</p>
              <p className="text-[11px] italic leading-relaxed" style={{ color: "rgba(26,26,15,0.6)" }}>{benefits.anecdote}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
