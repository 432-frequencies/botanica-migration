import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/api/supabaseClient";
import { getUserDiscoveries, getUserProfile } from "@/api/getUserProfile";
import { deleteAccount as requestAccountDeletion } from "@/api/deleteAccount";
import { createPageUrl } from "@/utils";
import { LogOut, Shield, ChevronRight, Trash2, Award, Users, Check, WifiOff } from "lucide-react";
import { Link } from "react-router-dom";
import SpecialtyBadges from "@/components/profile/SpecialtyBadges";
import SpeciesMastery from "@/components/profile/SpeciesMastery";
import DetailedStats from "@/components/profile/DetailedStats";
import { computeStats } from "@/utils/badges";
import XPLevelBar from "@/components/home/XPLevelBar";
import LevelUnlocks from "@/components/home/LevelUnlocks";
import ZoneCard from "@/components/profile/ZoneCard";
import SeasonCard from "@/components/profile/SeasonCard";
import PageIntro from "@/components/shared/PageIntro";
import NoticePanel from "@/components/shared/NoticePanel";
import { useIsActivePage } from "@/lib/ActivePageContext";
import { getDisplayNameInitial, isValidPublicDisplayName, resolveDisplayName, sanitizeDisplayName } from "@/lib/displayName";
import { useAdminStatus } from "@/hooks/useAdminStatus";
import { hasLaunchAccess, isFeatureEnabled } from "@/lib/app-config";
import { usePremium } from "@/lib/PremiumContext";
import { PREMIUM_PLAN_NAME, formatPremiumDate } from "@/lib/premiumConfig";
import { useTranslation } from "@/lib/i18n";

const G = "var(--v1v-green)";
const GDB = "var(--v1v-green-bg)";
const BLUE = "var(--v1v-blue)";
const BLUE_BG = "var(--v1v-blue-bg)";
const EARTH = "var(--v1v-earth)";
const SURFACE = "var(--v1v-surface-1)";

export default function Profile() {
  const { t } = useTranslation();
  const [userData, setUserData] = useState(null);
  const [user, setUser] = useState(null);
  const [specialtyStats, setSpecialtyStats] = useState(null);
  const [userDiscoveries, setUserDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteStep, setDeleteStep] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameNotice, setDisplayNameNotice] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadNotice, setLoadNotice] = useState(null);
  const [accountNotice, setAccountNotice] = useState(null);
  const [subscriptionNotice, setSubscriptionNotice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  const isActive = useIsActivePage("Profile");
  const { isAdmin } = useAdminStatus();
  const {
    isPremium,
    isAvailable: premiumAvailable,
    isLoading: premiumLoading,
    isRefreshing: premiumRefreshing,
    isRestoring,
    subscriptionStatus,
    restorePurchases,
    openManageSubscriptions,
  } = usePremium();
  const adminImportEnabled = isFeatureEnabled("adminImport");
  useEffect(() => {
    if (!isActive) return;
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadData({ background: false });
    } else {
      loadData({ background: true });
    }
  }, [isActive]);

  const loadData = async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    if (background) setRefreshing(true);
    setLoadError(null);
    setLoadNotice(null);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setUser(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    const authDisplayName = resolveDisplayName({
      fullName: authUser.user_metadata?.full_name,
      email: authUser.email,
    });
    setUser({ email: authUser.email, full_name: authDisplayName });

    try {
      const nextUserData = await getUserProfile({ includeDiscoveries: true, forceFresh: background });
      setUserData(nextUserData);
      setUserDiscoveries(nextUserData?.discoveries || []);
      setSpecialtyStats(computeStats(nextUserData?.discoveries || [], nextUserData?.profile));

      const publicName = resolveDisplayName({
        displayName: nextUserData?.profile?.display_name,
        fullName: authUser.user_metadata?.full_name,
        email: authUser.email,
      });

      setUser({ email: authUser.email, full_name: publicName });
      setDisplayNameDraft(publicName);
    } catch {
      try {
        const fallbackDiscoveries = await getUserDiscoveries(authUser.email, { forceFresh: background });
        setUserDiscoveries(fallbackDiscoveries);
        setSpecialtyStats(computeStats(fallbackDiscoveries, userData?.profile || null));
        setLoadNotice(t("profile.loadNotice"));
        setDisplayNameDraft(authDisplayName);
      } catch {
        setLoadError(t("profile.loadError"));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      window.location.replace('/login');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleting(true);
      await requestAccountDeletion();
      try {
        await supabase.auth.signOut();
      } catch {}
      window.location.replace('/login');
    } catch (error) {
      console.error('Error deleting account:', error);
      setDeleting(false);
      setDeleteStep(0);
      setAccountNotice(
        /unauthorized/i.test(error?.message || "")
          ? t("profile.expiredDelete")
          : t("profile.deleteError")
      );
    }
  };

  const handleRestorePurchases = async () => {
    const result = await restorePurchases();

    if (result?.ok && result.status === "restored") {
      setSubscriptionNotice({
        tone: "success",
        label: t("profile.purchasesRestored"),
        message: t("profile.purchasesRestoredBody", { plan: PREMIUM_PLAN_NAME }),
      });
      return;
    }

    if (result?.ok && result.status === "no_purchases") {
      setSubscriptionNotice({
        tone: "info",
        label: t("profile.noPurchases"),
        message: t("profile.noPurchasesBody"),
      });
      return;
    }

    setSubscriptionNotice({
      tone: "error",
      label: t("profile.restoreInterrupted"),
      message: result?.message || t("profile.restoreError"),
    });
  };

  const handleOpenManageSubscription = async () => {
    try {
      await openManageSubscriptions();
    } catch {
      setSubscriptionNotice({
        tone: "error",
        label: t("profile.manageUnavailable"),
        message: t("profile.manageUnavailableBody"),
      });
    }
  };

  const handleSaveDisplayName = async () => {
    const nextDisplayName = sanitizeDisplayName(displayNameDraft);
    if (!user?.email) return;

    if (!isValidPublicDisplayName(nextDisplayName)) {
      setDisplayNameNotice({
        type: "error",
        text: t("profile.displayNameShort"),
      });
      return;
    }

    try {
      setSavingDisplayName(true);
      setDisplayNameNotice(null);

      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({
          display_name: nextDisplayName,
          updated_at: new Date().toISOString(),
        })
        .eq("user_email", user.email);

      if (profileError) throw profileError;

      await Promise.allSettled([
        supabase.auth.updateUser({ data: { full_name: nextDisplayName } }),
        supabase.from("zone_leaders").update({ display_name: nextDisplayName }).eq("user_email", user.email),
        supabase.from("leaderboard").update({
          display_name: nextDisplayName,
          last_updated: new Date().toISOString(),
        }).eq("user_email", user.email),
        supabase.from("friend_requests").update({ sender_name: nextDisplayName }).eq("sender_email", user.email),
        supabase.from("friend_requests").update({ receiver_name: nextDisplayName }).eq("receiver_email", user.email),
      ]);

      setUser((prev) => prev ? { ...prev, full_name: nextDisplayName } : prev);
      setUserData((prev) => prev ? {
        ...prev,
        profile: {
          ...(prev.profile || {}),
          display_name: nextDisplayName,
        },
      } : prev);
      setDisplayNameDraft(nextDisplayName);
      setDisplayNameNotice({
        type: "success",
        text: t("profile.displayNameSaved"),
      });
    } catch (error) {
      console.error("[Profile] display name update failed:", error);
      setDisplayNameNotice({
        type: "error",
        text: t("profile.displayNameError"),
      });
    } finally {
      setSavingDisplayName(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--v1v-bg)" }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center" style={{ background: "var(--v1v-bg)" }}>
        <Shield className="w-8 h-8" style={{ color: "var(--v1v-green-faint)" }} />
        <p className="text-xs font-black uppercase tracking-[0.35em]" style={{ color: "var(--v1v-green-faint)" }}>{t("profile.signInRequired")}</p>
        <p className="text-sm max-w-[280px]" style={{ color: "var(--v1v-fg-muted)" }}>
          {t("profile.signInRequiredBody")}
        </p>
        <button
          onClick={() => window.location.replace("/login")}
          className="px-6 py-3 text-xs font-black uppercase tracking-[0.28em]"
          style={{ background: G, color: "#081008" }}
        >
          {t("login.signIn")}
        </button>
      </div>
    );
  }

  const profile = userData?.profile;
  const achievements = userData?.achievements || [];
  const totalXP = profile?.total_points || 0;
  const hasPremiumAccess = hasLaunchAccess(profile, isPremium);
  const publicDisplayName = resolveDisplayName({
    displayName: profile?.display_name,
    fullName: user?.full_name,
    email: user?.email,
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>

      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        background: "radial-gradient(ellipse 68% 48% at 0% 0%, rgba(63,163,77,0.08) 0%, transparent 60%), radial-gradient(ellipse 45% 35% at 100% 10%, rgba(21,101,192,0.08) 0%, transparent 70%), radial-gradient(ellipse 35% 30% at 50% 100%, rgba(109,76,65,0.08) 0%, transparent 70%)"
      }} />

      <PageIntro
        kicker={t("profile.title")}
        title={t("layout.profile")}
        subtitle={t("profile.subtitle")}
        rightSlot={(
          <>
            {refreshing && <span className="v1v-pill">{t("home.syncing")}</span>}
            <button onClick={handleLogout} aria-label={t("profile.logout")} className="v1v-surface-card-soft flex min-h-[44px] min-w-[44px] items-center justify-center transition-opacity active:opacity-40">
              <LogOut className="w-4 h-4" style={{ color: "var(--v1v-fg-faint)" }} />
            </button>
          </>
        )}
      />

      <div className="relative z-10 px-5 pb-6">

        {loadError && (
          <NoticePanel
            className="mb-5"
            icon={WifiOff}
            tone="warning"
            label={t("leaderboard.partialLoad")}
            message={loadError}
            action={(
              <button
                onClick={loadData}
                className="shrink-0 rounded-[14px] px-3 py-3 text-[9px] font-black uppercase tracking-[0.24em]"
                style={{ background: "#E87A00", color: "#081008" }}
              >
                {t("common.retry")}
              </button>
            )}
          />
        )}

        {loadNotice && !loadError && (
          <NoticePanel
            className="mb-5"
            icon={Shield}
            tone="info"
            label={t("journal.partialView")}
            message={loadNotice}
            dismiss={(
              <button
                onClick={() => setLoadNotice(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ color: BLUE }}
                aria-label={t("journal.partialClose")}
              >
                ×
              </button>
            )}
          />
        )}

        {accountNotice && (
          <NoticePanel
            className="mb-5"
            icon={Trash2}
            tone="error"
            label="Suppression interrompue"
            message={accountNotice}
            dismiss={(
              <button
                onClick={() => setAccountNotice(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ color: "var(--v1v-danger-text)" }}
                aria-label="Fermer le message de suppression"
              >
                ×
              </button>
            )}
          />
        )}

        {subscriptionNotice && (
          <NoticePanel
            className="mb-5"
            icon={Shield}
            tone={subscriptionNotice.tone}
            label={subscriptionNotice.label}
            message={subscriptionNotice.message}
            dismiss={(
              <button
                onClick={() => setSubscriptionNotice(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center"
                style={{ color: "var(--v1v-fg-faint)" }}
                aria-label="Fermer le message d'abonnement"
              >
                ×
              </button>
            )}
          />
        )}

        {/* Avatar & info */}
        <div className="v1v-surface-card mb-6 flex items-center gap-4 p-4">
          <div
            className="w-12 h-12 flex items-center justify-center text-lg font-black flex-shrink-0 rounded-[14px]"
            style={{ background: "var(--v1v-surface-2)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--v1v-fg)" }}
          >
            {getDisplayNameInitial(publicDisplayName, user?.email)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base font-black uppercase truncate" style={{ color: "var(--v1v-fg)", letterSpacing: "0.04em" }}>{publicDisplayName}</h2>
            </div>
            <p className="text-[11px] truncate" style={{ color: "var(--v1v-fg-faint)" }}>Email de connexion privé · {user?.email}</p>
          </div>
        </div>

        {premiumAvailable && (
          <div
            className="v1v-surface-card mb-5 p-4"
            style={{
              background: hasPremiumAccess ? "var(--v1v-green-bg-subtle)" : "var(--v1v-surface-1)",
              border: hasPremiumAccess ? "1px solid rgba(63,163,77,0.24)" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: "var(--v1v-green-faint)" }}>
                  Abonnement App Store
                </p>
                <p className="text-base font-black uppercase" style={{ color: "var(--v1v-fg)" }}>
                  {hasPremiumAccess ? `${PREMIUM_PLAN_NAME} actif` : `Passer à ${PREMIUM_PLAN_NAME}`}
                </p>
                <p className="text-[11px] leading-relaxed mt-2" style={{ color: "var(--v1v-fg-muted)" }}>
                  {hasPremiumAccess
                    ? subscriptionStatus?.expirationDate
                      ? subscriptionStatus?.willRenew
                        ? `Renouvellement géré par Apple. Prochaine échéance estimée: ${formatPremiumDate(subscriptionStatus.expirationDate)}.`
                        : `L'accès premium reste disponible jusqu'au ${formatPremiumDate(subscriptionStatus.expirationDate)}.`
                      : "Ton iPhone reconnaît bien l'abonnement premium."
                    : "Scans illimités, alternatives d'identification et fiches détaillées, gérés proprement par Apple."}
                </p>
              </div>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-[14px]"
                style={{ background: "var(--v1v-green-bg-subtle)", border: "1px solid var(--v1v-green-ghost)" }}
              >
                <Shield className="w-4 h-4" style={{ color: "var(--v1v-green)" }} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {hasPremiumAccess ? (
                <>
                  <button
                    onClick={handleOpenManageSubscription}
                    className="v1v-button-primary w-full"
                  >
                    Gérer l'abonnement
                  </button>
                  <button
                    onClick={handleRestorePurchases}
                    disabled={isRestoring}
                    className="v1v-button-secondary w-full disabled:opacity-50"
                  >
                    {isRestoring ? "Restauration..." : "Restaurer les achats"}
                  </button>
                </>
              ) : (
                <Link to={createPageUrl("Pricing")} className="block">
                  <button className="v1v-button-primary w-full">
                    {premiumLoading || premiumRefreshing ? "Chargement..." : `Découvrir ${PREMIUM_PLAN_NAME}`}
                  </button>
                </Link>
              )}
            </div>
          </div>
        )}

        <div
          className="v1v-surface-card mb-5 p-4"
          style={{ background: BLUE_BG, border: "1px solid var(--v1v-blue-border)" }}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: "var(--v1v-blue-muted)" }}>
                Nom public
              </p>
              <p className="text-[11px] leading-relaxed max-w-[280px]" style={{ color: "var(--v1v-fg-muted)" }}>
                Visible dans les zones, les classements et les invitations. Ton adresse email reste privée.
              </p>
            </div>
            <span
              className="px-2 py-1 text-[7px] font-black uppercase tracking-[0.25em]"
              style={{ background: "var(--v1v-blue-bg)", color: BLUE, border: "1px solid var(--v1v-blue-border)" }}
            >
              Public
            </span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input
              value={displayNameDraft}
              onChange={(event) => {
                setDisplayNameDraft(event.target.value);
                if (displayNameNotice) setDisplayNameNotice(null);
              }}
              maxLength={24}
              placeholder="Choisis ton nom visible"
              className="flex-1 min-h-[44px] px-3 text-sm outline-none"
              style={{
                background: SURFACE,
                color: "var(--v1v-fg)",
                border: "1px solid var(--v1v-blue-border)",
              }}
            />
            <button
              onClick={handleSaveDisplayName}
              disabled={savingDisplayName}
              className="min-h-[44px] px-4 text-[10px] font-black uppercase tracking-[0.24em] transition-opacity disabled:opacity-40"
              style={{ background: G, color: "#081008" }}
            >
              {savingDisplayName ? "..." : "Enregistrer"}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3 mt-2">
            <p className="text-[10px]" style={{ color: "var(--v1v-fg-faint)" }}>
              3 à 24 caractères. Lettres, chiffres, espaces, tirets et points.
            </p>
            <p className="text-[10px] font-black uppercase" style={{ color: "var(--v1v-blue-muted)" }}>
              {sanitizeDisplayName(displayNameDraft).length}/24
            </p>
          </div>
          {displayNameNotice && (
            <div className="flex items-center gap-2 mt-3">
              {displayNameNotice.type === "success" && <Check className="w-3.5 h-3.5" style={{ color: G }} />}
              <p
                className="text-[11px]"
                style={{ color: displayNameNotice.type === "success" ? G : "var(--v1v-danger-text)" }}
              >
                {displayNameNotice.text}
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        {(() => {
          const uniqueSpecies = new Set(userDiscoveries.map(d => (d.common_name || "").toLowerCase().trim())).size;
          return (
            <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="v1v-surface-card-soft py-4 text-center">
                <p className="text-2xl font-black mb-0.5 number-display" style={{ color: "var(--v1v-green)" }}>{uniqueSpecies}</p>
                <p className="text-[8px] tracking-[0.1em] uppercase font-black" style={{ color: "var(--v1v-fg-faint)" }}>Espèces</p>
              </div>
              <div className="v1v-surface-card-soft py-4 text-center">
                <p className="text-2xl font-black mb-0.5 number-display" style={{ color: BLUE }}>{profile?.total_plants || 0}</p>
                <p className="text-[8px] tracking-[0.1em] uppercase font-black" style={{ color: "var(--v1v-fg-faint)" }}>Observations</p>
              </div>
              <div className="v1v-surface-card-soft py-4 text-center">
                <p className="text-2xl font-black mb-0.5 number-display" style={{ color: EARTH }}>{totalXP}</p>
                <p className="text-[8px] tracking-[0.1em] uppercase font-black" style={{ color: "var(--v1v-fg-faint)" }}>Contribution</p>
              </div>
            </div>
          );
        })()}

        {/* XP Level */}
        <div className="mb-4">
          <XPLevelBar totalXP={totalXP} />
        </div>

        {/* Saison en cours */}
        <div className="mb-4">
          <SeasonCard userEmail={user?.email} discoveries={userDiscoveries} />
        </div>

        {/* Zone territoriale */}
        <div className="mb-6">
          <ZoneCard
            userEmail={user?.email}
            displayName={publicDisplayName}
            discoveries={userDiscoveries}
            isActive={isActive}
          />
        </div>

        <Link to="/support">
          <div
            className="v1v-surface-card p-4 mb-3 cursor-pointer transition-all hover:opacity-90"
            style={{ border: "1px solid var(--v1v-green-dim)", background: "var(--v1v-green-bg)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: "var(--v1v-fg-faint)" }}>Aide & données</p>
                <p className="font-black uppercase text-sm" style={{ color: G }}>Centre d'aide W1LD</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--v1v-fg-muted)" }}>Support · confidentialité · suppression du compte</p>
              </div>
              <Shield className="w-5 h-5" style={{ color: G }} />
            </div>
          </div>
        </Link>

        <Link to={createPageUrl("Friends")}>
          <div
            className="v1v-surface-card p-4 mb-3 cursor-pointer transition-all hover:opacity-90"
            style={{ border: "1px solid var(--v1v-blue-border)", background: BLUE_BG }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: "var(--v1v-fg-faint)" }}>Réseau vivant</p>
                <p className="font-black uppercase text-sm" style={{ color: BLUE }}>Amis & réseau terrain</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--v1v-fg-muted)" }}>Invitations · proximité · exploration partagée</p>
              </div>
              <Users className="w-5 h-5" style={{ color: BLUE }} />
            </div>
          </div>
        </Link>
      </div>

      {userDiscoveries.length === 0 && (
        <div className="relative z-10 px-5 mb-6">
          <div className="p-5" style={{ background: "var(--v1v-green-bg-subtle)", border: "1px solid var(--v1v-green-ghost)", borderRadius: 16 }}>
            <p className="text-[9px] font-black uppercase tracking-[0.32em] mb-2" style={{ color: "var(--v1v-green-faint)" }}>
              Journal à lancer
            </p>
            <p className="text-base font-black mb-2" style={{ color: "var(--v1v-fg)" }}>
              Ton profil est prêt. Il manque juste ta première observation.
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--v1v-fg-muted)" }}>
              Ouvre le scanner depuis l’accueil, ajoute une première espèce, puis reviens ici pour voir ton parcours prendre forme.
            </p>
          </div>
        </div>
      )}

      {/* Level Unlocks */}
      <div className="relative z-10 px-5 mb-6">
        <LevelUnlocks totalXP={totalXP} />
      </div>

      {/* Specialty Badges */}
      <div className="relative z-10 px-5 mb-6">
        <SpecialtyBadges stats={specialtyStats || {}} />
      </div>

      {/* Species Mastery */}
      <SpeciesMastery discoveries={userDiscoveries} />

      {/* Detailed Stats */}
      <DetailedStats discoveries={userDiscoveries} />

      {/* Achievements */}
      <div className="relative z-10 px-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1" style={{ background: "var(--v1v-green-ghost)" }} />
          <p className="text-xs font-black tracking-[0.4em] uppercase" style={{ color: "var(--v1v-fg-faint)" }}>
            Repères acquis ({achievements.length})
          </p>
          <div className="h-px flex-1" style={{ background: "var(--v1v-green-ghost)" }} />
        </div>
        {achievements.length === 0 ? (
          <div className="p-6 text-center" style={{ border: `1px solid var(--v1v-green-ghost)`, background: "var(--v1v-green-bg-light)" }}>
            <Shield className="w-6 h-6 mx-auto mb-2" style={{ color: "var(--v1v-fg-faint)" }} />
            <p className="text-xs font-black uppercase tracking-[0.28em] mb-2" style={{ color: "var(--v1v-fg-muted)" }}>
              Tes repères arrivent bientôt
            </p>
            <p className="text-[11px] max-w-[260px] mx-auto" style={{ color: "var(--v1v-fg-faint)" }}>
              Une observation utile, une zone documentée ou une série lancée, et tes premiers badges apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {achievements.map(a => (
              <div key={a.id} className="p-4 flex items-center gap-3" style={{ border: `1px solid var(--v1v-green-ghost)`, background: GDB }}>
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <p className="font-black text-xs uppercase" style={{ color: "var(--v1v-fg)" }}>{a.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--v1v-fg-muted)" }}>{a.description}</p>
                  {a.points_bonus > 0 && <p className="text-xs font-black mt-1" style={{ color: G }}>+{a.points_bonus} XP</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Badges Link */}
      <div className="relative z-10 px-5 mt-6">
        <Link to="/Badges">
          <div
            className="p-4 flex items-center justify-between transition-all hover:opacity-90 mb-3"
            style={{ border: "1px solid var(--v1v-green-ghost)", background: "var(--v1v-green-bg-subtle)" }}
          >
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5" style={{ color: G }} />
              <div>
                <p className="font-black uppercase text-sm" style={{ color: "var(--v1v-fg)" }}>Repères naturalistes</p>
                <p className="text-xs tracking-wider mt-0.5" style={{ color: "var(--v1v-fg-muted)" }}>Biomes · Spécialités · Zones</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: "var(--v1v-fg-faint)" }} />
          </div>
        </Link>
      </div>

      {/* Admin Panel — visible uniquement pour l'admin */}
      {isAdmin && (
        <div className="relative z-10 px-5 mt-4">
          <Link to="/admin-affiliates">
            <div className="p-4 flex items-center justify-between transition-all hover:opacity-90 mb-3"
              style={{ border: "1px solid var(--v1v-earth-border)", background: "var(--v1v-earth-bg)" }}>
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5" style={{ color: EARTH }} />
                <div>
                  <p className="font-black uppercase text-sm" style={{ color: EARTH }}>Affiliation</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--v1v-fg-muted)" }}>Influenceurs · conversions · dû estimé</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "var(--v1v-fg-faint)" }} />
            </div>
          </Link>

          {adminImportEnabled && (
            <Link to="/admin-import">
            <div className="p-4 flex items-center justify-between transition-all hover:opacity-90"
              style={{ border: "1px solid var(--v1v-green-ghost)", background: "var(--v1v-green-bg)" }}>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" style={{ color: G }} />
                <div>
                  <p className="font-black uppercase text-sm" style={{ color: G }}>Admin Panel</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--v1v-fg-muted)" }}>Import · Photos · Tests</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "var(--v1v-fg-faint)" }} />
            </div>
            </Link>
          )}
        </div>
      )}

      {/* Delete Account */}
      <div className="relative z-10 px-5 mt-6 mb-8">
        <button
            onClick={() => setDeleteStep(1)}
            className="w-full min-h-[44px] py-3 flex items-center justify-center gap-2 transition-opacity hover:opacity-70"
            style={{ border: "1px solid var(--v1v-danger-border)", color: "var(--v1v-danger-text)" }}
            aria-label="Supprimer le compte"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-[0.25em]">Supprimer le compte</span>
          </button>
      </div>

      <div className="h-24" />

      {/* First confirmation modal — portaled to document.body to escape KeepAlive stacking context */}
      {deleteStep === 1 && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" style={{ background: "var(--v1v-bg-overlay-full)" }}>
          <div className="w-full max-w-sm p-6" style={{ background: "var(--v1v-bg-card)", border: "1px solid var(--v1v-danger-border)" }}>
            <Trash2 className="w-7 h-7 mb-4" style={{ color: "var(--v1v-danger-text)" }} />
            <h2 className="text-xl font-black uppercase tracking-wider mb-3" style={{ color: "var(--v1v-fg)" }}>Supprimer le compte ?</h2>
            <p className="text-sm mb-6" style={{ color: "var(--v1v-fg-muted)" }}>
              Cette action supprime définitivement ton compte, tes découvertes et ta progression.
            </p>
            <button
              onClick={() => setDeleteStep(2)}
              className="w-full min-h-[44px] py-3 text-xs font-black uppercase tracking-[0.25em] mb-3 transition-all"
              style={{ background: "rgba(180,30,30,0.85)", color: "#fff" }}
            >
              Oui, continuer
            </button>
            <button
              onClick={() => setDeleteStep(0)}
              className="w-full min-h-[44px] text-xs uppercase tracking-widest"
              style={{ color: "var(--v1v-fg-faint)" }}
            >
              Annuler
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Second confirmation modal — portaled to document.body */}
      {deleteStep === 2 && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
          <div className="w-full max-w-md p-6 pb-8 mx-4 mb-4" style={{ background: "var(--v1v-bg-card)", border: "2px solid var(--v1v-danger)", borderRadius: "2px" }}>
            <div className="flex items-center gap-2 px-3 py-2 mb-5" style={{ background: "rgba(180,30,30,0.12)", border: "1px solid var(--v1v-danger-border)" }}>
              <Trash2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--v1v-danger)" }} />
              <p className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: "var(--v1v-danger)" }}>
                Action irréversible
              </p>
            </div>
            <h2 className="text-xl font-black uppercase tracking-wider mb-2" style={{ color: "var(--v1v-fg)" }}>Dernier avertissement</h2>
            <ul className="text-xs mb-5 space-y-1" style={{ color: "var(--v1v-fg-muted)" }}>
              {[
                `${userDiscoveries.length} observation(s) supprimée(s)`,
                "Tous les XP, rangs et badges effacés",
                "Aucune restauration automatique possible",
                "Le compte sera définitivement fermé",
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span style={{ color: "var(--v1v-danger-text)" }}>✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="w-full min-h-[52px] py-3 text-xs font-black uppercase tracking-[0.3em] mb-3 transition-all disabled:opacity-40"
              style={{ background: "var(--v1v-danger)", color: "#fff", border: "none" }}
            >
              {deleting ? "Suppression..." : "Confirmer la suppression"}
            </button>
            <button
              onClick={() => setDeleteStep(1)}
              className="w-full min-h-[44px] text-xs uppercase tracking-widest"
              style={{ color: "var(--v1v-fg-faint)" }}
            >
              Retour
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
