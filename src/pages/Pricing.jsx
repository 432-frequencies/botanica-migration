import { useState } from "react";
import { Check, ExternalLink, RefreshCw, Shield, Sparkles } from "lucide-react";
import PageIntro from "@/components/shared/PageIntro";
import NoticePanel from "@/components/shared/NoticePanel";
import { usePremium } from "@/lib/PremiumContext";
import {
  PREMIUM_PLAN_NAME,
  formatPremiumDate,
  getPremiumHeroFeatures,
} from "@/lib/premiumConfig";

export default function Pricing() {
  const {
    packages,
    isAvailable,
    isLoading,
    isPurchasing,
    isRestoring,
    isRefreshing,
    supportsPurchases,
    isPremium,
    subscriptionStatus,
    purchasePackage,
    restorePurchases,
    refreshSubscription,
    openManageSubscriptions,
    error,
  } = usePremium();

  const [notice, setNotice] = useState(null);
  const heroFeatures = getPremiumHeroFeatures();
  const renewalDate = formatPremiumDate(subscriptionStatus?.expirationDate);

  const handlePurchase = async (pkg) => {
    const result = await purchasePackage(pkg?.raw);
    if (result?.ok) {
      setNotice({
        tone: "success",
        label: "Abonnement actif",
        message: `${PREMIUM_PLAN_NAME} est maintenant disponible sur cet iPhone.`,
      });
      return;
    }

    if (result?.status === "cancelled") {
      setNotice({
        tone: "info",
        label: "Aucun achat lancé",
        message: result.message,
      });
      return;
    }

    setNotice({
      tone: result?.status === "pending" ? "warning" : "error",
      label: result?.status === "pending" ? "Achat en attente" : "Achat interrompu",
      message: result?.message || "Impossible de finaliser l'abonnement pour le moment.",
    });
  };

  const handleRestore = async () => {
    const result = await restorePurchases();

    if (result?.ok && result.status === "restored") {
      setNotice({
        tone: "success",
        label: "Achats restaurés",
        message: `${PREMIUM_PLAN_NAME} est de nouveau disponible sur cet iPhone.`,
      });
      return;
    }

    if (result?.ok && result.status === "no_purchases") {
      setNotice({
        tone: "info",
        label: "Aucun achat à restaurer",
        message: "Aucun abonnement App Store actif n'a été retrouvé pour cet identifiant Apple.",
      });
      return;
    }

    setNotice({
      tone: "error",
      label: "Restauration interrompue",
      message: result?.message || "Impossible de restaurer les achats pour le moment.",
    });
  };

  const handleManage = async () => {
    try {
      await openManageSubscriptions();
    } catch {
      setNotice({
        tone: "error",
        label: "Gestion indisponible",
        message: "Impossible d'ouvrir la gestion de l'abonnement pour le moment.",
      });
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 40% at 10% 0%, rgba(63,163,77,0.08) 0%, transparent 65%), radial-gradient(ellipse 50% 35% at 100% 10%, rgba(21,101,192,0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 px-5 pb-10">
        <PageIntro
          kicker="Abonnement App Store"
          title={PREMIUM_PLAN_NAME}
          subtitle="Une formule claire, gérée par Apple, pour documenter davantage et ouvrir les fiches avancées sans friction."
          rightSlot={
            isRefreshing ? (
              <span className="v1v-pill">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Sync
              </span>
            ) : null
          }
        />

        {notice && (
          <NoticePanel
            className="mb-5"
            icon={notice.tone === "success" ? Sparkles : Shield}
            tone={notice.tone}
            label={notice.label}
            message={notice.message}
            dismiss={(
              <button
                onClick={() => setNotice(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ color: "var(--v1v-fg-faint)" }}
                aria-label="Fermer le message premium"
              >
                ×
              </button>
            )}
          />
        )}

        {error && !notice && (
          <NoticePanel
            className="mb-5"
            icon={Shield}
            tone="warning"
            label="Connexion abonnement"
            message={error}
          />
        )}

        <div className="v1v-surface-card mb-5 p-5" style={{ borderColor: "rgba(63,163,77,0.2)" }}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.28em] mb-1" style={{ color: "var(--v1v-green-faint)" }}>
                Ce que débloque {PREMIUM_PLAN_NAME}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                Une couche plus confortable pour les sessions terrain intensives, sans changer l'esprit du produit.
              </p>
            </div>
            <div
              className="flex h-11 w-11 items-center justify-center rounded-[14px]"
              style={{ background: "var(--v1v-green-bg-subtle)", border: "1px solid var(--v1v-green-ghost)" }}
            >
              <Sparkles className="w-4 h-4" style={{ color: "var(--v1v-green)" }} />
            </div>
          </div>
          <div className="space-y-3">
            {heroFeatures.map((feature) => (
              <div key={feature} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--v1v-green)" }} />
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--v1v-fg)" }}>{feature}</p>
              </div>
            ))}
          </div>
        </div>

        {isPremium ? (
          <div className="v1v-surface-card mb-5 p-5" style={{ background: "var(--v1v-green-bg-subtle)", borderColor: "rgba(63,163,77,0.24)" }}>
            <p className="text-[9px] font-black uppercase tracking-[0.28em] mb-2" style={{ color: "var(--v1v-green-faint)" }}>
              Abonnement actif
            </p>
            <h2 className="text-xl font-black uppercase mb-2" style={{ color: "var(--v1v-fg)" }}>
              {PREMIUM_PLAN_NAME} est en place
            </h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--v1v-fg-muted)" }}>
              {renewalDate
                ? subscriptionStatus?.willRenew
                  ? `Renouvellement géré par Apple. Prochaine échéance estimée: ${renewalDate}.`
                  : `L'accès premium reste disponible jusqu'au ${renewalDate}.`
                : "Ton accès premium est bien reconnu sur cet appareil."}
            </p>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={handleManage}
                className="v1v-button-primary w-full"
              >
                Gérer l'abonnement
              </button>
              <button
                onClick={handleRestore}
                disabled={isRestoring}
                className="v1v-button-secondary w-full disabled:opacity-50"
              >
                {isRestoring ? "Restauration..." : "Restaurer les achats"}
              </button>
            </div>
          </div>
        ) : null}

        {!isAvailable && (
          <NoticePanel
            className="mb-5"
            icon={Shield}
            tone="info"
            label="Disponible dans l'app iPhone"
            message={`${PREMIUM_PLAN_NAME} s'achète directement via l'App Store dans la version iPhone native.`}
          />
        )}

        {isAvailable && !supportsPurchases && (
          <NoticePanel
            className="mb-5"
            icon={Shield}
            tone="warning"
            label="Achats désactivés"
            message="Cet iPhone ne peut pas lancer d'achats intégrés pour le moment. Vérifie le contrôle parental ou le compte App Store."
          />
        )}

        {isAvailable && !isPremium && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="v1v-surface-card p-5">
                <p className="text-[9px] font-black uppercase tracking-[0.28em] mb-3" style={{ color: "var(--v1v-green-faint)" }}>
                  Chargement des offres App Store
                </p>
                <div className="space-y-3">
                  <div className="h-12 rounded-[14px]" style={{ background: "var(--v1v-green-bg-subtle)", animation: "skeletonPulse 1.4s ease-in-out infinite" }} />
                  <div className="h-12 rounded-[14px]" style={{ background: "var(--v1v-green-bg-subtle)", animation: "skeletonPulse 1.4s ease-in-out infinite 120ms" }} />
                </div>
              </div>
            ) : packages.length === 0 ? (
              <NoticePanel
                icon={Shield}
                tone="warning"
                label="Offres indisponibles"
                message="Aucune offre App Store n'est remontée pour le moment. Vérifie la configuration RevenueCat et App Store Connect."
                action={(
                  <button
                    onClick={() => refreshSubscription()}
                    className="shrink-0 rounded-[14px] px-3 py-3 text-[9px] font-black uppercase tracking-[0.24em]"
                    style={{ background: "#E87A00", color: "#081008" }}
                  >
                    Réessayer
                  </button>
                )}
              />
            ) : (
              <div className="space-y-3">
                {packages.map((pkg, index) => (
                  <div
                    key={pkg.id}
                    className="v1v-surface-card p-5"
                    style={{
                      borderColor: index === 0 ? "rgba(63,163,77,0.28)" : "rgba(255,255,255,0.06)",
                      background: index === 0 ? "var(--v1v-green-bg-subtle)" : "var(--v1v-surface-1)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.28em] mb-1" style={{ color: "var(--v1v-green-faint)" }}>
                          {pkg.label}
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                          {pkg.caption}
                        </p>
                      </div>
                      {index === 0 ? (
                        <span
                          className="px-2 py-1 text-[8px] font-black uppercase tracking-[0.22em]"
                          style={{ background: "var(--v1v-green)", color: "#081008", borderRadius: 999 }}
                        >
                          Recommandé
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-baseline gap-2 mb-4">
                      <p className="text-3xl font-black uppercase" style={{ color: "var(--v1v-fg)" }}>
                        {pkg.price || "Prix App Store"}
                      </p>
                    </div>

                    <button
                      onClick={() => handlePurchase(pkg)}
                      disabled={isPurchasing || !supportsPurchases}
                      className="v1v-button-primary w-full disabled:opacity-50"
                    >
                      {isPurchasing ? "Achat en cours..." : "Continuer avec l'App Store"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleRestore}
                disabled={isRestoring}
                className="v1v-button-secondary w-full disabled:opacity-50"
              >
                {isRestoring ? "Restauration..." : "Restaurer"}
              </button>
              <button
                onClick={() => refreshSubscription()}
                disabled={isRefreshing}
                className="v1v-button-secondary w-full disabled:opacity-50"
              >
                {isRefreshing ? "Actualisation..." : "Actualiser"}
              </button>
            </div>
          </div>
        )}

        <div className="v1v-surface-card-soft mt-5 p-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--v1v-blue)" }} />
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.28em] mb-2" style={{ color: "var(--v1v-blue)" }}>
                Transparence
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
                Paiement, renouvellement et annulation sont gérés par Apple. Tu peux restaurer un achat existant ou ouvrir la gestion de l'abonnement à tout moment.
              </p>
              <button
                onClick={handleManage}
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em]"
                style={{ color: "var(--v1v-blue)" }}
              >
                Gérer via Apple
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
