import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Common mushroom/fungi keywords to detect in names
const FUNGI_KEYWORDS = [
  // French common names
  "champignon", "cèpe", "cepe", "bolet", "amanite", "chanterelle", "girolle",
  "morille", "truffe", "pleurote", "shiitake", "cortinaire", "russule",
  "lactaire", "tricholome", "armillaire", "coprin", "lépiote", "lepiote",
  "marasmius", "pied bleu", "pied de mouton", "trompette", "vesse de loup",
  "polypore", "amadouvier", "pholiote", "hygrophore", "entolome",
  // Scientific genera
  "boletus", "amanita", "cantharellus", "morchella", "tuber", "pleurotus",
  "lentinula", "cortinarius", "russula", "lactarius", "tricholoma",
  "armillaria", "coprinus", "lepiota", "marasmius", "hygrophorus",
  "entoloma", "pholiota", "suillus", "xerocomus", "leccinum",
  "hydnum", "craterellus", "laetiporus", "fomes", "ganoderma",
  "calvatia", "lycoperdon", "peziza", "gyromitra", "helvella",
  "clitocybe", "mycena", "collybia", "macrolepiota", "agaricus",
  "stropharia", "psilocybe", "panaeolus", "inocybe", "hebeloma",
  "flammulina", "hypsizygus"
];

function isFungi(commonName, scientificName) {
  const combined = `${commonName || ""} ${scientificName || ""}`.toLowerCase();
  return FUNGI_KEYWORDS.some(kw => combined.includes(kw));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false; // default to dry run

    // Fetch all non-fungus discoveries
    const all = await base44.asServiceRole.entities.PlantDiscovery.list('-created_date', 2000);

    const toUpdate = all.filter(d =>
      (d.category || 'plant') !== 'fungus' && isFungi(d.common_name, d.scientific_name)
    );

    console.log(`Found ${toUpdate.length} records to recategorize as fungus (dry_run=${dryRun})`);

    if (!dryRun) {
      let updated = 0;
      for (const d of toUpdate) {
        await base44.asServiceRole.entities.PlantDiscovery.update(d.id, { category: 'fungus' });
        updated++;
        console.log(`Updated: ${d.common_name} (${d.scientific_name}) [${d.id}]`);
      }
      return Response.json({ success: true, updated, dry_run: false, items: toUpdate.map(d => ({ id: d.id, name: d.common_name, scientific: d.scientific_name })) });
    }

    return Response.json({
      success: true,
      dry_run: true,
      would_update: toUpdate.length,
      items: toUpdate.map(d => ({ id: d.id, name: d.common_name, scientific: d.scientific_name, current_category: d.category }))
    });

  } catch (error) {
    console.error('Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});