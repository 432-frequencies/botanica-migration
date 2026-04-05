import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";

const G = "#2EA80F";

export default function CurrentZoneStatus({ userEmail, lat, lng, userPlants }) {
  const [leader, setLeader] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!lat || !lng) {
        setLoading(false);
        return;
      }
      
      const gridLat = Math.floor((lat - 42) / (52 - 42) * 10);
      const gridLng = Math.floor((lng + 6) / (8 + 6) * 10);
      const zoneId = `${gridLat}_${gridLng}`;

      const { data } = await supabase.from('zone_leaders').select('*').eq('zone_id', zoneId).limit(1);
      setLeader(data?.[0] || null);
      setLoading(false);
    };

    load();
  }, [lat, lng]);

  if (loading || !leader) return null;

  const gap = Math.max(0, leader.species_count - (userPlants || 0));

  return (
    <div
      className="p-3 mt-2 text-xs"
      style={{
        background: "rgba(46,168,15,0.08)",
        border: "1px solid rgba(46,168,15,0.15)",
        borderRadius: "6px",
      }}
    >
      <p className="font-black uppercase tracking-[0.2em] mb-1.5" style={{ color: G }}>
        Zone Actuelle
      </p>
      <div className="space-y-1" style={{ color: "rgba(226,234,224,0.7)" }}>
        <p>Leader: <span style={{ color: G }}>{leader.display_name}</span> ({leader.species_count})</p>
        <p>Toi: {userPlants || 0}</p>
        {gap > 0 ? (
          <p style={{ color: "rgba(255,255,255,0.6)" }}>
            → {gap} espèces pour dominer
          </p>
        ) : (
          <p style={{ color: G }}>✓ Tu domines cette zone</p>
        )}
      </div>
    </div>
  );
}