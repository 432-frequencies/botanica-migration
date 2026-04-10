import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { User, UserPlus, Check, X, Search, Users, Phone, Share2 } from "lucide-react";
import { APP_NAME, APP_SITE_URL } from "@/lib/app-config";

const G = "#2D7A1F";
const GDB = "rgba(45,122,31,0.08)";

export default function Friends() {
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);
  const [toast, setToast] = useState(null);
  const [friendProfiles, setFriendProfiles] = useState({});

  useEffect(() => { load(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const contactsSupported = typeof navigator !== "undefined" && Boolean(navigator.contacts?.select);

  const buildKnownEmailSet = () => new Set([
    ...friends.map((friend) => friend.email),
    ...sent.map((request) => request.receiver_email),
    ...incoming.map((request) => request.sender_email),
    user?.email,
  ]);

  const load = async () => {
    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setLoading(false);
      return;
    }
    setUser({ email: authUser.email, full_name: authUser.user_metadata?.full_name });

    const [incRes, sntRes, recvRes, sentRes] = await Promise.all([
      supabase.from('friend_requests').select('*').eq('receiver_email', authUser.email).eq('status', 'pending'),
      supabase.from('friend_requests').select('*').eq('sender_email', authUser.email).eq('status', 'pending'),
      supabase.from('friend_requests').select('*').eq('receiver_email', authUser.email).eq('status', 'accepted'),
      supabase.from('friend_requests').select('*').eq('sender_email', authUser.email).eq('status', 'accepted'),
    ]);

    setIncoming(incRes.data || []);
    setSent(sntRes.data || []);

    const allFriends = [];
    for (const r of (recvRes.data || [])) allFriends.push({ email: r.sender_email, name: r.sender_name || r.sender_email.split("@")[0] });
    for (const r of (sentRes.data || [])) allFriends.push({ email: r.receiver_email, name: r.receiver_name || r.receiver_email.split("@")[0] });
    setFriends(allFriends);

    if (allFriends.length > 0) {
      const profiles = {};
      await Promise.all(allFriends.map(async (f) => {
        const { data } = await supabase.from('user_profiles').select('*').eq('user_email', f.email).limit(1);
        if (data?.[0]) profiles[f.email] = data[0];
      }));
      setFriendProfiles(profiles);
    }

    setLoading(false);
  };

  const shareInvite = async () => {
    const shareText = `J'utilise ${APP_NAME} pour identifier le vivant et documenter la biodiversité autour de moi. Rejoins-moi ici : ${APP_SITE_URL}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${APP_NAME} — rejoins mon réseau terrain`,
          text: shareText,
        });
        return true;
      }

      await navigator.clipboard?.writeText(shareText);
      return true;
    } catch {
      return false;
    }
  };

  const inviteFromContacts = async () => {
    setImportingContacts(true);
    try {
      if (!contactsSupported) {
        const shared = await shareInvite();
        showToast(shared ? "Invitation prête à être envoyée." : "Partage indisponible sur cet appareil.");
        return;
      }

      const pickedContacts = await navigator.contacts.select(["name", "email", "tel"], { multiple: true });
      const emails = [...new Set(
        pickedContacts
          .flatMap((contact) => contact.email || [])
          .map((email) => email?.trim().toLowerCase())
          .filter(Boolean),
      )];

      if (!emails.length) {
        const shared = await shareInvite();
        showToast(shared ? "Aucun email trouvé dans tes contacts. Invitation prête à partager." : "Aucun email utilisable trouvé.");
        return;
      }

      const friendEmailSet = buildKnownEmailSet();
      const { data } = await supabase
        .from("user_profiles")
        .select("user_email")
        .in("user_email", emails)
        .limit(25);

      const matchedUsers = (data || [])
        .map((entry) => ({
          email: entry.user_email,
          full_name: entry.user_email.split("@")[0],
        }))
        .filter((entry) => !friendEmailSet.has(entry.email));

      if (matchedUsers.length > 0) {
        setResults(matchedUsers);
        setShowAdd(true);
        setQuery("");
        showToast(`${matchedUsers.length} explorateur${matchedUsers.length > 1 ? "s" : ""} trouvé${matchedUsers.length > 1 ? "s" : ""} dans tes contacts.`);
        return;
      }

      const shared = await shareInvite();
      showToast(shared ? "Aucun contact W1LD détecté. Invitation prête à partager." : "Aucun contact W1LD détecté.");
    } catch (error) {
      if (error?.name !== "AbortError") {
        const shared = await shareInvite();
        showToast(shared ? "Accès contacts indisponible. Invitation prête à partager." : "Impossible d'ouvrir tes contacts.");
      }
    } finally {
      setImportingContacts(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const friendEmailSet = new Set([
        ...friends.map(f => f.email),
        ...sent.map(s => s.receiver_email),
        ...incoming.map(i => i.sender_email),
        user.email,
      ]);
      // TODO: recherche utilisateurs par nom — nécessite une table publique `public_profiles`
      // Pour l'instant : recherche par email exact uniquement
      const { data } = await supabase.from('user_profiles').select('user_email').eq('user_email', query.trim()).limit(10);
      const filtered = (data || [])
        .map(u => ({ email: u.user_email, full_name: u.user_email.split('@')[0] }))
        .filter(u => !friendEmailSet.has(u.email));
      setResults(filtered);
    } catch (e) { console.error(e); }
    setSearching(false);
  };

  const sendRequest = async (target) => {
    const optimisticSent = {
      id: `optimistic-${Date.now()}`,
      receiver_email: target.email,
      receiver_name: target.full_name || target.email.split("@")[0],
      status: "pending",
    };
    setSent(prev => [...prev, optimisticSent]);
    setResults(prev => prev.filter(u => u.email !== target.email));
      setShowAdd(false);
      setQuery("");
      showToast(`Invitation envoyée à ${target.full_name || target.email.split("@")[0]}`);
    try {
      await supabase.from('friend_requests').insert({
        sender_email: user.email,
        sender_name: user.full_name || user.email.split("@")[0],
        receiver_email: target.email,
        receiver_name: target.full_name || target.email.split("@")[0],
        status: "pending",
      });
      load();
    } catch {
      setSent(prev => prev.filter(s => s.id !== optimisticSent.id));
      showToast("Impossible d'envoyer l'invitation pour le moment.");
    }
  };

  const acceptRequest = async (req) => {
    const newFriend = { email: req.sender_email, name: req.sender_name || req.sender_email.split("@")[0] };
    setIncoming(prev => prev.filter(r => r.id !== req.id));
    setFriends(prev => [...prev, newFriend]);
    showToast("Allié ajouté.");
    try {
      await supabase.from('friend_requests').update({ status: "accepted" }).eq('id', req.id);
      load();
    } catch {
      setIncoming(prev => [...prev, req]);
      setFriends(prev => prev.filter(f => f.email !== req.sender_email));
      showToast("Impossible d'accepter la demande pour le moment.");
    }
  };

  const declineRequest = async (req) => {
    setIncoming(prev => prev.filter(r => r.id !== req.id));
    try {
      await supabase.from('friend_requests').update({ status: "declined" }).eq('id', req.id);
    } catch {
      setIncoming(prev => [...prev, req]);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#F2EDE4" }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#F2EDE4", color: "#1A1A0F" }}>
      {/* Scanlines */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(45,122,31,0.04) 2px, rgba(45,122,31,0.04) 4px)",
      }} />

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 text-xs font-black uppercase tracking-[0.25em] flex items-center gap-3 max-w-xs w-full"
          style={{ background: G, color: "#F2EDE4", boxShadow: `0 4px 20px rgba(45,122,31,0.3)` }}>
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 px-5 pt-12 pb-4 sticky top-0" style={{ background: "rgba(242,237,228,0.97)", borderBottom: "1px solid rgba(45,122,31,0.2)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: G }} />
          <p className="text-[8px] tracking-[0.6em] uppercase font-black" style={{ color: "rgba(45,122,31,0.6)" }}>Escouade</p>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black uppercase" style={{ color: G }}>Alliés</h1>
          <button
            onClick={() => { setShowAdd(true); setResults([]); setQuery(""); }}
            aria-label="Add friend"
            className="w-10 h-10 flex items-center justify-center"
            style={{ background: GDB, border: "1px solid rgba(45,122,31,0.3)" }}
          >
            <UserPlus className="w-4 h-4" style={{ color: G }} />
          </button>
        </div>
      </div>

      <div className="relative z-10 px-5 py-4 space-y-6">
        <div className="p-4" style={{ background: GDB, border: "1px solid rgba(45,122,31,0.18)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Phone className="w-4 h-4" style={{ color: G }} />
            <p className="text-[8px] tracking-[0.45em] uppercase font-black" style={{ color: "rgba(45,122,31,0.55)" }}>
              Croissance réseau
            </p>
          </div>
          <p className="text-sm font-black uppercase mb-1" style={{ color: "#1A1A0F" }}>
            Invite tes proches en un geste
          </p>
          <p className="text-[11px] leading-relaxed mb-4" style={{ color: "rgba(26,26,15,0.6)" }}>
            Accès contacts direct quand l’appareil le permet. Sinon, W1LD prépare une invitation à partager immédiatement.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={inviteFromContacts}
              disabled={importingContacts}
              className="min-h-[44px] px-3 py-3 text-[10px] font-black uppercase tracking-[0.24em]"
              style={{ background: G, color: "#F2EDE4", opacity: importingContacts ? 0.6 : 1 }}
            >
              {importingContacts ? "Ouverture..." : contactsSupported ? "Mes contacts" : "Inviter"}
            </button>
            <button
              onClick={shareInvite}
              className="min-h-[44px] px-3 py-3 text-[10px] font-black uppercase tracking-[0.24em] flex items-center justify-center gap-2"
              style={{ background: "rgba(45,122,31,0.04)", border: "1px solid rgba(45,122,31,0.18)", color: G }}
            >
              <Share2 className="w-3.5 h-3.5" />
              Partager
            </button>
          </div>
        </div>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div>
            <p className="text-[8px] tracking-[0.5em] uppercase font-black mb-3" style={{ color: "rgba(45,122,31,0.5)" }}>
            Demandes · {incoming.length}
            </p>
            <div className="space-y-2">
              {incoming.map(req => (
                <div key={req.id} className="flex items-center gap-3 p-3" style={{ background: GDB, border: "1px solid rgba(45,122,31,0.2)" }}>
                  <div className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: "rgba(45,122,31,0.12)" }}>
                    <User className="w-4 h-4" style={{ color: G }} />
                  </div>
                  <span className="flex-1 text-sm font-black" style={{ color: "#1A1A0F" }}>
                    {req.sender_name || req.sender_email.split("@")[0]}
                  </span>
                  <button onClick={() => acceptRequest(req)} aria-label="Accept friend request" className="min-h-[44px] min-w-[44px] flex items-center justify-center" style={{ background: G, color: "#F2EDE4" }}>
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => declineRequest(req)} aria-label="Decline friend request" className="min-h-[44px] min-w-[44px] flex items-center justify-center" style={{ background: "rgba(200,0,0,0.08)", border: "1px solid rgba(200,0,0,0.2)" }}>
                    <X className="w-3.5 h-3.5" style={{ color: "#cc2222" }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends list */}
        <div>
          <p className="text-[8px] tracking-[0.5em] uppercase font-black mb-3" style={{ color: "rgba(45,122,31,0.5)" }}>
            Mon réseau · {friends.length}
          </p>
          {friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-8 h-8 mb-4" style={{ color: "rgba(45,122,31,0.25)" }} />
              <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: "rgba(45,122,31,0.4)" }}>Aucun allié pour l'instant.</p>
              <p className="text-xs mt-1" style={{ color: "rgba(45,122,31,0.3)" }}>Ajoute des explorateurs pour suivre leur progression.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map(f => {
                const profile = friendProfiles[f.email];
                return (
                  <div key={f.email} className="p-4" style={{ background: GDB, border: "1px solid rgba(45,122,31,0.15)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: "rgba(45,122,31,0.12)", border: "1px solid rgba(45,122,31,0.25)" }}>
                        <User className="w-4 h-4" style={{ color: G }} />
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase" style={{ color: "#1A1A0F" }}>{f.name}</p>
                        {profile?.rank && (
                          <p className="text-[9px] tracking-widest uppercase" style={{ color: "rgba(45,122,31,0.5)" }}>{profile.rank}</p>
                        )}
                      </div>
                    </div>
                    {profile && (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Observ.", value: profile.total_plants || 0 },
                          { label: "XP", value: profile.total_points || 0 },
                          { label: "Zones", value: profile.zones_led || 0 },
                        ].map(({ label, value }) => (
                          <div key={label} className="text-center py-2" style={{ background: "rgba(45,122,31,0.06)", border: "1px solid rgba(45,122,31,0.12)" }}>
                            <p className="text-sm font-black" style={{ color: G }}>{value}</p>
                            <p className="text-[7px] tracking-widest uppercase" style={{ color: "rgba(45,122,31,0.45)" }}>{label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sent requests */}
        {sent.length > 0 && (
          <div>
            <p className="text-[8px] tracking-[0.5em] uppercase font-black mb-3" style={{ color: "rgba(45,122,31,0.4)" }}>Invitations envoyées</p>
            <div className="space-y-2">
              {sent.map(req => (
                <div key={req.id} className="flex items-center gap-3 p-3" style={{ background: "rgba(45,122,31,0.03)", border: "1px solid rgba(45,122,31,0.08)" }}>
                  <User className="w-4 h-4" style={{ color: "rgba(45,122,31,0.35)" }} />
                  <span className="text-sm italic" style={{ color: "rgba(26,26,15,0.45)" }}>
                    {req.receiver_name || req.receiver_email.split("@")[0]}
                  </span>
                  <span className="ml-auto text-[8px] tracking-widest uppercase" style={{ color: "rgba(45,122,31,0.3)" }}>En attente</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-24" />

      {/* Add Friend Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(26,26,15,0.5)" }}>
          <div className="w-full max-w-md p-6 pb-10" style={{ background: "#F2EDE4", border: "1px solid rgba(45,122,31,0.25)", borderBottom: "none" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black uppercase" style={{ color: G }}>Ajouter un allié</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" className="min-h-[44px] min-w-[44px] flex items-center justify-center transition-opacity hover:opacity-50" style={{ color: "rgba(26,26,15,0.4)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(45,122,31,0.4)" }} />
                <input
                  placeholder="Rechercher par email..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyPress={e => e.key === "Enter" && handleSearch()}
                  className="w-full pl-10 pr-4 py-2.5 text-sm outline-none"
                  style={{ background: GDB, border: "1px solid rgba(45,122,31,0.25)", color: "#1A1A0F" }}
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2.5 text-xs font-black uppercase tracking-wider"
                style={{ background: G, color: "#F2EDE4" }}
              >
                {searching ? "..." : "Chercher"}
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={inviteFromContacts}
                disabled={importingContacts}
                className="flex-1 min-h-[44px] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.22em]"
                style={{ background: "rgba(45,122,31,0.06)", border: "1px solid rgba(45,122,31,0.18)", color: G, opacity: importingContacts ? 0.6 : 1 }}
              >
                {importingContacts ? "Ouverture..." : contactsSupported ? "Importer mes contacts" : "Partager une invitation"}
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {results.length === 0 && query && !searching && (
                <p className="text-center text-xs py-6" style={{ color: "rgba(45,122,31,0.4)" }}>Aucun explorateur trouvé.</p>
              )}
              {results.map(u => (
                <div key={u.email} className="flex items-center gap-3 p-3" style={{ background: GDB, border: "1px solid rgba(45,122,31,0.15)" }}>
                  <User className="w-4 h-4" style={{ color: G }} />
                  <div className="flex-1">
                    <p className="text-sm font-black" style={{ color: "#1A1A0F" }}>{u.full_name || u.email.split("@")[0]}</p>
                    <p className="text-[9px]" style={{ color: "rgba(26,26,15,0.45)" }}>{u.email}</p>
                  </div>
                  <button
                    onClick={() => sendRequest(u)}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider"
                    style={{ background: G, color: "#F2EDE4" }}
                  >
                    Inviter
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
