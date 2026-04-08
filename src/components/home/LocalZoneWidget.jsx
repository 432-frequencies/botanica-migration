import { useState, useEffect } from "react";
import { supabase } from "@/api/supabaseClient";
import { MapPin, Lock, Target, Trophy, Zap, TrendingUp, Flame, Award } from "lucide-react";

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
  const [userProfile, setUserProfile] = useState(null);
  const [allDiscoveries, setAllDiscoveries] = useState([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);

  useEffect(() => {
    if (!geoCoords || !userEmail) return;
    loadZoneData();
  }, [geoCoords, userEmail]);

  // Rotate challenges every 12 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentChallengeIndex(prev => (prev + 1) % 6);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const loadZoneData = async () => {
    setLoading(true);
    try {
      const zoneId = getZoneId(geoCoords.lat, geoCoords.lng);
      const [leaderRes, discoveriesRes, profileRes] = await Promise.all([
        supabase.from('zone_leaders').select('*').eq('zone_id', zoneId).order('species_count', { ascending: false }).limit(1),
        supabase.from('plant_discoveries').select('*').eq('user_email', userEmail),
        supabase.from('user_profiles').select('*').eq('user_email', userEmail).single(),
      ]);

      const discoveries = discoveriesRes.data || [];
      const zoneLeader = leaderRes.data?.[0] || null;
      const profile = profileRes.data || null;

      setLeader(zoneLeader);
      setZone(zoneId);
      setUserProfile(profile);
      setAllDiscoveries(discoveries);

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

      {/* ⭐ ROTATING CHALLENGES - Motivating gamification */}
      {userProfile && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(45,122,31,0.2)" }}>
          <p className="text-[7px] font-black uppercase tracking-[0.3em] mb-2" style={{ color: "rgba(45,122,31,0.5)" }}>Objectifs Actifs</p>
          <div className="space-y-2">
            {getChallenges(userProfile, allDiscoveries, leader, discoveries).map((challenge, index) => (
              <div
                key={index}
                className={`transition-all duration-500 ${index === currentChallengeIndex ? 'opacity-100' : 'opacity-40 scale-95'}`}
                style={{
                  display: index === currentChallengeIndex || index === (currentChallengeIndex + 1) % 6 ? 'block' : 'none',
                  transform: index === currentChallengeIndex ? 'scale(1)' : 'scale(0.95)',
                }}
              >
                <div className="flex items-start gap-2 p-2 rounded-lg" style={{ background: "rgba(45,122,31,0.05)", border: "1px solid rgba(45,122,31,0.15)" }}>
                  <div className="flex-shrink-0 mt-0.5">
                    {challenge.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: G }}>{challenge.title}</p>
                    <p className="text-[8px] leading-relaxed mt-0.5" style={{ color: "rgba(45,122,31,0.7)" }}>{challenge.description}</p>
                    {challenge.progress !== null && (
                      <div className="mt-1.5">
                        <div className="h-1 w-full rounded-full" style={{ background: "rgba(45,122,31,0.15)" }}>
                          <div
                            className="h-1 rounded-full transition-all duration-700"
                            style={{
                              width: `${Math.min(challenge.progress, 100)}%`,
                              background: challenge.progress >= 100 ? "#2EA80F" : "rgba(45,122,31,0.5)",
                            }}
                          />
                        </div>
                        <p className="text-[7px] font-black uppercase mt-0.5" style={{ color: "rgba(45,122,31,0.5)" }}>
                          {challenge.progressText}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Generate dynamic challenges based on user progress
function getChallenges(profile, discoveries, leader, localDiscoveries) {
  const challenges = [];
  const totalPoints = profile?.total_points || 0;
  const streakDays = profile?.streak_days || 0;
  const totalPlants = profile?.total_plants || 0;

  // Calculate category-specific counts
  const birdCount = discoveries.filter(d => d.category === 'bird').length;
  const fungusCount = discoveries.filter(d => d.category === 'fungus').length;
  const rareCount = discoveries.filter(d => ['rare', 'legendaire'].includes(d.rarity)).length;

  // Challenge 1: Next level progress
  const currentLevel = Math.floor(totalPoints / 1000) + 1;
  const pointsToNextLevel = (currentLevel * 1000) - totalPoints;
  const levelProgress = ((totalPoints % 1000) / 1000) * 100;
  challenges.push({
    icon: <Trophy className="w-3.5 h-3.5" style={{ color: G }} />,
    title: `Niveau ${currentLevel + 1}`,
    description: `Plus que ${pointsToNextLevel} XP pour atteindre le prochain niveau`,
    progress: levelProgress,
    progressText: `${totalPoints % 1000}/1000 XP`,
  });

  // Challenge 2: Zone domination
  if (leader && !leader.user_email !== profile?.user_email) {
    const gap = Math.max(0, leader.species_count - localDiscoveries);
    const zoneProgress = (localDiscoveries / leader.species_count) * 100;
    challenges.push({
      icon: <Target className="w-3.5 h-3.5" style={{ color: G }} />,
      title: "Dominer la Zone",
      description: `Trouve ${gap} espèces pour devenir leader de zone`,
      progress: zoneProgress,
      progressText: `${localDiscoveries}/${leader.species_count} espèces`,
    });
  }

  // Challenge 3: Collector milestone
  const nextMilestone = Math.ceil(totalPlants / 10) * 10;
  const collectorProgress = ((totalPlants % 10) / 10) * 100;
  challenges.push({
    icon: <Award className="w-3.5 h-3.5" style={{ color: G }} />,
    title: "Collectionneur",
    description: `Atteins ${nextMilestone} espèces uniques au total`,
    progress: collectorProgress,
    progressText: `${totalPlants}/${nextMilestone} espèces`,
  });

  // Challenge 4: Bird specialist
  const birdGoal = 5;
  const birdProgress = (birdCount / birdGoal) * 100;
  challenges.push({
    icon: <Zap className="w-3.5 h-3.5" style={{ color: G }} />,
    title: "Ornithologue",
    description: `Identifie ${birdGoal} oiseaux différents`,
    progress: birdProgress,
    progressText: `${birdCount}/${birdGoal} oiseaux`,
  });

  // Challenge 5: Mushroom specialist
  const fungusGoal = 5;
  const fungusProgress = (fungusCount / fungusGoal) * 100;
  challenges.push({
    icon: <TrendingUp className="w-3.5 h-3.5" style={{ color: G }} />,
    title: "Mycologue",
    description: `Découvre ${fungusGoal} champignons uniques`,
    progress: fungusProgress,
    progressText: `${fungusCount}/${fungusGoal} champignons`,
  });

  // Challenge 6: Streak keeper
  const streakGoal = 7;
  const streakProgress = (streakDays / streakGoal) * 100;
  challenges.push({
    icon: <Flame className="w-3.5 h-3.5" style={{ color: streakDays >= 3 ? "#FF6B35" : G }} />,
    title: "Série Active",
    description: streakDays >= streakGoal ? "Série hebdomadaire complète !" : `Scanne ${streakGoal - streakDays} jours de plus`,
    progress: streakProgress,
    progressText: `${streakDays}/${streakGoal} jours`,
  });

  return challenges;
}