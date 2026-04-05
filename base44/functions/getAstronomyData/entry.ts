import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const APP_ID = Deno.env.get("ASTRONOMY_API_APP_ID");
const APP_SECRET = Deno.env.get("ASTRONOMY_API_SECRET");

function getBasicAuth() {
  return btoa(`${APP_ID}:${APP_SECRET}`);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { latitude, longitude, date, debug } = await req.json();

    if (!latitude || !longitude) {
      return Response.json({ error: 'latitude and longitude are required' }, { status: 400 });
    }

    const now = new Date();
    const queryDate = date || now.toISOString().split('T')[0];
    const queryTime = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00`;

    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      elevation: '0',
      from_date: queryDate,
      to_date: queryDate,
      time: queryTime,
      output: 'rows',
    });

    const posRes = await fetch(
      `https://api.astronomyapi.com/api/v2/bodies/positions?${params.toString()}`,
      {
        headers: {
          Authorization: `Basic ${getBasicAuth()}`,
        },
      }
    );

    if (!posRes.ok) {
      const errText = await posRes.text();
      return Response.json({ error: `AstronomyAPI error: ${posRes.status}`, detail: errText }, { status: 502 });
    }

    const posData = await posRes.json();

    // Debug mode: return raw response to inspect structure
    if (debug) {
      return Response.json({ raw: posData });
    }

    const bodies = {};
    const rows = posData?.data?.rows || [];

    rows.forEach(row => {
      // API returns: { body: { id, name }, positions: [{ position, distance, extraInfo, ... }] }
      const id = row.body?.id;
      const pos = row.positions?.[0];
      if (id && pos) {
        const alt = parseFloat(pos.position?.horizontal?.altitude?.degrees ?? 0);
        bodies[id] = {
          name: row.body.name,
          altitude: alt,
          azimuth: parseFloat(pos.position?.horizontal?.azimuth?.degrees ?? 0),
          constellation: pos.position?.constellation?.name || null,
          constellation_id: pos.position?.constellation?.id || null,
          distance_au: pos.distance?.fromEarth?.au || null,
          magnitude: pos.extraInfo?.magnitude || null,
          isAboveHorizon: alt > 0,
        };
      }
    });

    const activeConstellations = [...new Set(
      Object.values(bodies)
        .filter(b => b.isAboveHorizon && b.constellation_id)
        .map(b => b.constellation_id)
    )];

    return Response.json({
      bodies,
      activeConstellations,
      date: queryDate,
      time: queryTime,
      observer: { latitude, longitude },
      rowCount: rows.length,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});