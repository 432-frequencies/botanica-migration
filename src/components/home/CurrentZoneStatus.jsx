import { useEffect, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useZoneLabel } from "@/lib/locationMeta";
import { computeUserZoneScores, getZoneId } from "@/lib/zones";
import { Compass, MapPin, Sparkles } from "lucide-react";

const G = "#2EA80F";
const GOLD = "#C8960A";

export default function CurrentZoneStatus({ userEmail, lat, lng, discoveries = [] }) {
  const [leader, setLeader] = useState(null);
  const [loading, setLoading] = useState(true);

  const zoneId = getZoneId(lat, lng);
  const { label: zoneName } = useZoneLabel(zoneId);
  const zoneScores = computeUserZoneScores(discoveries);
  const userSpecies = zoneId ? (zoneScores[zoneId] || 0) : 0;

  useEffect(() => {
    const load = async () => {
      if (!zoneId) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("zone_leaders")
        .select("*")
        .eq("zone_id", zoneId)
        .order("species_count", { ascending: false })
        .limit(1);

      setLeader(data?.[0] || null);
      setLoading(false);
    };

    load();
  }, [zoneId]);

  if (loading || !zoneId) return null;

  const isLeader = leader?.user_email === userEmail;
  const noLeader = !leader;
  const gap = leader ? Math.max(1, leader.species_count + 1 - userSpecies) : 1;
  const canTakeCrown = !isLeader && !noLeader && userSpecies >= (leader.species_count + 1);
  const targetScore = noLeader ? 1 : leader.species_count + 1;
  const progressPct = Math.min(100, (userSpecies / targetScore) * 100);
  const tone = isLeader ? GOLD : canTakeCrown ? G : noLeader ? "#53C1FF" : G;
  const statusTitle = isLeader
    ? "Reference locale"
    : canTakeCrown
      ? "Contribution decisive"
      : noLeader
        ? "Zone a initier"
        : "Observation en cours";
  const mission = isLeader
    ? "Ajoute une espece locale pour consolider la documentation de cette zone."
    : canTakeCrown
      ? "Tu as deja le score. Ouvre la carte et valide une contribution majeure ici."
      : noLeader
        ? "Une seule espece unique ici suffit pour lancer la documentation locale."
        : `Encore ${gap} especes uniques pour devenir la reference devant ${leader.display_name}.`;

  return (
    <div
      className="p-3 mt-2 text-xs"
      style={{
        background: isLeader ? "rgba(200,150,10,0.06)" : noLeader ? "rgba(83,193,255,0.08)" : "rgba(46,168,15,0.08)",
        border: `1px solid ${isLeader ? "rgba(200,150,10,0.25)" : noLeader ? "rgba(83,193,255,0.22)" : "rgba(46,168,15,0.15)"}`,
        borderRadius: "6px",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-black uppercase tracking-[0.2em] mb-1.5" style={{ color: tone }}>
            Repere terrain
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: tone }}>
            {statusTitle}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: tone }}>
          {isLeader ? <Compass className="w-3 h-3" /> : noLeader ? <Sparkles className="w-3 h-3" /> : <MapPin className="w-3 h-3" />}
          {zoneName || zoneId}
        </div>
      </div>

      <p className="mb-2 leading-relaxed" style={{ color: "rgba(226,234,224,0.78)" }}>
        {mission}
      </p>

      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(226,234,224,0.45)" }}>
          Progression locale
        </p>
        <p className="text-[8px] font-black uppercase tracking-[0.22em]" style={{ color: tone }}>
          {userSpecies}/{targetScore}
        </p>
      </div>
      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: tone }} />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-2" style={{ color: "rgba(226,234,224,0.72)" }}>
        <div>
          <p className="text-[7px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(226,234,224,0.4)" }}>
            Reference
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: tone }}>
            {noLeader ? "A initier" : leader.display_name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[7px] font-black uppercase tracking-[0.22em]" style={{ color: "rgba(226,234,224,0.4)" }}>
            Dynamique
          </p>
          <p className="text-[10px] font-black uppercase tracking-[0.08em]" style={{ color: tone }}>
            {isLeader ? "Stable" : canTakeCrown ? "Pret" : noLeader ? "Ouverte" : `-${gap}`}
          </p>
        </div>
      </div>
    </div>
  );
}
