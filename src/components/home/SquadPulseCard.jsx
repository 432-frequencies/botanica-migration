import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Share2, Trophy, UserPlus, Users } from "lucide-react";
import { supabase } from "@/api/supabaseClient";
import { APP_NAME, APP_SITE_URL } from "@/lib/app-config";
import { createPageUrl } from "@/utils";

export default function SquadPulseCard({ userEmail, profile }) {
  const [loading, setLoading] = useState(false);
  const [friendProfiles, setFriendProfiles] = useState([]);
  const [incomingCount, setIncomingCount] = useState(0);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    if (!userEmail) return;

    const loadSquad = async () => {
      setLoading(true);
      try {
        const [incomingRes, recvRes, sentRes] = await Promise.all([
          supabase.from("friend_requests").select("id", { count: "exact" }).eq("receiver_email", userEmail).eq("status", "pending"),
          supabase.from("friend_requests").select("*").eq("receiver_email", userEmail).eq("status", "accepted"),
          supabase.from("friend_requests").select("*").eq("sender_email", userEmail).eq("status", "accepted"),
        ]);

        setIncomingCount(incomingRes.count || 0);

        const friendEmails = [
          ...(recvRes.data || []).map((row) => row.sender_email),
          ...(sentRes.data || []).map((row) => row.receiver_email),
        ];

        if (!friendEmails.length) {
          setFriendProfiles([]);
          return;
        }

        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("*")
          .in("user_email", friendEmails);

        setFriendProfiles(profiles || []);
      } catch (error) {
        console.error("[SquadPulseCard] loadSquad failed:", error);
      } finally {
        setLoading(false);
      }
    };

    loadSquad();
  }, [userEmail]);

  if (!userEmail || loading) return null;

  const myXP = profile?.total_points || 0;
  const nearestFriend = [...friendProfiles]
    .sort((a, b) => Math.abs((a.total_points || 0) - myXP) - Math.abs((b.total_points || 0) - myXP))[0] || null;

  const hasFriends = friendProfiles.length > 0;
  const friendXP = nearestFriend?.total_points || 0;
  const diff = Math.abs(friendXP - myXP);
  const friendName = nearestFriend?.display_name || nearestFriend?.user_email?.split("@")[0] || "un rival";
  const trailing = friendXP >= myXP;

  const cardTitle = incomingCount > 0
    ? `${incomingCount} allié${incomingCount > 1 ? "s" : ""} attend${incomingCount > 1 ? "ent" : ""} ton feu vert`
    : hasFriends
      ? trailing
        ? `${friendName} est à ${diff} XP devant`
        : `${friendName} revient à ${diff} XP`
      : "Monte ton escouade W1LD";

  const cardCopy = incomingCount > 0
    ? "Accepte la demande et transforme la progression solo en vraie rivalité terrain."
    : hasFriends
      ? trailing
        ? "Deux bonnes sorties peuvent suffire pour repasser devant dans le classement amis."
        : "Tu mènes pour l'instant. Garde l'avance en verrouillant une nouvelle zone aujourd'hui."
      : "Invite une première personne et transforme chaque sortie en exploration partagée, en comparaison utile et en retour au terrain.";

  const badgeLabel = incomingCount > 0 ? "Invitation" : hasFriends ? `Réseau ${friendProfiles.length}` : "Partage";
  const primaryLink = incomingCount > 0
    ? createPageUrl("Friends")
    : hasFriends
      ? `${createPageUrl("Leaderboard")}?scope=friends&metric=total_points`
      : createPageUrl("Friends");
  const primaryLabel = incomingCount > 0
    ? "Ouvrir les amis"
    : hasFriends
      ? "Voir le classement amis"
      : "Construire mon réseau";

  const inviteText = hasFriends
    ? `Je documente le vivant autour de moi sur ${APP_NAME}. Rejoins-moi pour explorer nos observations et comparer nos découvertes sur le terrain.`
    : `J'utilise ${APP_NAME} pour identifier le vivant et documenter la biodiversité autour de moi. Rejoins-moi sur le terrain.`;

  const handleInvite = async () => {
    setCopying(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${APP_NAME} • Rejoins mon réseau terrain`,
          text: inviteText,
          url: APP_SITE_URL,
        });
      } else {
        await navigator.clipboard.writeText(`${inviteText} ${APP_SITE_URL}`);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(`${inviteText} ${APP_SITE_URL}`);
        } catch {}
      }
    } finally {
      setTimeout(() => setCopying(false), 700);
    }
  };

  return (
    <div className="px-5 py-1">
      <div
        className="p-4"
        style={{
          background: "rgba(8,14,8,0.72)",
          border: "1px solid rgba(46,168,15,0.16)",
          boxShadow: "0 0 24px rgba(46,168,15,0.08)",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            {incomingCount > 0 ? (
              <UserPlus className="w-4 h-4" style={{ color: "var(--v1v-green)" }} />
            ) : hasFriends ? (
              <Trophy className="w-4 h-4" style={{ color: "#C8960A" }} />
            ) : (
              <Users className="w-4 h-4" style={{ color: "var(--v1v-green)" }} />
            )}
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.32em]" style={{ color: "rgba(226,234,224,0.38)" }}>
                Pulse escouade
              </p>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: incomingCount > 0 ? "var(--v1v-green)" : hasFriends ? "#C8960A" : "var(--v1v-green)" }}>
                {badgeLabel}
              </p>
            </div>
          </div>
          {hasFriends && nearestFriend && (
            <div className="text-right">
              <p className="text-[7px] font-black uppercase tracking-[0.24em]" style={{ color: "rgba(226,234,224,0.35)" }}>
                Delta XP
              </p>
              <p className="text-sm font-black uppercase tracking-[0.08em]" style={{ color: trailing ? "#C8960A" : "var(--v1v-green)" }}>
                {trailing ? `-${diff}` : `+${diff}`}
              </p>
            </div>
          )}
        </div>

        <p className="text-sm font-black uppercase tracking-[0.08em] leading-tight mb-1.5" style={{ color: "#F4F8F1" }}>
          {cardTitle}
        </p>
        <p className="text-[10px] leading-relaxed mb-3" style={{ color: "rgba(226,234,224,0.72)" }}>
          {cardCopy}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Link to={primaryLink} className="block">
            <button
              className="w-full py-3 text-[10px] font-black uppercase tracking-[0.24em]"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "#F4F8F1",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {primaryLabel}
            </button>
          </Link>

          <button
            onClick={handleInvite}
            disabled={copying}
            className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] disabled:opacity-50"
            style={{
              background: "rgba(46,168,15,0.14)",
              color: "var(--v1v-green)",
              border: "1px solid rgba(46,168,15,0.24)",
            }}
          >
            <Share2 className="w-3.5 h-3.5" />
            {copying ? "Invitation prête" : "Inviter"}
          </button>
        </div>
      </div>
    </div>
  );
}
