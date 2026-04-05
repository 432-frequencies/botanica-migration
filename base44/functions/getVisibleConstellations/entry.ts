import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { latitude, longitude, hour } = await req.json();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentHour = hour ?? now.getHours();

    const allConstellations = await base44.entities.Constellation.list();

    const visible = allConstellations.filter((c) => {
      // Latitude filter
      if (latitude != null) {
        if (c.visible_latitude_min != null && latitude < c.visible_latitude_min) return false;
        if (c.visible_latitude_max != null && latitude > c.visible_latitude_max) return false;
      }

      // Month filter
      if (c.best_viewing_months?.length > 0 && !c.best_viewing_months.includes(currentMonth)) return false;

      // Hour filter from best_viewing_time (e.g. "21:00-03:00" or "20:00-23:00")
      if (c.best_viewing_time) {
        const match = c.best_viewing_time.match(/(\d{1,2}):?\d{0,2}\s*-\s*(\d{1,2}):?\d{0,2}/);
        if (match) {
          const start = parseInt(match[1]);
          const end = parseInt(match[2]);
          if (start > end) {
            // Spans midnight
            if (currentHour < start && currentHour > end) return false;
          } else {
            if (currentHour < start || currentHour > end) return false;
          }
        }
      }

      return true;
    });

    // Sort by magnitude (lower = brighter = more visible first)
    visible.sort((a, b) => (a.magnitude ?? 99) - (b.magnitude ?? 99));

    return Response.json({ constellations: visible, count: visible.length });
  } catch (error) {
    console.error('getVisibleConstellations error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});