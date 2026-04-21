import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { User, UserPlus, Check, X, Search, Users, Share2, WifiOff, Shield } from "lucide-react";
import { APP_NAME, APP_SITE_URL } from "@/lib/app-config";
import PageIntro from "@/components/shared/PageIntro";
import NoticePanel from "@/components/shared/NoticePanel";

const G = "var(--v1v-green)";
const GDB = "var(--v1v-green-bg)";

function throwIfSupabaseError(label, response) {
  if (response?.error) {
    const error = new Error(response.error.message || `Erreur Supabase: ${label}`);
    error.code = response.error.code;
    error.details = response.error.details;
    error.label = label;
    throw error;
  }
}

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
  const [toast, setToast] = useState(null);
  const [friendProfiles, setFriendProfiles] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsHint, setContactsHint] = useState(null);

  useEffect(() => { load(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    setAuthRequired(false);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setAuthRequired(true);
      setLoading(false);
      return;
    }
    setUser({ email: authUser.email, full_name: authUser.user_metadata?.full_name });

    try {
      const [incRes, sntRes, recvRes, sentRes] = await Promise.all([
        supabase.from('friend_requests').select('*').eq('receiver_email', authUser.email).eq('status', 'pending'),
        supabase.from('friend_requests').select('*').eq('sender_email', authUser.email).eq('status', 'pending'),
        supabase.from('friend_requests').select('*').eq('receiver_email', authUser.email).eq('status', 'accepted'),
        supabase.from('friend_requests').select('*').eq('sender_email', authUser.email).eq('status', 'accepted'),
      ]);

      throwIfSupabaseError("incoming_pending", incRes);
      throwIfSupabaseError("sent_pending", sntRes);
      throwIfSupabaseError("received_accepted", recvRes);
      throwIfSupabaseError("sent_accepted", sentRes);

      setIncoming(incRes.data || []);
      setSent(sntRes.data || []);

      const allFriends = [];
      for (const r of (recvRes.data || [])) allFriends.push({ email: r.sender_email, name: r.sender_name || r.sender_email.split("@")[0] });
      for (const r of (sentRes.data || [])) allFriends.push({ email: r.receiver_email, name: r.receiver_name || r.receiver_email.split("@")[0] });
      const uniqueFriends = Array.from(new Map(allFriends.map((friend) => [friend.email, friend])).values());
      setFriends(uniqueFriends);

      if (uniqueFriends.length > 0) {
        const profiles = {};
        const profileRes = await supabase
          .from('user_profiles')
          .select('*')
          .in('user_email', uniqueFriends.map((friend) => friend.email));
        throwIfSupabaseError("friend_profiles", profileRes);
        for (const profile of (profileRes.data || [])) {
          profiles[profile.user_email] = profile;
        }
        setFriendProfiles(profiles);
      } else {
        setFriendProfiles({});
      }
    } catch (error) {
      console.error("[Friends] load failed:", error);
      setLoadError("Le réseau vivant n'a pas pu être chargé. Vérifie la connexion puis réessaie.");
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
      showToast("Invitation copiée dans le presse-papiers.");
      return true;
    } catch {
      showToast("Impossible de partager l'invitation pour le moment.");
      return false;
    }
  };

  const extractContactEmails = (contacts = []) => {
    const emails = new Set();
    for (const contact of contacts) {
      const values = Array.isArray(contact?.email) ? contact.email : [];
      for (const email of values) {
        const normalized = String(email || "").trim().toLowerCase();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
          emails.add(normalized);
        }
      }
    }
    return [...emails];
  };

  const importPhoneContacts = async () => {
    if (contactsLoading) return;
    setContactsLoading(true);
    setContactsHint(null);

    try {
      const contactsApi = navigator.contacts;
      if (!contactsApi?.select) {
        setContactsHint("Ton navigateur ne permet pas encore l'accès direct aux contacts. Tu peux quand même partager une invitation.");
        await shareInvite();
        return;
      }

      const supportedProps = contactsApi.getProperties ? await contactsApi.getProperties() : ["name", "email", "tel"];
      const props = ["name", "email", "tel"].filter((prop) => supportedProps.includes(prop));
      const contacts = await contactsApi.select(props.length ? props : ["email"], { multiple: true });
      const emails = extractContactEmails(contacts);

      if (emails.length === 0) {
        setContactsHint("Aucun email exploitable trouvé dans les contacts sélectionnés. Le partage d'invitation reste le plus simple.");
        await shareInvite();
        return;
      }

      const knownEmails = new Set([
        ...friends.map((friend) => friend.email),
        ...sent.map((request) => request.receiver_email),
        ...incoming.map((request) => request.sender_email),
        user.email,
      ]);

      const searchRes = await supabase
        .from("user_profiles")
        .select("user_email, display_name")
        .in("user_email", emails)
        .limit(25);

      throwIfSupabaseError("contacts_search", searchRes);

      const matches = (searchRes.data || [])
        .map((profile) => ({
          email: profile.user_email,
          full_name: profile.display_name || profile.user_email.split("@")[0],
        }))
        .filter((profile) => !knownEmails.has(profile.email));

      if (matches.length === 0) {
        setContactsHint("Aucun contact sélectionné n'a encore de compte W1LD. Envoie-leur ton invitation.");
        await shareInvite();
        return;
      }

      setShowAdd(true);
      setResults(matches);
      setQuery("");
      setContactsHint(`${matches.length} contact${matches.length > 1 ? "s" : ""} trouvé${matches.length > 1 ? "s" : ""} sur W1LD.`);
      showToast(`${matches.length} contact${matches.length > 1 ? "s" : ""} déjà sur W1LD.`);
    } catch (error) {
      if (error?.name === "AbortError") {
        setContactsHint("Import annulé. Rien n'a été partagé.");
      } else {
        console.error("[Friends] contacts import failed:", error);
        setContactsHint("Impossible d'ouvrir les contacts pour le moment. Tu peux partager une invitation à la place.");
      }
    } finally {
      setContactsLoading(false);
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
      const searchEmail = query.trim().toLowerCase();
      const searchRes = await supabase.from('user_profiles').select('user_email').eq('user_email', searchEmail).limit(10);
      throwIfSupabaseError("friend_search", searchRes);
      const filtered = (searchRes.data || [])
        .map(u => ({ email: u.user_email, full_name: u.user_email.split('@')[0] }))
        .filter(u => !friendEmailSet.has(u.email));
      setResults(filtered);
    } catch (e) {
      console.error(e);
      showToast("La recherche n'a pas pu aboutir. Réessaie dans un instant.");
    }
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
      const insertRes = await supabase.from('friend_requests').insert({
        sender_email: user.email,
        sender_name: user.full_name || user.email.split("@")[0],
        receiver_email: target.email,
        receiver_name: target.full_name || target.email.split("@")[0],
        status: "pending",
      });
      throwIfSupabaseError("friend_request_insert", insertRes);
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
      const updateRes = await supabase.from('friend_requests').update({ status: "accepted" }).eq('id', req.id);
      throwIfSupabaseError("friend_request_accept", updateRes);
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
      const updateRes = await supabase.from('friend_requests').update({ status: "declined" }).eq('id', req.id);
      throwIfSupabaseError("friend_request_decline", updateRes);
    } catch {
      setIncoming(prev => [...prev, req]);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--v1v-bg)" }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: G, borderTopColor: "transparent" }} />
    </div>
  );

  if (authRequired) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>
        <Shield className="w-8 h-8" style={{ color: "rgba(45,122,31,0.45)" }} />
        <p className="text-xs font-black uppercase tracking-[0.32em]" style={{ color: "rgba(45,122,31,0.55)" }}>Connexion requise</p>
        <p className="text-sm max-w-[280px]" style={{ color: "var(--v1v-fg-muted)" }}>
          Reconnecte-toi pour voir ton réseau, tes invitations et les profils autour de toi.
        </p>
        <button
          onClick={() => window.location.replace("/login")}
          className="px-6 py-3 text-xs font-black uppercase tracking-[0.24em]"
          style={{ background: G, color: "var(--v1v-bg)" }}
        >
          Se connecter
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--v1v-bg)", color: "var(--v1v-fg)" }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 text-xs font-black uppercase tracking-[0.25em] flex items-center gap-3 max-w-xs w-full"
          style={{ background: G, color: "var(--v1v-bg)", boxShadow: `0 4px 20px rgba(45,122,31,0.3)` }}>
          <Check className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">{toast}</span>
        </div>
      )}

      <PageIntro
        kicker="Escouade"
        title="Alliés"
        subtitle="Invite des personnes de confiance, suis les demandes et garde un réseau terrain simple et lisible."
        sticky
        rightSlot={(
          <button
            onClick={() => { setShowAdd(true); setResults([]); setQuery(""); }}
            aria-label="Add friend"
            className="v1v-surface-card-soft flex h-11 w-11 items-center justify-center"
            style={{ borderColor: "rgba(45,122,31,0.18)" }}
          >
            <UserPlus className="w-4 h-4" style={{ color: G }} />
          </button>
        )}
      />

      <div className="relative z-10 px-5 py-4 space-y-6">
        {loadError && (
          <NoticePanel
            icon={WifiOff}
            tone="warning"
            label="Chargement partiel"
            message={loadError}
            action={(
              <button
                onClick={load}
                className="shrink-0 rounded-[14px] px-3 py-3 text-[9px] font-black uppercase tracking-[0.2em]"
                style={{ background: "#E87A00", color: "#081008" }}
              >
                Réessayer
              </button>
            )}
          />
        )}

        <div className="v1v-surface-card p-4" style={{ background: GDB, borderColor: "rgba(45,122,31,0.18)" }}>
          <p className="v1v-section-kicker mb-2">Croissance réseau</p>
          <p className="v1v-section-title" style={{ color: "var(--v1v-fg)" }}>
            Trouve tes amis de terrain
          </p>
          <p className="v1v-section-body mb-4">
            Ajoute tes proches pour comparer vos observations et créer un vrai challenge quotidien.
          </p>
          <div className="grid gap-2">
            <button
              onClick={importPhoneContacts}
              disabled={contactsLoading}
              className="v1v-button-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Users className="w-3.5 h-3.5" />
              {contactsLoading ? "Ouverture contacts..." : "Trouver dans mes contacts"}
            </button>
            <button
              onClick={shareInvite}
              className="w-full min-h-[44px] rounded-[14px] px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] flex items-center justify-center gap-2"
              style={{ background: "rgba(45,122,31,0.06)", border: "1px solid rgba(45,122,31,0.18)", color: G }}
            >
              <Share2 className="w-3.5 h-3.5" />
              Partager l'invitation
            </button>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed" style={{ color: "var(--v1v-fg-faint)" }}>
            Tes contacts restent sur ton téléphone. W1LD vérifie seulement les emails sélectionnés après ton accord.
          </p>
          {contactsHint && (
            <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "rgba(111,180,161,0.78)" }}>
              {contactsHint}
            </p>
          )}
        </div>

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div>
            <p className="text-[8px] tracking-[0.5em] uppercase font-black mb-3" style={{ color: "rgba(45,122,31,0.5)" }}>
            Demandes · {incoming.length}
            </p>
            <div className="space-y-2">
              {incoming.map(req => (
                <div key={req.id} className="v1v-surface-card-soft flex items-center gap-3 p-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full" style={{ background: "rgba(45,122,31,0.12)" }}>
                    <User className="w-4 h-4" style={{ color: G }} />
                  </div>
                  <span className="flex-1 text-sm font-black" style={{ color: "var(--v1v-fg)" }}>
                    {req.sender_name || req.sender_email.split("@")[0]}
                  </span>
                  <button onClick={() => acceptRequest(req)} aria-label="Accept friend request" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[12px]" style={{ background: G, color: "var(--v1v-bg)" }}>
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
            <div className="v1v-surface-card-soft flex flex-col items-center justify-center py-16 px-4 text-center">
              <Users className="w-8 h-8 mb-4" style={{ color: "rgba(45,122,31,0.25)" }} />
              <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: "rgba(45,122,31,0.4)" }}>Aucun allié pour l'instant</p>
              <p className="text-xs mt-2 max-w-[240px]" style={{ color: "var(--v1v-fg-muted)" }}>
                Invite une personne de confiance pour comparer vos observations et construire un réseau terrain plus vivant.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map(f => {
                const profile = friendProfiles[f.email];
                return (
                  <div key={f.email} className="v1v-surface-card p-4" style={{ background: GDB, borderColor: "rgba(45,122,31,0.15)" }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: "rgba(45,122,31,0.12)", border: "1px solid rgba(45,122,31,0.25)" }}>
                        <User className="w-4 h-4" style={{ color: G }} />
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase" style={{ color: "var(--v1v-fg)" }}>{f.name}</p>
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
                          <div key={label} className="v1v-surface-card-soft text-center py-2">
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
                <div key={req.id} className="v1v-surface-card-soft flex items-center gap-3 p-3">
                  <User className="w-4 h-4" style={{ color: "rgba(45,122,31,0.35)" }} />
                  <span className="text-sm italic" style={{ color: "var(--v1v-fg-muted)" }}>
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
          <div className="w-full max-w-md p-6 pb-10" style={{ background: "var(--v1v-bg-card)", border: "1px solid rgba(45,122,31,0.25)", borderBottom: "none", borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black uppercase" style={{ color: G }}>Ajouter un allié</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" className="min-h-[44px] min-w-[44px] flex items-center justify-center transition-opacity hover:opacity-50" style={{ color: "var(--v1v-fg-faint)" }}>
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
                  style={{ background: GDB, border: "1px solid rgba(45,122,31,0.25)", color: "var(--v1v-fg)" }}
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-2.5 text-xs font-black uppercase tracking-wider"
                style={{ background: G, color: "var(--v1v-bg)", borderRadius: 14 }}
              >
                {searching ? "..." : "Chercher"}
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <button
                onClick={importPhoneContacts}
                disabled={contactsLoading}
                className="flex-1 min-h-[44px] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.22em] disabled:opacity-60"
                style={{ background: "rgba(45,122,31,0.12)", border: "1px solid rgba(45,122,31,0.26)", color: G, borderRadius: 14 }}
              >
                {contactsLoading ? "Contacts..." : "Mes contacts"}
              </button>
              <button
                onClick={shareInvite}
                className="flex-1 min-h-[44px] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.22em]"
                style={{ background: "rgba(45,122,31,0.06)", border: "1px solid rgba(45,122,31,0.18)", color: G, borderRadius: 14 }}
              >
                Partager une invitation
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {results.length === 0 && query && !searching && (
                <p className="text-center text-xs py-6" style={{ color: "rgba(45,122,31,0.4)" }}>Aucun explorateur trouvé.</p>
              )}
              {results.map(u => (
                <div key={u.email} className="v1v-surface-card-soft flex items-center gap-3 p-3">
                  <User className="w-4 h-4" style={{ color: G }} />
                  <div className="flex-1">
                    <p className="text-sm font-black" style={{ color: "var(--v1v-fg)" }}>{u.full_name || u.email.split("@")[0]}</p>
                    <p className="text-[9px]" style={{ color: "var(--v1v-fg-faint)" }}>{u.email}</p>
                  </div>
                  <button
                    onClick={() => sendRequest(u)}
                    className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider"
                    style={{ background: G, color: "var(--v1v-bg)", borderRadius: 12 }}
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
