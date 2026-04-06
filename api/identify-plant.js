import { createClient } from '@supabase/supabase-js';

// ─── helpers ─────────────────────────────────────────────────────────────────

async function readBody(req) {
  // vercel dev pre-parses application/json bodies into req.body
  if (req.body !== undefined) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

function parseImage(imageBase64) {
  if (imageBase64.startsWith('data:')) {
    const [header, data] = imageBase64.split(',');
    const mediaType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    return { data, mediaType };
  }
  return { data: imageBase64, mediaType: 'image/jpeg' };
}

async function callGemini(b64, mediaType, prompt, maxTokens = 1024) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mediaType,
              data: b64,
            },
          },
          { text: prompt },
        ],
      }],
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Gemini error:', err);
    return null;
  }

  const out = await res.json();
  const text = out.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : JSON.parse(text);
  } catch {
    console.error('Gemini JSON parse failed:', text.slice(0, 300));
    return null;
  }
}

// ─── category detection ───────────────────────────────────────────────────────

async function detectCategory(b64, mediaType) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mediaType,
              data: b64,
            },
          },
          {
            text: 'What does this image primarily show? Reply with ONLY one word — one of: fungus, tree, plant, bird, rock, insect. No other text.',
          },
        ],
      }],
      generationConfig: {
        maxOutputTokens: 10,
      },
    }),
  });

  if (!res.ok) return 'plant';
  const out = await res.json();
  const text = (out.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase().split(/\s/)[0];
  const valid = ['fungus', 'tree', 'plant', 'bird', 'rock', 'insect'];
  return valid.includes(text) ? text : 'plant';
}

// ─── identification prompts (Claude pour toutes les catégories) ───────────────

const PROMPTS = {
  plant: `Tu es un expert botaniste. Identifie la plante dans cette image avec le maximum de précision.
Rareté: "commune" (pissenlit, ortie, coquelicot), "peu_commune" (régional ou moins fréquent), "rare" (saisonnier ou protégé), "legendaire" (espèce protégée ou très rare).
Réponds UNIQUEMENT avec ce JSON (pas de texte avant ni après) :
{"found":true,"common_name":"...","scientific_name":"...","family":"...","confidence":85,"rarity":"commune","is_edible":false,"is_toxic":false,"is_cannabis":false,"description":"2-3 phrases sur la plante.","edibility_details":"...","medicinal_uses":"...","anecdote":"...","habitat":"...","alternatives":[{"common_name":"...","scientific_name":"...","confidence":70}]}`,

  tree: `Tu es un expert dendrologue. Identifie l'arbre ou l'arbuste dans cette image.
Rareté: "commune" (chêne, pin, hêtre), "peu_commune" (moins fréquent), "rare" (local ou protégé), "legendaire" (très rare ou exceptionnel).
Réponds UNIQUEMENT avec ce JSON (pas de texte avant ni après) :
{"found":true,"common_name":"...","scientific_name":"...","family":"...","confidence":85,"rarity":"commune","is_edible":false,"is_toxic":false,"description":"2-3 phrases sur l'arbre.","edibility_details":"...","medicinal_uses":"...","anecdote":"...","habitat":"...","alternatives":[{"common_name":"...","scientific_name":"...","confidence":70}]}`,

  fungus: `Tu es un expert mycologue. Identifie le champignon dans cette image. IMPORTANT: précise toujours si comestible ou toxique.
Rareté: "commune" (bolet, girolle, amanite tue-mouche), "peu_commune" (régional), "rare" (saisonnier ou local), "legendaire" (protégé ou exceptionnel).
Réponds UNIQUEMENT avec ce JSON (pas de texte avant ni après) :
{"found":true,"common_name":"...","scientific_name":"...","family":"...","confidence":80,"rarity":"commune","is_edible":false,"is_toxic":true,"description":"2-3 phrases.","edibility_details":"Détails comestibilité ou toxicité.","anecdote":"...","habitat":"...","alternatives":[{"common_name":"...","scientific_name":"...","confidence":60}]}`,

  bird: `Tu es un expert ornithologue. Identifie l'oiseau dans cette image.
Rareté: "commune" (moineau, pigeon, merle), "peu_commune" (pic, martin-pêcheur), "rare" (migrateur), "legendaire" (en danger ou observation exceptionnelle).
Réponds UNIQUEMENT avec ce JSON (pas de texte avant ni après) :
{"found":true,"common_name":"...","scientific_name":"...","family":"...","confidence":80,"rarity":"commune","description":"2-3 phrases.","habitat":"...","behavior":"Régime alimentaire, migration, nidification.","anecdote":"...","alternatives":[{"common_name":"...","scientific_name":"...","confidence":60}]}`,

  insect: `Tu es un expert entomologiste. Identifie l'insecte dans cette image.
Rareté: "commune" (fourmi, mouche, abeille), "peu_commune" (régional), "rare" (saisonnier), "legendaire" (en danger).
Réponds UNIQUEMENT avec ce JSON (pas de texte avant ni après) :
{"found":true,"common_name":"...","scientific_name":"...","family":"...","confidence":75,"rarity":"commune","description":"2-3 phrases.","habitat":"...","behavior":"Cycle de vie, régime alimentaire.","anecdote":"...","alternatives":[{"common_name":"...","scientific_name":"...","confidence":55}]}`,

  rock: `Tu es un expert géologue. Identifie la roche, le minéral ou le cristal dans cette image.
Rareté: "commune" (granite, calcaire, quartz), "peu_commune" (basalte, marbre), "rare" (minéral rare), "legendaire" (cristal gemme, météorite).
Réponds UNIQUEMENT avec ce JSON (pas de texte avant ni après) :
{"found":true,"common_name":"...","scientific_name":"Formule chimique ou classification","family":"Type: ignée/sédimentaire/métamorphique","confidence":75,"rarity":"commune","description":"2-3 phrases.","habitat":"Où on le trouve.","behavior":"Formation, dureté, utilisations.","anecdote":"...","alternatives":[{"common_name":"...","scientific_name":"...","confidence":55}]}`,
};

function buildResult(data, category, profile) {
  if (!data?.found || !data?.common_name) return null;

  return {
    top_result: {
      common_name: data.common_name,
      scientific_name: data.scientific_name || '',
      family: data.family || '',
      confidence: data.confidence || 70,
      rarity: data.rarity || 'commune',
      is_edible: data.is_edible ?? false,
      is_toxic: data.is_toxic ?? false,
      is_cannabis: data.is_cannabis ?? false,
      strain_type: '',
      description: data.description || '',
      edibility_details: data.edibility_details || '',
      medicinal_uses: data.medicinal_uses || '',
      anecdote: data.anecdote || '',
      habitat: data.habitat || '',
      behavior: data.behavior || '',
    },
    alternatives: profile.is_pro ? (data.alternatives || []).slice(0, 2) : [],
    is_pro: profile.is_pro,
    daily_count: (profile.daily_identifications_count || 0) + 1,
    daily_limit: 5,
  };
}

// ─── main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { imageBase64, isAdminTest } = body;
  if (!imageBase64) return res.status(400).json({ error: 'No image provided' });

  const { data: b64, mediaType } = parseImage(imageBase64);
  const today = new Date().toISOString().split('T')[0];

  // Get or create user profile
  let { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_email', user.email)
    .single();

  if (!profile) {
    const { data: created } = await supabase
      .from('user_profiles')
      .insert({
        user_email: user.email,
        is_pro: false,
        total_points: 0,
        total_plants: 0,
        daily_identifications_count: 0,
        daily_reset_date: today,
        rank: 'Débutant',
        onboarding_completed: false,
      })
      .select()
      .single();
    profile = created || { is_pro: false, daily_identifications_count: 0, daily_reset_date: today };
  } else if (profile.daily_reset_date !== today) {
    await supabase
      .from('user_profiles')
      .update({ daily_identifications_count: 0, daily_reset_date: today })
      .eq('user_email', user.email);
    profile.daily_identifications_count = 0;
  }

  // Daily limit check
  if (!isAdminTest && !profile.is_pro && (profile.daily_identifications_count || 0) >= 5) {
    return res.status(429).json({ error: 'LIMIT_REACHED' });
  }

  // Detect category
  const category = await detectCategory(b64, mediaType);
  console.log(`[identify-plant] user=${user.email} category=${category}`);

  // Identify via Gemini
  const prompt = PROMPTS[category] || PROMPTS.plant;
  const data = await callGemini(b64, mediaType, prompt);
  const result = buildResult(data, category, profile);

  if (!result) {
    console.log('[identify-plant] NO_PLANT_FOUND — Gemini returned:', JSON.stringify(data));
    return res.json({ error: 'NO_PLANT_FOUND' });
  }

  // Increment daily counter
  await supabase
    .from('user_profiles')
    .update({ daily_identifications_count: (profile.daily_identifications_count || 0) + 1 })
    .eq('user_email', user.email);

  return res.json({ ...result, category });
}
