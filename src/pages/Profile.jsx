import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/api/supabaseClient";
import { getUserProfile } from "@/api/getUserProfile";
import { deleteAccount as requestAccountDeletion } from "@/api/deleteAccount";
import { createPageUrl } from "@/utils";
import { LogOut, Shield, ChevronRight, Trash2, Award, Users, Check } from "lucide-react";
import { Link } from "react-router-dom";
import SpecialtyBadges from "@/components/profile/SpecialtyBadges";
import SpeciesMastery from "@/components/profile/SpeciesMastery";
import DetailedStats from "@/components/profile/DetailedStats";
import { computeStats } from "@/utils/badges";
import XPLevelBar from "@/components/home/XPLevelBar";
import LevelUnlocks from "@/components/home/LevelUnlocks";
import ZoneCard from "@/components/profile/ZoneCard";
import SeasonCard from "@/components/profile/SeasonCard";
import { useIsActivePage } from "@/lib/ActivePageContext";
import { getDisplayNameInitial, isValidPublicDisplayName, resolveDisplayName, sanitizeDisplayName } from "@/lib/displayName";
import { normalizeSpeciesRecord } from "@/lib/species";
import { isAdminEmail } from "@/lib/app-config";

const G = "var(--v1v-green)";
const GDB = "var(--v1v-green-bg)";

export default function Profile() {
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

  const isActive = useIsActivePage("Profile");
  useEffect(() => {
    if (!isActive) return;
    loadData();
  }, [isActive]);

  const loadData = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setLoading(false); return; }
    const authDisplayName = resolveDisplayName({
      fullName: authUser.user_metadata?.full_name,
      email: authUser.email,
    });
    setUser({ email: authUser.email, full_name: authDisplayName });

    const [profileRes, discoveries] = await Promise.allSettled([
      getUserProfile(),
      supabase.from('plant_discoveries').select('*').eq('user_email', authUser.email).order('created_at', { ascending: false }).limit(500),
    ]);

    let resolvedDiscoveries = [];

    if (profileRes.status === "fulfilled") {
      const nextUserData = profileRes.value;
      setUserData(nextUserData);
      resolvedDiscoveries = (nextUserData?.discoveries || []).map(normalizeSpeciesRecord);

      const publicName = resolveDisplayName({
        displayName: nextUserData?.profile?.display_name,
        fullName: authUser.user_metadata?.full_name,
        email: authUser.email,
      });

      setUser({ email: authUser.email, full_name: publicName });
      setDisplayNameDraft(publicName);
    } else {
      setDisplayNameDraft(authDisplayName);
    }

    if (!resolvedDiscoveries.length && discoveries.status === "fulfilled") {
      resolvedDiscoveries = (discoveries.value.data || []).map(normalizeSpeciesRecord);
    }

    setUserDiscoveries(resolvedDiscoveries);
    setSpecialtyStats(computeStats(resolvedDiscoveries, profileRes.status === "fulfilled" ? profileRes.value?.profile : null));
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleting(true);
      await requestAccountDeletion();
      await supabase.auth.signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error deleting account:', error);
      setDeleting(false);
      setDeleteStep(0);
      window.alert("Impossible de supprimer le compte pour le moment. Contacte le support si le problème persiste.");
    }
  };

  const handleSaveDisplayName = async () => {
    const nextDisplayName = sanitizeDisplayName(displayNameDraft);
    if (!user?.email) return;

    if (!isValidPublicDisplayName(nextDisplayName)) {
      setDisplayNameNotice({
        type: "error",
        text: "Choisis un nom public d'au moins 3 caractères.",
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
        text: "Ton nom public est maintenant visible partout dans W1LD.",
      });
    } catch (error) {
      console.error("[Profile] display name update failed:", error);
      setDisplayNameNotice({
        type: "error",
        text: "Impossible d'enregistrer ton nom public pour le moment.",
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

  const profile = userData?.profile;
  const achievements = userData?.achievements || [];
  const totalXP = profile?.total_points || 0;
  const publicDisplayName = resolveDisplayName({
    displayName: profile?.display_name,
    fullName: user?.full_name,
    email: user?.email,
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>

      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        background: "radial-gradient(ellipse 70% 50% at 0% 0%, rgba(57,184,20,0.05) 0%, transparent 60%), radial-gradient(ellipse 45% 35% at 100% 10%, rgba(196,154,10,0.05) 0%, transparent 70%)"
      }} />

      {/* Header */}
      <div className="relative z-10 px-5 pt-4 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: "var(--v1v-fg-faint)" }}>Agent Dossier</p>
            <h1 className="text-xl font-black uppercase leading-none" style={{ color: "var(--v1v-fg)", letterSpacing: "0.04em" }}>Profil</h1>
          </div>
          <button onClick={handleLogout} aria-label="Se déconnecter" className="flex items-center justify-center min-h-[44px] min-w-[44px] transition-opacity active:opacity-40">
            <LogOut className="w-4 h-4" style={{ color: "var(--v1v-fg-faint)" }} />
          </button>
        </div>

        {/* Avatar & info */}
        <div className="flex items-center gap-4 mb-6" style={{ paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div
            className="w-12 h-12 flex items-center justify-center text-lg font-black flex-shrink-0"
            style={{ background: "var(--v1v-surface-2)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--v1v-fg)" }}
          >
            {getDisplayNameInitial(publicDisplayName, user?.email)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base font-black uppercase truncate" style={{ color: "var(--v1v-fg)", letterSpacing: "0.04em" }}>{publicDisplayName}</h2>
              {profile?.is_pro && (
                <span className="text-[7px] font-black tracking-[0.15em] px-1.5 py-0.5 flex-shrink-0" style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}>ELITE</span>
              )}
            </div>
            <p className="text-[11px] truncate" style={{ color: "var(--v1v-fg-faint)" }}>Email de connexion privé · {user?.email}</p>
          </div>
        </div>

        <div
          className="mb-5 p-4"
          style={{ background: "rgba(45,122,31,0.06)", border: "1px solid rgba(45,122,31,0.18)" }}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: "rgba(45,122,31,0.5)" }}>
                Nom public
              </p>
              <p className="text-[11px] leading-relaxed max-w-[280px]" style={{ color: "rgba(45,122,31,0.55)" }}>
                Visible dans les zones, les classements et les invitations. Ton adresse email reste privée.
              </p>
            </div>
            <span
              className="px-2 py-1 text-[7px] font-black uppercase tracking-[0.25em]"
              style={{ background: "rgba(45,122,31,0.1)", color: G, border: "1px solid rgba(45,122,31,0.2)" }}
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
                background: "var(--v1v-surface-1)",
                color: "var(--v1v-fg)",
                border: "1px solid rgba(45,122,31,0.18)",
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
            <p className="text-[10px]" style={{ color: "rgba(45,122,31,0.38)" }}>
              3 à 24 caractères. Lettres, chiffres, espaces, tirets et points.
            </p>
            <p className="text-[10px] font-black uppercase" style={{ color: "rgba(45,122,31,0.4)" }}>
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
              <div className="py-4 text-center" style={{ background: "var(--v1v-surface-1)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-2xl font-black mb-0.5 number-display" style={{ color: "var(--v1v-green)" }}>{uniqueSpecies}</p>
                <p className="text-[8px] tracking-[0.1em] uppercase font-black" style={{ color: "var(--v1v-fg-faint)" }}>Espèces</p>
              </div>
              <div className="py-4 text-center" style={{ background: "var(--v1v-surface-1)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-2xl font-black mb-0.5 number-display" style={{ color: "var(--v1v-blue)" }}>{profile?.total_plants || 0}</p>
                <p className="text-[8px] tracking-[0.1em] uppercase font-black" style={{ color: "var(--v1v-fg-faint)" }}>Observations</p>
              </div>
              <div className="py-4 text-center" style={{ background: "var(--v1v-surface-1)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <p className="text-2xl font-black mb-0.5 number-display" style={{ color: "var(--v1v-amber)" }}>{totalXP}</p>
                <p className="text-[8px] tracking-[0.1em] uppercase font-black" style={{ color: "var(--v1v-fg-faint)" }}>XP</p>
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
          />
        </div>

        <Link to="/support">
          <div
            className="p-4 mb-2 cursor-pointer transition-all hover:opacity-90"
            style={{ border: "1px solid var(--v1v-green-dim)", background: "var(--v1v-green-bg)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: "rgba(45,122,31,0.5)" }}>Aide & données</p>
                <p className="font-black uppercase text-sm" style={{ color: G }}>Centre d'aide W1LD</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(45,122,31,0.45)" }}>Support · confidentialité · suppression du compte</p>
              </div>
              <Shield className="w-5 h-5" style={{ color: G }} />
            </div>
          </div>
        </Link>

        <Link to={createPageUrl("Friends")}>
          <div
            className="p-4 mb-2 cursor-pointer transition-all hover:opacity-90"
            style={{ border: "1px solid rgba(45,122,31,0.18)", background: "rgba(45,122,31,0.06)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: "rgba(45,122,31,0.5)" }}>Escouade</p>
                <p className="font-black uppercase text-sm" style={{ color: G }}>Amis & réseau terrain</p>
                <p className="text-xs mt-0.5" style={{ color: "rgba(45,122,31,0.45)" }}>Invitations · proximité · exploration partagée</p>
              </div>
              <Users className="w-5 h-5" style={{ color: G }} />
            </div>
          </div>
        </Link>
      </div>

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
          <div className="h-px flex-1" style={{ background: "rgba(45,122,31,0.15)" }} />
          <p className="text-xs font-black tracking-[0.4em] uppercase" style={{ color: "rgba(45,122,31,0.5)" }}>
            Découvertes ({achievements.length})
          </p>
          <div className="h-px flex-1" style={{ background: "rgba(45,122,31,0.15)" }} />
        </div>
        {achievements.length === 0 ? (
          <div className="p-6 text-center" style={{ border: `1px solid rgba(45,122,31,0.15)`, background: "rgba(45,122,31,0.04)" }}>
            <Shield className="w-6 h-6 mx-auto mb-2" style={{ color: "rgba(45,122,31,0.3)" }} />
            <p className="text-xs font-black uppercase tracking-[0.28em] mb-2" style={{ color: "rgba(45,122,31,0.45)" }}>
              Tes repères arrivent bientôt
            </p>
            <p className="text-[11px] max-w-[260px] mx-auto" style={{ color: "rgba(45,122,31,0.38)" }}>
              Une observation utile, une zone documentée ou une série lancée, et tes premiers badges apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {achievements.map(a => (
              <div key={a.id} className="p-4 flex items-center gap-3" style={{ border: `1px solid rgba(45,122,31,0.15)`, background: GDB }}>
                <span className="text-2xl">{a.icon}</span>
                <div>
                  <p className="font-black text-xs uppercase" style={{ color: "var(--v1v-fg)" }}>{a.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(45,122,31,0.45)" }}>{a.description}</p>
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
                <p className="font-black uppercase text-sm" style={{ color: "var(--v1v-fg)" }}>Badges Naturaliste</p>
                <p className="text-xs tracking-wider mt-0.5" style={{ color: "rgba(45,122,31,0.45)" }}>Biomes · Spécialités · Zones</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: "rgba(45,122,31,0.35)" }} />
          </div>
        </Link>
      </div>

      {/* Admin Panel — visible uniquement pour l'admin */}
      {isAdminEmail(user?.email) && (
        <div className="relative z-10 px-5 mt-4">
          <Link to="/admin-affiliates">
            <div className="p-4 flex items-center justify-between transition-all hover:opacity-90 mb-3"
              style={{ border: "1px solid var(--v1v-green-ghost)", background: "rgba(57,255,20,0.06)" }}>
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5" style={{ color: G }} />
                <div>
                  <p className="font-black uppercase text-sm" style={{ color: G }}>Affiliation</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(45,122,31,0.45)" }}>Influenceurs · conversions · dû estimé</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "rgba(45,122,31,0.35)" }} />
            </div>
          </Link>

          <Link to={createPageUrl("AdminImport")}>
            <div className="p-4 flex items-center justify-between transition-all hover:opacity-90"
              style={{ border: "1px solid var(--v1v-green-ghost)", background: "var(--v1v-green-bg)" }}>
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" style={{ color: G }} />
                <div>
                  <p className="font-black uppercase text-sm" style={{ color: G }}>Admin Panel</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(45,122,31,0.45)" }}>Import · Photos · Tests</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "rgba(45,122,31,0.35)" }} />
            </div>
          </Link>
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
              style={{ color: "rgba(45,122,31,0.5)" }}
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
              style={{ color: "rgba(45,122,31,0.5)" }}
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
