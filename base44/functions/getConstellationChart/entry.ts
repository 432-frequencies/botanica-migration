import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const APP_ID = Deno.env.get("ASTRONOMY_API_APP_ID");
const APP_SECRET = Deno.env.get("ASTRONOMY_API_SECRET");

function getBasicAuth() {
  return btoa(`${APP_ID}:${APP_SECRET}`);
}

// Map French/Latin constellation names to AstronomyAPI 3-letter IDs
const CONSTELLATION_ID_MAP = {
  'ori': 'ori', 'orion': 'ori',
  'uma': 'uma', 'ursa major': 'uma', 'grande ourse': 'uma',
  'umi': 'umi', 'ursa minor': 'umi', 'petite ourse': 'umi',
  'cas': 'cas', 'cassiopeia': 'cas',
  'leo': 'leo', 'lion': 'leo',
  'sco': 'sco', 'scorpius': 'sco', 'scorpion': 'sco',
  'cyg': 'cyg', 'cygnus': 'cyg', 'cygne': 'cyg',
  'sgr': 'sgr', 'sagittarius': 'sgr', 'sagittaire': 'sgr',
  'tau': 'tau', 'taurus': 'tau', 'taureau': 'tau',
  'gem': 'gem', 'gemini': 'gem', 'gémeaux': 'gem',
  'aql': 'aql', 'aquila': 'aql', 'aigle': 'aql',
  'lyr': 'lyr', 'lyra': 'lyr', 'lyre': 'lyr',
  'per': 'per', 'perseus': 'per', 'persée': 'per',
  'aur': 'aur', 'auriga': 'aur', 'cocher': 'aur',
  'vir': 'vir', 'virgo': 'vir', 'vierge': 'vir',
  'psc': 'psc', 'pisces': 'psc', 'poissons': 'psc',
  'aqr': 'aqr', 'aquarius': 'aqr', 'verseau': 'aqr',
  'cap': 'cap', 'capricornus': 'cap', 'capricorne': 'cap',
  'lib': 'lib', 'libra': 'lib', 'balance': 'lib',
  'cnc': 'cnc', 'cancer': 'cnc',
  'ari': 'ari', 'aries': 'ari', 'bélier': 'ari',
  'and': 'and', 'andromeda': 'and', 'andromède': 'and',
  'her': 'her', 'hercules': 'her', 'hercule': 'her',
  'boo': 'boo', 'boötes': 'boo', 'bouvier': 'boo',
  'cen': 'cen', 'centaurus': 'cen', 'centaure': 'cen',
  'cru': 'cru', 'crux': 'cru', 'croix du sud': 'cru',
};

function resolveConstellationId(constellation) {
  if (!constellation) return null;
  const abbr = constellation.abbreviation?.toLowerCase();
  const latin = constellation.name_latin?.toLowerCase();
  const french = constellation.name_french?.toLowerCase();

  return CONSTELLATION_ID_MAP[abbr] ||
    CONSTELLATION_ID_MAP[latin] ||
    CONSTELLATION_ID_MAP[french] ||
    abbr ||
    null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { constellation_id, constellation_name, latitude, longitude, style } = await req.json();

    if (!constellation_id && !constellation_name) {
      return Response.json({ error: 'constellation_id or constellation_name required' }, { status: 400 });
    }

    const lat = latitude || 48.8566; // Paris default
    const lng = longitude || 2.3522;
    const date = new Date().toISOString().split('T')[0];
    const chartStyle = style || 'navy';

    // Resolve the 3-letter constellation ID
    let constellationCode = constellation_id?.toLowerCase();
    if (!constellationCode && constellation_name) {
      constellationCode = CONSTELLATION_ID_MAP[constellation_name.toLowerCase()] || constellation_name.slice(0, 3).toLowerCase();
    }

    console.log(`Generating star chart for constellation: ${constellationCode}, lat=${lat}, lng=${lng}`);

    const chartRes = await fetch('https://api.astronomyapi.com/api/v2/studio/star-chart', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${getBasicAuth()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        style: chartStyle,
        observer: {
          latitude: lat,
          longitude: lng,
          date,
        },
        view: {
          type: 'constellation',
          parameters: {
            constellation: constellationCode,
          },
        },
      }),
    });

    if (!chartRes.ok) {
      const errText = await chartRes.text();
      console.error('AstronomyAPI star-chart error:', chartRes.status, errText);
      return Response.json({ error: `AstronomyAPI error: ${chartRes.status}`, detail: errText }, { status: 502 });
    }

    const chartData = await chartRes.json();
    const imageUrl = chartData?.data?.imageUrl;

    console.log('Star chart generated:', imageUrl);

    return Response.json({ imageUrl, constellation: constellationCode });

  } catch (error) {
    console.error('getConstellationChart error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});