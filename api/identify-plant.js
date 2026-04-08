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

async function callGemini(b64, mediaType, prompt, maxTokens = 4096) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
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
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            found: { type: 'boolean' },
            common_name: { type: 'string', maxLength: 100 },
            scientific_name: { type: 'string', maxLength: 150 },
            family: { type: 'string', maxLength: 100 },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
            rarity: { type: 'string', enum: ['commune', 'peu_commune', 'rare', 'legendaire'] },
            is_edible: { type: 'boolean' },
            is_toxic: { type: 'boolean' },
            is_cannabis: { type: 'boolean' },
            description: { type: 'string', maxLength: 800 },
            edibility_details: { type: 'string', maxLength: 600 },
            medicinal_uses: { type: 'string', maxLength: 600 },
            anecdote: { type: 'string', maxLength: 600 },
            habitat: { type: 'string', maxLength: 500 },
            ecological_role: { type: 'string', maxLength: 600 },
            biodiversity_importance: { type: 'string', maxLength: 600 },
            alternatives: {
              type: 'array',
              maxItems: 3,
              items: {
                type: 'object',
                properties: {
                  common_name: { type: 'string', maxLength: 100 },
                  scientific_name: { type: 'string', maxLength: 150 },
                  confidence: { type: 'number', minimum: 0, maximum: 100 },
                },
              },
            },
          },
          required: ['found', 'common_name'],
        },
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
  console.log('Gemini raw:', text);

  try {
    // Try direct parse first (Gemini should return valid JSON with responseMimeType)
    return JSON.parse(text);
  } catch (e) {
    // Fallback: try to extract JSON from markdown or text
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    } catch {
      console.error('Gemini JSON parse failed:', text);
      return null;
    }
  }
}

// ─── category detection ───────────────────────────────────────────────────────

async function detectCategory(b64, mediaType) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
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
            text: 'What does this image primarily show? Categories: fungus (mushrooms), tree (woody plants), plant (flowers/herbs/leaves), bird (any bird), rock (stones/minerals/crystals/gems), insect (any insect). Reply with the category name.',
          },
        ],
      }],
      generationConfig: {
        maxOutputTokens: 20,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['fungus', 'tree', 'plant', 'bird', 'rock', 'insect'] },
          },
          required: ['category'],
        },
      },
    }),
  });

  if (!res.ok) return 'plant';
  const out = await res.json();
  const text = out.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const result = JSON.parse(text);
    const valid = ['fungus', 'tree', 'plant', 'bird', 'rock', 'insect'];
    return valid.includes(result.category) ? result.category : 'plant';
  } catch {
    // Fallback to old parsing if JSON fails
    const category = text.trim().toLowerCase().split(/\s/)[0];
    const valid = ['fungus', 'tree', 'plant', 'bird', 'rock', 'insect'];
    return valid.includes(category) ? category : 'plant';
  }
}

// ─── identification prompts (Claude pour toutes les catégories) ───────────────

const PROMPTS = {
  plant: `Identifie cette plante avec précision. Réponds en JSON structuré.
- description: 1-2 phrases courtes (max 200 caractères)
- edibility_details: si comestible/toxique, sinon vide
- medicinal_uses: si pertinent, sinon vide
- anecdote: 1 fait intéressant court (max 150 caractères)
- habitat: où pousse-t-elle (max 100 caractères)
- ecological_role: rôle dans l'écosystème (pollinisation, fixation azote, abri faune, etc.) max 200 caractères
- biodiversity_importance: pourquoi cette espèce est importante pour la biodiversité (chaîne alimentaire, indicateur santé écosystème, etc.) max 200 caractères
- rarity: commune/peu_commune/rare/legendaire
Si ce n'est pas une plante, réponds {"found":false,"common_name":"Pas une plante","description":"Décris brièvement ce que tu vois"}`,

  tree: `Identifie cet arbre ou arbuste avec précision. Réponds en JSON structuré.
- description: 1-2 phrases courtes (max 200 caractères)
- edibility_details: si fruits comestibles, sinon vide
- medicinal_uses: si pertinent, sinon vide
- anecdote: 1 fait intéressant court (max 150 caractères)
- habitat: où pousse-t-il (max 100 caractères)
- ecological_role: rôle dans l'écosystème (habitat faune, stabilisation sols, production oxygène, etc.) max 200 caractères
- biodiversity_importance: pourquoi cet arbre est important pour la biodiversité (niche écologique, corridor biologique, etc.) max 200 caractères
- rarity: commune/peu_commune/rare/legendaire
Si ce n'est pas un arbre, réponds {"found":false,"common_name":"Pas un arbre","description":"Décris brièvement ce que tu vois"}`,

  fungus: `Identifie ce champignon avec précision. IMPORTANT: toujours préciser si comestible ou toxique.
- description: 1-2 phrases courtes (max 200 caractères)
- edibility_details: OBLIGATOIRE - comestible, toxique, mortel, ou non comestible
- anecdote: 1 fait intéressant court (max 150 caractères)
- habitat: où pousse-t-il (max 100 caractères)
- ecological_role: rôle dans l'écosystème (décomposition, symbiose mycorhizienne, etc.) max 200 caractères
- biodiversity_importance: pourquoi ce champignon est important pour la biodiversité (recyclage nutriments, santé des arbres, etc.) max 200 caractères
- rarity: commune/peu_commune/rare/legendaire
Si ce n'est pas un champignon, réponds {"found":false,"common_name":"Pas un champignon","description":"Décris brièvement ce que tu vois"}`,

  bird: `Identifie cet oiseau avec précision. Réponds en JSON structuré.
- description: 1-2 phrases courtes (max 200 caractères)
- habitat: où vit-il (max 100 caractères)
- ecological_role: rôle dans l'écosystème (régulation insectes, dispersion graines, prédation, etc.) max 200 caractères
- biodiversity_importance: pourquoi cet oiseau est important pour la biodiversité (contrôle ravageurs, indicateur santé environnement, etc.) max 200 caractères
- anecdote: 1 fait intéressant court (max 150 caractères)
- rarity: commune/peu_commune/rare/legendaire
Si ce n'est pas un oiseau, réponds {"found":false,"common_name":"Pas un oiseau","description":"Décris brièvement ce que tu vois"}`,

  insect: `Identifie cet insecte avec précision. Réponds en JSON structuré.
- description: 1-2 phrases courtes (max 200 caractères)
- habitat: où vit-il (max 100 caractères)
- ecological_role: rôle dans l'écosystème (pollinisation, décomposition, proie pour autres espèces, etc.) max 200 caractères
- biodiversity_importance: pourquoi cet insecte est important pour la biodiversité (maillon chaîne alimentaire, services écosystémiques, etc.) max 200 caractères
- anecdote: 1 fait intéressant court (max 150 caractères)
- rarity: commune/peu_commune/rare/legendaire
Si ce n'est pas un insecte, réponds {"found":false,"common_name":"Pas un insecte","description":"Décris brièvement ce que tu vois"}`,

  rock: `Identifie cette roche, minéral ou cristal avec précision. Réponds en JSON structuré.
- description: 1-2 phrases courtes (max 200 caractères)
- habitat: où trouve-t-on ce minéral (max 100 caractères)
- ecological_role: rôle géologique (formation sols, cycle minéraux, habitat micro-organismes, etc.) max 200 caractères
- biodiversity_importance: importance pour la biodiversité (fertilité sols, filtration eau, substrat pour vie, etc.) max 200 caractères
- anecdote: 1 fait intéressant court (max 150 caractères)
- rarity: commune/peu_commune/rare/legendaire
Si ce n'est pas une roche/minéral, réponds {"found":false,"common_name":"Pas un minéral","description":"Décris brièvement ce que tu vois"}`,
};

// ─── response normalization ───────────────────────────────────────────────────

function truncateSentences(text, maxSentences = 2, maxChars = 250) {
  if (!text) return '';
  const clean = text.trim();
  // Split by common sentence endings
  const sentences = clean.split(/(?<=[.!?])\s+/);
  let result = sentences.slice(0, maxSentences).join(' ');
  if (result.length > maxChars) {
    result = result.substring(0, maxChars).trim();
    // Cut at last sentence boundary if possible
    const lastPeriod = Math.max(result.lastIndexOf('.'), result.lastIndexOf('!'), result.lastIndexOf('?'));
    if (lastPeriod > maxChars * 0.7) {
      result = result.substring(0, lastPeriod + 1);
    } else {
      result += '...';
    }
  }
  return result;
}

function detectActualTypeFromDescription(description, commonName) {
  const text = ((description || '') + ' ' + (commonName || '')).toLowerCase();

  // Bird patterns
  if (text.match(/\b(oiseau|bird|avian|plumage|bec|aile|vol|feather|chant)/)) {
    return 'bird';
  }
  // Insect patterns
  if (text.match(/\b(insecte|insect|bug|beetle|fly|mouche|fourmi|abeille|papillon|coléoptère)/)) {
    return 'insect';
  }
  // Fungus patterns
  if (text.match(/\b(champignon|fungus|mushroom|mycète)/)) {
    return 'fungus';
  }
  // Rock/mineral patterns
  if (text.match(/\b(minéral|mineral|roche|rock|pierre|stone|crystal|cristal|gem|gemme)/)) {
    return 'rock';
  }
  // Tree patterns
  if (text.match(/\b(arbre|tree|woody|ligneux)/)) {
    return 'tree';
  }

  return null;
}

function generateNeutralTitle(description, detectedType) {
  const text = (description || '').toLowerCase();

  // Extract specific features from description
  if (detectedType === 'bird') {
    if (text.includes('trapu') || text.includes('stocky')) return 'Oiseau trapu';
    if (text.includes('long bec') || text.includes('long bill')) return 'Oiseau à long bec';
    if (text.includes('petit') || text.includes('small')) return 'Petit oiseau';
    if (text.includes('rapace') || text.includes('raptor')) return 'Rapace';
    return 'Oiseau observé';
  }

  if (detectedType === 'insect') {
    if (text.includes('beetle') || text.includes('coléoptère')) return 'Coléoptère';
    if (text.includes('fly') || text.includes('mouche')) return 'Diptère';
    if (text.includes('papillon') || text.includes('butterfly')) return 'Lépidoptère';
    return 'Insecte observé';
  }

  if (detectedType === 'fungus') {
    if (text.includes('chapeau') || text.includes('cap')) return 'Champignon à chapeau';
    if (text.includes('toxique') || text.includes('toxic')) return 'Champignon (toxicité incertaine)';
    return 'Champignon observé';
  }

  if (detectedType === 'rock') {
    if (text.includes('crystal') || text.includes('cristal')) return 'Cristal minéral';
    if (text.includes('quartz')) return 'Quartz';
    if (text.includes('calcaire') || text.includes('limestone')) return 'Roche calcaire';
    return 'Minéral observé';
  }

  if (detectedType === 'tree') {
    if (text.includes('conifer') || text.includes('conifère')) return 'Conifère';
    if (text.includes('feuillus') || text.includes('deciduous')) return 'Arbre feuillu';
    return 'Arbre observé';
  }

  return 'Spécimen observé';
}

function normalizeGeminiResponse(data, category) {
  if (!data) return null;

  // Check for negative/rejection responses
  const commonNameLower = (data.common_name || '').toLowerCase();
  const isNegative = commonNameLower.startsWith('pas un') ||
                     commonNameLower.startsWith('pas une') ||
                     commonNameLower.startsWith('not a') ||
                     data.found === false;

  let finalCommonName = data.common_name;
  let correctedCategory = category;

  if (isNegative) {
    // Detect actual type from description
    const detectedType = detectActualTypeFromDescription(data.description, data.common_name);

    if (detectedType) {
      correctedCategory = detectedType;
      finalCommonName = generateNeutralTitle(data.description, detectedType);
    } else {
      // No clear type detected, use generic title
      finalCommonName = 'Spécimen non identifié';
    }
  }

  // Ensure we have a valid common name
  if (!finalCommonName || finalCommonName.trim().length === 0) {
    finalCommonName = 'Spécimen observé';
  }

  // Truncate scientific name (max 80 chars, single line)
  let scientificName = (data.scientific_name || '').trim();
  if (scientificName.length > 80) {
    scientificName = scientificName.substring(0, 77) + '...';
  }
  // Remove line breaks
  scientificName = scientificName.replace(/[\n\r]+/g, ' ');

  // Truncate and clean text fields
  const description = truncateSentences(data.description, 2, 200);
  const edibilityDetails = truncateSentences(data.edibility_details, 2, 180);
  const medicinalUses = truncateSentences(data.medicinal_uses, 2, 180);
  const anecdote = truncateSentences(data.anecdote, 1, 150);
  const habitat = truncateSentences(data.habitat, 1, 120);
  const ecologicalRole = truncateSentences(data.ecological_role, 2, 200);
  const biodiversityImportance = truncateSentences(data.biodiversity_importance, 2, 200);
  const family = (data.family || '').trim().substring(0, 80);

  return {
    common_name: finalCommonName,
    scientific_name: scientificName || null,
    family: family || null,
    confidence: data.found === false ? Math.max((data.confidence || 70) - 10, 50) : (data.confidence || 70),
    rarity: data.rarity || 'commune',
    is_edible: data.is_edible ?? false,
    is_toxic: data.is_toxic ?? false,
    is_cannabis: data.is_cannabis ?? false,
    strain_type: data.strain_type || '',
    description: description || null,
    edibility_details: edibilityDetails || null,
    medicinal_uses: medicinalUses || null,
    anecdote: anecdote || null,
    habitat: habitat || null,
    ecological_role: ecologicalRole || null,
    biodiversity_importance: biodiversityImportance || null,
    correctedCategory: correctedCategory,
  };
}

function buildResult(data, category, profile) {
  if (!data || !data.common_name) return null;

  const normalized = normalizeGeminiResponse(data, category);
  if (!normalized) return null;

  return {
    top_result: {
      common_name: normalized.common_name,
      scientific_name: normalized.scientific_name || '',
      family: normalized.family || '',
      confidence: normalized.confidence,
      rarity: normalized.rarity,
      is_edible: normalized.is_edible,
      is_toxic: normalized.is_toxic,
      is_cannabis: normalized.is_cannabis,
      strain_type: normalized.strain_type,
      description: normalized.description || '',
      edibility_details: normalized.edibility_details || '',
      medicinal_uses: normalized.medicinal_uses || '',
      anecdote: normalized.anecdote || '',
      habitat: normalized.habitat || '',
      ecological_role: normalized.ecological_role || '',
      biodiversity_importance: normalized.biodiversity_importance || '',
    },
    alternatives: profile.is_pro ? (data.alternatives || []).slice(0, 2) : [],
    is_pro: profile.is_pro,
    daily_count: (profile.daily_identifications_count || 0) + 1,
    daily_limit: 5,
    correctedCategory: normalized.correctedCategory,
  };
}

// ─── main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  console.log('[identify-plant API] Request received:', {
    method: req.method,
    url: req.url,
    headers: Object.keys(req.headers),
    contentType: req.headers['content-type'],
    hasBody: !!req.body,
  });

  if (req.method !== 'POST') {
    console.log('[identify-plant API] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    console.log('[identify-plant API] No authorization token');
    return res.status(401).json({ error: 'Unauthorized' });
  }

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
    console.log('[identify-plant API] Body parsed:', {
      hasImageBase64: !!body.imageBase64,
      imageLength: body.imageBase64?.length,
      imageStart: body.imageBase64?.substring(0, 30),
      isAdminTest: body.isAdminTest,
    });
  } catch (err) {
    console.error('[identify-plant API] Body parse error:', err);
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { imageBase64, isAdminTest } = body;
  if (!imageBase64) {
    console.error('[identify-plant API] No image provided in body');
    return res.status(400).json({ error: 'No image provided' });
  }

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
  let category = await detectCategory(b64, mediaType);
  console.log(`[identify-plant] user=${user.email} initialCategory=${category}`);

  // Identify via Gemini
  let prompt = PROMPTS[category] || PROMPTS.plant;
  let data = await callGemini(b64, mediaType, prompt);

  // Smart retry: if response indicates wrong category, auto-detect and retry ONCE
  if (data && data.found === false && data.description) {
    const detectedType = detectActualTypeFromDescription(data.description, data.common_name);

    if (detectedType && detectedType !== category) {
      console.log(`[identify-plant] Category mismatch — initial: ${category}, detected: ${detectedType}. Retrying...`);
      category = detectedType;
      prompt = PROMPTS[category] || PROMPTS.plant;
      const retryData = await callGemini(b64, mediaType, prompt);

      // Use retry result if it's positive (found: true), otherwise keep original
      if (retryData && retryData.found !== false) {
        data = retryData;
        console.log(`[identify-plant] Retry succeeded with category=${category}`);
      } else {
        console.log(`[identify-plant] Retry also failed, using normalization fallback`);
      }
    }
  }

  const result = buildResult(data, category, profile);

  if (!result) {
    console.log('[identify-plant] NO_PLANT_FOUND — Gemini returned:', JSON.stringify(data));
    return res.json({ error: 'NO_PLANT_FOUND' });
  }

  // Use corrected category from normalization if available
  const finalCategory = result.correctedCategory || category;

  // Increment daily counter
  await supabase
    .from('user_profiles')
    .update({ daily_identifications_count: (profile.daily_identifications_count || 0) + 1 })
    .eq('user_email', user.email);

  return res.json({ ...result, category: finalCategory });
}
