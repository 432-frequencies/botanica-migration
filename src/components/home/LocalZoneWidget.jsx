import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { MapPin, Lock } from "lucide-react";

const G = "var(--v1v-green)";

function getZoneId(lat, lng) {
  const latZone = Math.floor(lat / 0.5);
  const lngZone = Math.floor(lng / 0.5);
  return `${latZone}_${lngZone}`;
}

export default function LocalZoneWidget({ userEmail, geoCoords }) {
  const [zone, setZone] = useState(null);
  const [leader, setLeader] = useState(null);
  const [discoveries, setDiscoveries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!geoCoords || !userEmail) return;
    loadZoneData();
  }, [geoCoords, userEmail]);

  const loadZoneData = async () => {
    setLoading(true);
    try {
      const zoneId = getZoneId(geoCoords.lat, geoCoords.lng);
      const [leaderRes, discoveriesRes] = await Promise.all([
        supabase.from('zone_leaders').select('*').eq('zone_id', zoneId).order('species_count', { ascending: false }).limit(1),
        supabase.from('plant_discoveries').select('*').eq('user_email', userEmail),
      ]);

      const discoveries = discoveriesRes.data || [];
      const zoneLeader = leaderRes.data?.[0] || null;
      setLeader(zoneLeader);
      setZone(zoneId);

      // Count local discoveries in this zone
      const localCount = discoveries.filter(d => {
        if (!d.latitude || !d.longitude) return false;
        return getZoneId(d.latitude, d.longitude) === zoneId;
      }).length;
      setDiscoveries(localCount);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (!geoCoords || loading) return null;

  const isLeader = leader?.user_email === userEmail;

  return (
    <div className="w-full p-4" style={{ background: "rgba(45,122,31,0.08)", border: "1px solid rgba(45,122,31,0.2)" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: G }} />
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.3em]" style={{ color: "rgba(45,122,31,0.5)" }}>Zone Local</p>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: G }}>{zone}</p>
          </div>
        </div>
        {isLeader && <span className="text-[7px] font-black uppercase tracking-[0.3em] px-2 py-1" style={{ background: G, color: "var(--v1v-bg)" }}>Leader</span>}
      </div>

      {/* Progress bar — count vs leader */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[8px] uppercase tracking-[0.25em] font-black" style={{ color: "rgba(45,122,31,0.5)" }}>Espèces</p>
          <p className="text-xs font-black" style={{ color: G }}>{discoveries}/{leader?.species_count || discoveries}</p>
        </div>
        <div className="h-2 w-full" style={{ background: "rgba(45,122,31,0.1)" }}>
          <div
            className="h-2 transition-all duration-500"
            style={{
              width: leader ? `${Math.min((discoveries / leader.species_count) * 100, 100)}%` : "100%",
              background: isLeader ? "rgba(45,122,31,0.4)" : G,
            }}
          />
        </div>
      </div>

      {/* Leader info */}
      {leader && !isLeader && (
        <div className="flex items-center justify-between text-[8px]">
          <div>
            <p style={{ color: "rgba(45,122,31,0.5)", textTransform: "uppercase", fontWeight: 900 }}>Leader</p>
            <p style={{ color: G, fontWeight: 900 }} className="uppercase">{leader.display_name}</p>
          </div>
          <div className="text-right">
            <p style={{ color: "rgba(45,122,31,0.5)", textTransform: "uppercase", fontWeight: 900 }}>Écart</p>
            <p style={{ color: G, fontWeight: 900 }} className="text-sm">{Math.max(0, leader.species_count - discoveries)}</p>
          </div>
        </div>
      )}

      {isLeader && (
        <p className="text-[8px] text-center uppercase tracking-[0.3em] font-black" style={{ color: G }}>
          Tu domines cette zone
        </p>
      )}
    </div>
  );
}