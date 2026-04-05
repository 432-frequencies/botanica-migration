import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { User, UserPlus, Check, X, Search, Users } from "lucide-react";

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
  const [toast, setToast] = useState(null);
  const [friendProfiles, setFriendProfiles] = useState({});

  useEffect(() => { load(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = async () => {
    setLoading(true);
    const me = await base44.auth.me();
    setUser(me);

    const [inc, snt, recvAccepted, sentAccepted] = await Promise.all([
      base44.entities.FriendRequest.filter({ receiver_email: me.email, status: "pending" }),
      base44.entities.FriendRequest.filter({ sender_email: me.email, status: "pending" }),
      base44.entities.FriendRequest.filter({ receiver_email: me.email, status: "accepted" }),
      base44.entities.FriendRequest.filter({ sender_email: me.email, status: "accepted" }),
    ]);

    setIncoming(inc);
    setSent(snt);

    const allFriends = [];
    for (const r of recvAccepted) allFriends.push({ email: r.sender_email, name: r.sender_name || r.sender_email.split("@")[0] });
    for (const r of sentAccepted) allFriends.push({ email: r.receiver_email, name: r.receiver_name || r.receiver_email.split("@")[0] });
    setFriends(allFriends);

    if (allFriends.length > 0) {
      const profiles = {};
      await Promise.all(allFriends.map(async (f) => {
        const lb = await base44.entities.Leaderboard.filter({ user_email: f.email });
        if (lb.length > 0) profiles[f.email] = lb[0];
      }));
      setFriendProfiles(profiles);
    }

    setLoading(false);
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
      const users = await base44.entities.User.filter(
        { full_name: { $regex: query, $options: "i" } },
        null,
        50
      );
      const filtered = users.filter(u => !friendEmailSet.has(u.email));
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
    showToast(`Request sent to ${target.full_name || target.email.split("@")[0]}!`);
    try {
      await base44.entities.FriendRequest.create({
        sender_email: user.email,
        sender_name: user.full_name || user.email.split("@")[0],
        receiver_email: target.email,
        receiver_name: target.full_name || target.email.split("@")[0],
        status: "pending",
      });
      load();
    } catch {
      setSent(prev => prev.filter(s => s.id !== optimisticSent.id));
      showToast("Failed to send request. Try again.");
    }
  };

  const acceptRequest = async (req) => {
    const newFriend = { email: req.sender_email, name: req.sender_name || req.sender_email.split("@")[0] };
    setIncoming(prev => prev.filter(r => r.id !== req.id));
    setFriends(prev => [...prev, newFriend]);
    showToast("Friend added!");
    try {
      await base44.entities.FriendRequest.update(req.id, { status: "accepted" });
      load();
    } catch {
      setIncoming(prev => [...prev, req]);
      setFriends(prev => prev.filter(f => f.email !== req.sender_email));
      showToast("Failed to accept. Try again.");
    }
  };

  const declineRequest = async (req) => {
    setIncoming(prev => prev.filter(r => r.id !== req.id));
    try {
      await base44.entities.FriendRequest.update(req.id, { status: "declined" });
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
          <p className="text-[8px] tracking-[0.6em] uppercase font-black" style={{ color: "rgba(45,122,31,0.6)" }}>Network</p>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black uppercase" style={{ color: G }}>Friends</h1>
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

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div>
            <p className="text-[8px] tracking-[0.5em] uppercase font-black mb-3" style={{ color: "rgba(45,122,31,0.5)" }}>
              Requests · {incoming.length}
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
            My Network · {friends.length}
          </p>
          {friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-8 h-8 mb-4" style={{ color: "rgba(45,122,31,0.25)" }} />
              <p className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: "rgba(45,122,31,0.4)" }}>No friends yet.</p>
              <p className="text-xs mt-1" style={{ color: "rgba(45,122,31,0.3)" }}>Add explorers to see their progress.</p>
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
                          { label: "Specimens", value: profile.total_plants || 0 },
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
            <p className="text-[8px] tracking-[0.5em] uppercase font-black mb-3" style={{ color: "rgba(45,122,31,0.4)" }}>Pending Sent</p>
            <div className="space-y-2">
              {sent.map(req => (
                <div key={req.id} className="flex items-center gap-3 p-3" style={{ background: "rgba(45,122,31,0.03)", border: "1px solid rgba(45,122,31,0.08)" }}>
                  <User className="w-4 h-4" style={{ color: "rgba(45,122,31,0.35)" }} />
                  <span className="text-sm italic" style={{ color: "rgba(26,26,15,0.45)" }}>
                    {req.receiver_name || req.receiver_email.split("@")[0]}
                  </span>
                  <span className="ml-auto text-[8px] tracking-widest uppercase" style={{ color: "rgba(45,122,31,0.3)" }}>Waiting...</span>
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
              <h2 className="text-lg font-black uppercase" style={{ color: G }}>Add Friend</h2>
              <button onClick={() => setShowAdd(false)} aria-label="Close" className="min-h-[44px] min-w-[44px] flex items-center justify-center transition-opacity hover:opacity-50" style={{ color: "rgba(26,26,15,0.4)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(45,122,31,0.4)" }} />
                <input
                  placeholder="Search by name or email..."
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
                {searching ? "..." : "Search"}
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {results.length === 0 && query && !searching && (
                <p className="text-center text-xs py-6" style={{ color: "rgba(45,122,31,0.4)" }}>No explorers found.</p>
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
                    Add
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