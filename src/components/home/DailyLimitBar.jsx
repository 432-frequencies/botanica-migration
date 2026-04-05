import { Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function DailyLimitBar({ dailyCount, isPro }) {
  if (isPro) return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ border: "1px solid rgba(45,122,31,0.2)" }}>
      <Zap className="w-3 h-3" style={{ color: "#2D7A1F" }} />
      <p className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: "#2D7A1F" }}>
        Accès illimité — Clearance Elite
      </p>
    </div>
  );

  const used = dailyCount || 0;
  const limit = 5;
  const remaining = Math.max(0, limit - used);
  const pct = (used / limit) * 100;
  const exhausted = used >= limit;

  if (exhausted) {
    return (
      <div
        className="px-4 py-3"
        style={{
          background: "rgba(200,150,10,0.12)",
          border: "2px solid rgba(200,150,10,0.6)",
          boxShadow: "0 0 12px rgba(200,150,10,0.15)",
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: "#2D7A1F" }}>
            Scans du jour
          </p>
          <p className="text-sm font-black tracking-widest" style={{ color: "#C8960A" }}>
            {used}/{limit}
          </p>
        </div>
        <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: "#C8960A" }}>
          ⚡ QUOTA ÉPUISÉ
        </p>
        <p className="text-[8px] mb-2.5" style={{ color: "rgba(200,150,10,0.7)" }}>
          Passe Elite — scans illimités + intel complet
        </p>
        <Link to={createPageUrl("Pricing")}>
          <button
            className="w-full font-black uppercase tracking-[0.3em] text-[9px] transition-all active:opacity-80"
            style={{
              background: "#C8960A",
              color: "#000",
              minHeight: "44px",
            }}
          >
            → DÉBLOQUER MAINTENANT
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-3" style={{ border: "1px solid rgba(45,122,31,0.2)" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9px] font-black tracking-[0.4em] uppercase" style={{ color: "#2D7A1F" }}>
          Scans du jour
        </p>
        <p className="text-[9px] font-black tracking-widest" style={{ color: "#2D7A1F" }}>
          {used}/{limit}
        </p>
      </div>
      <div className="h-px w-full" style={{ background: "rgba(45,122,31,0.15)" }}>
        <div
          className="h-px transition-all"
          style={{ width: `${Math.min(pct, 100)}%`, background: "#2D7A1F" }}
        />
      </div>
      <p className="text-[8px] tracking-[0.3em] uppercase mt-1.5" style={{ color: "rgba(45,122,31,0.6)" }}>
        {remaining} scan{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""} aujourd'hui
      </p>
    </div>
  );
}