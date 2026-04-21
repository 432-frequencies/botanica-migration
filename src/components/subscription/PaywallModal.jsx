import { X, Zap, TrendingUp, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SUBSCRIPTION_TIERS, formatPrice, formatTimeUntilReset } from "@/lib/subscription-tiers";
import { useState } from "react";

export default function PaywallModal({ isOpen, onClose, remainingScans, onSelectTier }) {
  const [selectedTab, setSelectedTab] = useState("monthly"); // "monthly" | "annual" | "single"

  if (!isOpen) return null;

  const tiers = {
    monthly: [SUBSCRIPTION_TIERS.MONTHLY_BASIC, SUBSCRIPTION_TIERS.MONTHLY_PRO],
    annual: [SUBSCRIPTION_TIERS.ANNUAL_BASIC, SUBSCRIPTION_TIERS.ANNUAL_PRO],
    single: [SUBSCRIPTION_TIERS.PAY_PER_USE]
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
        style={{
          background: "rgba(10, 20, 10, 0.95)",
          backdropFilter: "blur(8px)"
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl mx-4 mb-4 sm:mb-0 rounded-2xl overflow-hidden"
          style={{
            background: "var(--v1v-bg-card)",
            border: "1px solid var(--v1v-green-ghost)",
            maxHeight: "90vh"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-95"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)"
            }}
          >
            <X className="w-4 h-4" style={{ color: "var(--v1v-fg-muted)" }} />
          </button>

          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: "90vh" }}>
            {/* Header */}
            <div className="p-6 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                style={{
                  background: "linear-gradient(135deg, var(--v1v-green) 0%, var(--v1v-amber) 100%)"
                }}
              >
                <Zap className="w-8 h-8" style={{ color: "var(--v1v-bg)" }} />
              </motion.div>

              <h2 className="text-2xl font-black uppercase tracking-wide mb-2" style={{ color: "var(--v1v-fg)" }}>
                Limite Atteinte
              </h2>

              <p className="text-sm mb-1" style={{ color: "var(--v1v-fg-muted)" }}>
                Tu as utilisé tes <strong style={{ color: "var(--v1v-green)" }}>2 scans gratuits</strong> aujourd'hui
              </p>

              <p className="text-xs" style={{ color: "var(--v1v-fg-faint)" }}>
                Nouvelle limite dans {formatTimeUntilReset()}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-6 mb-4">
              <button
                onClick={() => setSelectedTab("monthly")}
                className="flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-all"
                style={{
                  borderRadius: 8,
                  background: selectedTab === "monthly" ? "var(--v1v-green)" : "transparent",
                  color: selectedTab === "monthly" ? "var(--v1v-bg)" : "var(--v1v-fg-muted)",
                  border: selectedTab === "monthly" ? "none" : "1px solid rgba(255,255,255,0.07)"
                }}
              >
                Mensuel
              </button>
              <button
                onClick={() => setSelectedTab("annual")}
                className="flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-all relative"
                style={{
                  borderRadius: 8,
                  background: selectedTab === "annual" ? "var(--v1v-green)" : "transparent",
                  color: selectedTab === "annual" ? "var(--v1v-bg)" : "var(--v1v-fg-muted)",
                  border: selectedTab === "annual" ? "none" : "1px solid rgba(255,255,255,0.07)"
                }}
              >
                Annuel
                <span
                  className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[8px] font-black rounded"
                  style={{ background: "var(--v1v-amber)", color: "var(--v1v-bg)" }}
                >
                  -20%
                </span>
              </button>
              <button
                onClick={() => setSelectedTab("single")}
                className="flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-all"
                style={{
                  borderRadius: 8,
                  background: selectedTab === "single" ? "var(--v1v-green)" : "transparent",
                  color: selectedTab === "single" ? "var(--v1v-bg)" : "var(--v1v-fg-muted)",
                  border: selectedTab === "single" ? "none" : "1px solid rgba(255,255,255,0.07)"
                }}
              >
                1 Scan
              </button>
            </div>

            {/* Pricing cards */}
            <div className="px-6 pb-6 space-y-3">
              {tiers[selectedTab].map((tier, idx) => (
                <motion.div
                  key={tier.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative p-4 rounded-xl transition-all cursor-pointer active:scale-[0.98]"
                  style={{
                    background: tier.badge ? "rgba(57, 184, 20, 0.05)" : "rgba(255,255,255,0.02)",
                    border: tier.badge ? "2px solid var(--v1v-green)" : "1px solid rgba(255,255,255,0.07)"
                  }}
                  onClick={() => onSelectTier(tier)}
                >
                  {/* Badge */}
                  {tier.badge && (
                    <div
                      className="absolute -top-2 left-4 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded"
                      style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
                    >
                      {tier.badge}
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-base font-black uppercase tracking-wide" style={{ color: "var(--v1v-fg)" }}>
                        {tier.name}
                      </h3>
                      <p className="text-xs mt-0.5" style={{ color: "var(--v1v-fg-muted)" }}>
                        {tier.scansPerDay ? `${tier.scansPerDay} scans/jour` : "1 scan premium"}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black" style={{ color: "var(--v1v-green)" }}>
                        {formatPrice(tier).split('/')[0]}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--v1v-fg-faint)" }}>
                        {tier.interval === 'month' && '/mois'}
                        {tier.interval === 'year' && '/an'}
                        {tier.interval === 'per_scan' && '/scan'}
                      </div>
                      {tier.monthlyEquivalent && (
                        <div className="text-[9px] mt-0.5" style={{ color: "var(--v1v-amber)" }}>
                          {tier.monthlyEquivalent.toFixed(2).replace('.', ',')}€/mois
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-1.5">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs" style={{ color: "var(--v1v-fg-muted)" }}>
                        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "var(--v1v-green)" }} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    className="w-full mt-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all active:scale-95"
                    style={{
                      background: tier.badge ? "var(--v1v-green)" : "rgba(255,255,255,0.05)",
                      color: tier.badge ? "var(--v1v-bg)" : "var(--v1v-green)",
                      border: tier.badge ? "none" : "1px solid var(--v1v-green)"
                    }}
                  >
                    {tier.interval === 'per_scan' ? 'Acheter 1 scan' : 'Commencer'}
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] mb-2" style={{ color: "var(--v1v-fg-faint)" }}>
                Pourquoi passer premium ?
              </p>
              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" style={{ color: "var(--v1v-green)" }} />
                  <span className="text-[9px]" style={{ color: "var(--v1v-fg-muted)" }}>
                    Claude AI
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3 h-3" style={{ color: "var(--v1v-amber)" }} />
                  <span className="text-[9px]" style={{ color: "var(--v1v-fg-muted)" }}>
                    Descriptions complètes
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
