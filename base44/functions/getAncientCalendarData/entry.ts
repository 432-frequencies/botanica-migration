import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Known new moon reference date
const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z');
const LUNAR_CYCLE = 29.53;

function getMoonPhase(date) {
  const daysSince = (date - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24);
  const moonAge = ((daysSince % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE;
  const illumination = Math.round((1 - Math.cos((moonAge / LUNAR_CYCLE) * 2 * Math.PI)) / 2 * 100);

  let phase;
  if (moonAge < 1.85) phase = 'new_moon';
  else if (moonAge < 5.53) phase = 'waxing_crescent';
  else if (moonAge < 9.22) phase = 'first_quarter';
  else if (moonAge < 12.91) phase = 'waxing_gibbous';
  else if (moonAge < 16.61) phase = 'full_moon';
  else if (moonAge < 20.30) phase = 'waning_gibbous';
  else if (moonAge < 23.99) phase = 'last_quarter';
  else if (moonAge < 27.68) phase = 'waning_crescent';
  else phase = 'new_moon';

  return { phase, moon_age: Math.round(moonAge * 10) / 10, illumination_percent: illumination };
}

function getGardeningAdvice(phase) {
  const advice = {
    new_moon: { text: 'Rest period. Good time to plan your garden and prepare soil.', good_for_planting: [], good_for_harvesting: [] },
    waxing_crescent: { text: 'Increasing energy. Plant above-ground crops — leaves, flowers, and fruits.', good_for_planting: ['Lettuce', 'Spinach', 'Herbs', 'Flowers'], good_for_harvesting: [] },
    first_quarter: { text: 'Strong upward growth. Excellent for planting all leafy greens and grains.', good_for_planting: ['Grain crops', 'Leafy greens', 'Fruit trees'], good_for_harvesting: ['Flowers'] },
    waxing_gibbous: { text: 'Peak energy period. Plant fruits and above-ground vegetables.', good_for_planting: ['Tomatoes', 'Peppers', 'Cucumbers', 'Melons'], good_for_harvesting: ['Fruits', 'Seeds'] },
    full_moon: { text: 'Maximum energy. Harvest fruits and medicines. Avoid planting.', good_for_planting: [], good_for_harvesting: ['Fruits', 'Medicinal herbs', 'Berries', 'Grapes'] },
    waning_gibbous: { text: 'Energy decreasing. Plant root vegetables and bulbs.', good_for_planting: ['Carrots', 'Beets', 'Garlic', 'Onions'], good_for_harvesting: ['Root vegetables'] },
    last_quarter: { text: 'Good for planting roots and pruning. Avoid watering heavily.', good_for_planting: ['Root crops', 'Bulbs', 'Tubers'], good_for_harvesting: ['Root vegetables', 'Storage crops'] },
    waning_crescent: { text: 'Deep rest phase. Best for composting, pruning, and soil preparation.', good_for_planting: ['Perennials', 'Trees'], good_for_harvesting: [] },
  };
  return advice[phase] || advice.new_moon;
}

function getCurrentSeason(date) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { date } = await req.json();
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    const moonData = getMoonPhase(targetDate);
    const gardeningAdvice = getGardeningAdvice(moonData.phase);

    // Fetch upcoming solar events and today's lunar entry in parallel
    const [solarEvents, lunarEntries] = await Promise.all([
      base44.entities.SolarEvent.list('date', 20),
      base44.entities.LunarCalendar.filter({ date: dateStr }),
    ]);

    const upcomingSolar = solarEvents
      .filter((e) => e.date >= dateStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    const lunarEntry = lunarEntries[0] || null;

    // Merge calculated moon data with DB entry if exists
    const moonPhaseData = {
      phase: lunarEntry?.moon_phase || moonData.phase,
      moon_age: lunarEntry?.moon_age ?? moonData.moon_age,
      illumination_percent: lunarEntry?.illumination_percent ?? moonData.illumination_percent,
      gardening_advice: lunarEntry?.gardening_advice || gardeningAdvice.text,
      best_for_planting: lunarEntry?.best_for_planting?.length ? lunarEntry.best_for_planting : gardeningAdvice.good_for_planting,
      best_for_harvesting: lunarEntry?.best_for_harvesting?.length ? lunarEntry.best_for_harvesting : gardeningAdvice.good_for_harvesting,
      traditional_beliefs: lunarEntry?.traditional_beliefs || [],
      moonrise_time: lunarEntry?.moonrise_time || null,
      moonset_time: lunarEntry?.moonset_time || null,
      is_supermoon: lunarEntry?.is_supermoon || false,
      is_blue_moon: lunarEntry?.is_blue_moon || false,
      is_blood_moon: lunarEntry?.is_blood_moon || false,
    };

    return Response.json({
      date: dateStr,
      season: getCurrentSeason(targetDate),
      moon_phase: moonPhaseData,
      solar_events: upcomingSolar,
      gardening_advice: gardeningAdvice,
    });
  } catch (error) {
    console.error('getAncientCalendarData error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});