import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { LogOut, Zap, Shield, Star, ChevronRight, Trash2, Award, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import SpecialtyBadges from "@/components/profile/SpecialtyBadges";
import SpeciesMastery from "@/components/profile/SpeciesMastery";
import DetailedStats from "@/components/profile/DetailedStats";
import XPLevelBar from "@/components/home/XPLevelBar";
import LevelUnlocks from "@/components/home/LevelUnlocks";
import ZoneCard from "@/components/profile/ZoneCard";
import SeasonCard from "@/components/profile/SeasonCard";
import { useIsActivePage } from "@/lib/ActivePageContext";

const TOTAL_ACHIEVEMENTS = 10;

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

  const isActive = useIsActivePage("Profile");
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!isActive || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    loadData();
  }, [isActive]);

  const loadData = async () => {
    const me = await base44.auth.me();
    setUser(me);

    const [profileRes, lbData, discoveries] = await Promise.allSettled([
      base44.functions.invoke("getUserProfile", {}),
      base44.entities.Leaderboard.filter({ user_email: me.email }),
      base44.entities.PlantDiscovery.filter({ user_email: me.email }, "-created_date", 500),
    ]);

    if (profileRes.status === "fulfilled") setUserData(profileRes.value.data);
    if (lbData.status === "fulfilled" && lbData.value.length > 0) {
      const lb = lbData.value[0];
      setSpecialtyStats({ edible: lb.edible_count || 0, toxic: lb.toxic_count || 0, forest: lb.forest_count || 0 });
    }
    if (discoveries.status === "fulfilled") setUserDiscoveries(discoveries.value);
    setLoading(false);
  };

  const handleLogout = () => base44.auth.logout();

  const handleDeleteAccount = async () => {
    setDeleting(true);
    // Delete all user data
    await Promise.allSettled([
      base44.entities.PlantDiscovery.filter({ user_email: user.email }).then(items =>
        Promise.all(items.map(i => base44.entities.PlantDiscovery.delete(i.id)))
      ),
      base44.entities.Achievement.filter({ user_email: user.email }).then(items =>
        Promise.all(items.map(i => base44.entities.Achievement.delete(i.id)))
      ),
      base44.entities.UserProfile.filter({ user_email: user.email }).then(items =>
        Promise.all(items.map(i => base44.entities.UserProfile.delete(i.id)))
      ),
      base44.entities.Leaderboard.filter({ user_email: user.email }).then(items =>
        Promise.all(items.map(i => base44.entities.Leaderboard.delete(i.id)))
      ),
    ]);
    base44.auth.logout();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--v1v-bg)" }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
    </div>
  );

  const profile = userData?.profile;
  const achievements = userData?.achievements || [];
  const totalXP = profile?.total_points || 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>

      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        background: "radial-gradient(ellipse 70% 50% at 0% 0%, rgba(124,58,237,0.04) 0%, transparent 60%)"
      }} />

      {/* Header */}
      <div className="relative z-10 px-5 pt-4 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: "var(--v1v-fg-faint)" }}>Agent Dossier</p>
            <h1 className="text-xl font-black uppercase leading-none" style={{ color: "var(--v1v-fg)", letterSpacing: "0.04em" }}>Profil</h1>
          </div>
          <button onClick={handleLogout} aria-label="Log out" className="flex items-center justify-center min-h-[44px] min-w-[44px] transition-opacity active:opacity-40">
            <LogOut className="w-4 h-4" style={{ color: "var(--v1v-fg-faint)" }} />
          </button>
        </div>

        {/* Avatar & info */}
        <div className="flex items-center gap-4 mb-6" style={{ paddingBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div
            className="w-12 h-12 flex items-center justify-center text-lg font-black flex-shrink-0"
            style={{ background: "var(--v1v-surface-2)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--v1v-fg)" }}
          >
            {user?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-base font-black uppercase truncate" style={{ color: "var(--v1v-fg)", letterSpacing: "0.04em" }}>{user?.full_name}</h2>
              {profile?.is_pro && (
                <span className="text-[7px] font-black tracking-[0.15em] px-1.5 py-0.5 flex-shrink-0" style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}>ELITE</span>
              )}
            </div>
            <p className="text-[11px] truncate" style={{ color: "var(--v1v-fg-faint)" }}>{user?.email}</p>
          </div>
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
            displayName={profile?.display_name || user?.full_name}
            discoveries={userDiscoveries}
          />
        </div>

        {/* Pro upgrade */}
        {!profile?.is_pro && (
          <Link to={createPageUrl("Pricing")}>
            <div
              className="p-4 mb-2 cursor-pointer transition-all hover:opacity-90"
              style={{ border: "1px solid var(--v1v-green-dim)", background: "var(--v1v-green-bg)" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: "rgba(45,122,31,0.5)" }}>Unlock Full Access</p>
                  <p className="font-black uppercase text-sm" style={{ color: G }}>W1LD Elite</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(45,122,31,0.45)" }}>Unlimited scans · Full intel</p>
                </div>
                <Zap className="w-5 h-5" style={{ color: G }} />
              </div>
            </div>
          </Link>
        )}
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
          <div className="p-6 text-center" style={{ border: `1px solid rgba(45,122,31,0.15)` }}>
            <Shield className="w-6 h-6 mx-auto mb-2" style={{ color: "rgba(45,122,31,0.25)" }} />
            <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(45,122,31,0.35)" }}>Scan your first specimen to unlock badges</p>
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

      {/* Night Sky Link */}
      <div className="relative z-10 px-5 mt-2">
        <Link to={createPageUrl("NightSky")}>
          <div
            className="p-4 flex items-center justify-between transition-all hover:opacity-90"
            style={{ border: "1px solid var(--v1v-green-ghost)", background: "var(--v1v-green-bg-light)" }}
          >
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5" style={{ color: G }} />
              <div>
                <p className="font-black uppercase text-sm" style={{ color: "var(--v1v-fg)" }}>Night Sky</p>
                <p className="text-xs tracking-wider mt-0.5" style={{ color: "rgba(45,122,31,0.45)" }}>Constellations & astronomy</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: "rgba(45,122,31,0.35)" }} />
          </div>
        </Link>
      </div>

      {/* Admin Panel — visible uniquement pour l'admin */}
      {user?.email === "energynrj6@gmail.com" && (
        <div className="relative z-10 px-5 mt-4">
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
            aria-label="Delete account"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs font-black uppercase tracking-[0.25em]">Delete Account</span>
          </button>
      </div>

      <div className="h-24" />

      {/* First confirmation modal — portaled to document.body to escape KeepAlive stacking context */}
      {deleteStep === 1 && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" style={{ background: "var(--v1v-bg-overlay-full)" }}>
          <div className="w-full max-w-sm p-6" style={{ background: "var(--v1v-bg-card)", border: "1px solid var(--v1v-danger-border)" }}>
            <Trash2 className="w-7 h-7 mb-4" style={{ color: "var(--v1v-danger-text)" }} />
            <h2 className="text-xl font-black uppercase tracking-wider mb-3" style={{ color: "var(--v1v-fg)" }}>Delete Account?</h2>
            <p className="text-sm mb-6" style={{ color: "var(--v1v-fg-muted)" }}>
              Are you sure? This will permanently delete your account and all your discoveries.
            </p>
            <button
              onClick={() => setDeleteStep(2)}
              className="w-full min-h-[44px] py-3 text-xs font-black uppercase tracking-[0.25em] mb-3 transition-all"
              style={{ background: "rgba(180,30,30,0.85)", color: "#fff" }}
            >
              Yes, delete my account
            </button>
            <button
              onClick={() => setDeleteStep(0)}
              className="w-full min-h-[44px] text-xs uppercase tracking-widest"
              style={{ color: "rgba(45,122,31,0.5)" }}
            >
              Cancel
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
                ⚠ Irreversible action — no recovery possible
              </p>
            </div>
            <h2 className="text-xl font-black uppercase tracking-wider mb-2" style={{ color: "var(--v1v-fg)" }}>Final Warning</h2>
            <ul className="text-xs mb-5 space-y-1" style={{ color: "var(--v1v-fg-muted)" }}>
              {[
                `${userDiscoveries.length} specimen(s) permanently erased`,
                "All XP, ranks and badges deleted",
                "No backup or restoration possible",
                "Account cannot be recovered",
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
              {deleting ? "Deleting..." : "Confirm — Delete Everything Forever"}
            </button>
            <button
              onClick={() => setDeleteStep(1)}
              className="w-full min-h-[44px] text-xs uppercase tracking-widest"
              style={{ color: "rgba(45,122,31,0.5)" }}
            >
              Cancel — Keep My Account
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}