import { useState } from "react";
import { createPageUrl } from "@/utils";
import { Check, Crown, ArrowLeft, Zap, Star, Shield } from "lucide-react";
import { Link } from "react-router-dom";

const G = "#39FF14";
const GDB = "rgba(57,255,20,0.06)";

const PRO_PRICE_ID = "price_1T400sD5N371MurQHNx4RoT6";

const FREE_FEATURES = [
  "5 scans / day",
  "Unlimited collection",
  "Basic achievements",
  "Top 1 identification result",
];

const PRO_FEATURES = [
  "Scans illimités par jour",
  "Top 3 alternatives d'identification",
  "Intel complet (comestibilité, médecine)",
  "Défis hebdomadaires exclusifs",
  "Badges & titres saisonniers exclusifs",
  "Sans publicité",
];

export default function Pricing() {
  const [loading, setLoading] = useState(false);
  const [billing, setBilling] = useState("monthly");

  const handleUpgrade = async () => {
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      alert("Payment only works from the published app. Open the app in a new tab.");
      return;
    }
    // TODO: créer /api/create-checkout.js (Vercel + stripe-node) avec priceId: PRO_PRICE_ID
    // et rediriger vers res.data.url (Stripe Checkout session)
    alert("Paiement non disponible pour l'instant.");
  };

  return (
    <div className="min-h-screen" style={{ background: "#050A05", color: "#E8E0D0" }}>

      {/* Scanlines */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(57,255,20,0.012) 2px, rgba(57,255,20,0.012) 4px)",
      }} />
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-80 h-80 z-0" style={{
        background: "radial-gradient(ellipse at top, rgba(57,255,20,0.08) 0%, transparent 70%)"
      }} />

      <div className="relative z-10 px-5 pt-12 pb-12">
        {/* Back */}
        <Link to={createPageUrl("Home")} className="flex items-center gap-2 mb-8 transition-opacity hover:opacity-60" style={{ color: "rgba(57,255,20,0.5)" }}>
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[9px] font-black uppercase tracking-[0.4em]">Back</span>
        </Link>

        {/* Title */}
        <div className="text-center mb-8">
          <Zap className="w-10 h-10 mx-auto mb-3" style={{ color: G, filter: `drop-shadow(0 0 10px ${G})` }} />
          <div className="flex items-center gap-2 mb-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: G, boxShadow: `0 0 6px ${G}` }} />
            <p className="text-[8px] tracking-[0.6em] uppercase font-black" style={{ color: "rgba(57,255,20,0.5)" }}>Unlock Elite Access</p>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: G, boxShadow: `0 0 6px ${G}` }} />
          </div>
          <h1 className="text-4xl font-black uppercase" style={{ color: G, textShadow: `0 0 30px rgba(57,255,20,0.5)` }}>
            W1LD Elite
          </h1>
          <p className="text-sm mt-2" style={{ color: "rgba(57,255,20,0.4)" }}>Explore without limits</p>
        </div>

        {/* Price card */}
        <div
          className="p-6 mb-6 text-center relative overflow-hidden"
          style={{ border: `1px solid ${G}`, background: GDB, boxShadow: `0 0 40px rgba(57,255,20,0.15), inset 0 0 40px rgba(57,255,20,0.03)` }}
        >
          {/* Corner brackets */}
          <span className="absolute top-2 left-2 w-4 h-4 border-t border-l" style={{ borderColor: G }} />
          <span className="absolute top-2 right-2 w-4 h-4 border-t border-r" style={{ borderColor: G }} />
          <span className="absolute bottom-2 left-2 w-4 h-4 border-b border-l" style={{ borderColor: G }} />
          <span className="absolute bottom-2 right-2 w-4 h-4 border-b border-r" style={{ borderColor: G }} />

          {/* Monthly / Annual toggle */}
          <div className="flex justify-center gap-2 mb-4">
            <button
              onClick={() => setBilling("monthly")}
              className="px-4 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all"
              style={{ background: billing === "monthly" ? G : "transparent", color: billing === "monthly" ? "#050A05" : "rgba(57,255,20,0.5)", border: `1px solid ${G}` }}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBilling("annual")}
              className="px-4 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all"
              style={{ background: billing === "annual" ? G : "transparent", color: billing === "annual" ? "#050A05" : "rgba(57,255,20,0.5)", border: `1px solid ${G}` }}
            >
              Annuel
            </button>
          </div>

          <div className="flex items-baseline justify-center gap-1 mb-1">
            <span className="text-6xl font-black" style={{ color: G, textShadow: `0 0 20px ${G}` }}>
              {billing === "annual" ? "39€" : "5€"}
            </span>
            <span className="text-sm" style={{ color: "rgba(57,255,20,0.4)" }}>
              {billing === "annual" ? "/an" : "/mois"}
            </span>
          </div>
          {billing === "annual" && (
            <p className="text-[9px] uppercase tracking-widest mb-2" style={{ color: G }}>
              🎉 Économise 21€
            </p>
          )}
          <p className="text-[9px] uppercase tracking-widest mb-6" style={{ color: "rgba(57,255,20,0.3)" }}>
            Sans engagement · Annulable à tout moment
          </p>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-5 text-base font-black uppercase tracking-[0.4em] transition-all disabled:opacity-60"
            style={{ background: G, color: "#050A05", boxShadow: `0 0 30px rgba(57,255,20,0.5)` }}
          >
            {loading ? "Loading..." : "Activate Elite →"}
          </button>
        </div>

        {/* Features comparison */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4" style={{ border: `1px solid rgba(57,255,20,0.12)`, background: "rgba(57,255,20,0.03)" }}>
            <h3 className="font-black text-[9px] uppercase tracking-[0.3em] mb-3 flex items-center gap-2" style={{ color: "rgba(57,255,20,0.4)" }}>
              <Shield className="w-3.5 h-3.5" /> Free
            </h3>
            <div className="space-y-2">
              {FREE_FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px]" style={{ color: "rgba(232,224,208,0.5)" }}>
                  <Check className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: "rgba(57,255,20,0.3)" }} />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 relative" style={{ border: `1px solid ${G}`, background: GDB, boxShadow: `0 0 15px rgba(57,255,20,0.1)` }}>
            <h3 className="font-black text-[9px] uppercase tracking-[0.3em] mb-3 flex items-center gap-2" style={{ color: G }}>
              <Zap className="w-3.5 h-3.5" /> Elite
            </h3>
            <div className="space-y-2">
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px]" style={{ color: "rgba(232,224,208,0.75)" }}>
                  <Check className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: G }} />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Social proof */}
        <div className="p-4" style={{ border: `1px solid rgba(57,255,20,0.1)`, background: GDB }}>
          <div className="flex gap-1 mb-2">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5" style={{ color: G, fill: G }} />)}
          </div>
          <p className="text-sm italic mb-2" style={{ color: "rgba(232,224,208,0.6)" }}>
            "W1LD a complètement changé mon rapport à la nature. J'identifie maintenant chaque espèce que je croise."
          </p>
          <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(57,255,20,0.3)" }}>— Marie L., Field Expert</p>
        </div>
      </div>
    </div>
  );
}