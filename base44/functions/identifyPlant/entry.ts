import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { imageBase64, isAdminTest } = await req.json();
    console.log('[identifyPlant] imageBase64 length:', imageBase64?.length || 0, '| user:', user.email);
    if (!imageBase64) {
      console.error('[identifyPlant] No image provided');
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }
    if (imageBase64.length > 2000000) {
      console.warn('[identifyPlant] WARNING: image is very large:', imageBase64.length, 'chars ~', Math.round(imageBase64.length * 0.75 / 1024), 'KB');
    }
    // Toujours construire un data URI valide pour file_urls (l'intégration LLM en a besoin)
    const imageDataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;

    // Admin test mode: bypass anti-cheat and daily limit checks
    if (isAdminTest) {
      if (user.role !== 'admin' && user.email !== 'energynrj6@gmail.com') {
        return Response.json({ error: 'Admin access required for isAdminTest' }, { status: 403 });
      }
      console.log('[AdminTest] Bypassing anti-cheat and daily limit checks');
    } else {
      // --- Anti-triche : Vérification de l'authenticité de l'image ---
      const authenticityCheck = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Analyse cette image et détecte si elle semble être :
- Une photo d'écran (screenshot) ou photo d'un écran d'ordinateur/téléphone
- Une photo d'une photo (image dans un livre, magazine, poster)
- Une image générée par IA ou retouchée numériquement
- Une illustration ou dessin

Si c'est une vraie photo prise dans la nature/réalité, réponds is_authentic: true.
Réponds UNIQUEMENT avec JSON: {"is_authentic": true/false, "reason": "..."}`,
        file_urls: [imageDataUri],
        response_json_schema: {
          type: "object",
          properties: {
            is_authentic: { type: "boolean" },
            reason: { type: "string" }
          },
          required: ["is_authentic", "reason"]
        }
      });

      if (!authenticityCheck?.is_authentic) {
        console.warn('Anti-cheat blocked:', authenticityCheck?.reason);
        return Response.json({ error: 'FAKE_IMAGE', reason: authenticityCheck?.reason || 'Photo non valide' }, { status: 200 });
      }
    }

    // Get or create user profile
    let profiles = await base44.asServiceRole.entities.UserProfile.filter({ user_email: user.email });
    let profile = profiles[0];
    const today = new Date().toISOString().split('T')[0];

    if (!profile) {
      profile = await base44.asServiceRole.entities.UserProfile.create({
        user_email: user.email,
        is_pro: false,
        total_points: 0,
        total_plants: 0,
        daily_identifications_count: 0,
        daily_reset_date: today,
        rank: 'Débutant',
        onboarding_completed: false
      });
    }

    if (!isAdminTest) {
      if (profile.daily_reset_date !== today) {
        await base44.asServiceRole.entities.UserProfile.update(profile.id, {
          daily_identifications_count: 0,
          daily_reset_date: today
        });
        profile.daily_identifications_count = 0;
      }

      if (!profile.is_pro && profile.daily_identifications_count >= 5) {
        return Response.json({ error: 'LIMIT_REACHED' }, { status: 429 });
      }
    }

    // --- Step 1: Detect category via LLM ---
    const categoryResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Look at this image and determine what it primarily shows. Choose the MOST specific category:
- "fungus": mushrooms, toadstools, fungi, any fungal specimen
- "tree": trees (oak, pine, beech, chestnut...), shrubs, woody plants
- "plant": flowers, herbs, ferns, moss, grass, non-woody vegetation
- "bird": any bird species, flying or perched
- "rock": mineral, stone, crystal, geological specimen
- "insect": any insect (butterfly, beetle, ant, bee, dragonfly, etc.)

Respond with ONLY one of these exact words: fungus, tree, plant, bird, rock, insect
If you cannot determine, respond: plant`,
      file_urls: [imageDataUri],
      response_json_schema: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["plant", "bird", "rock", "fungus", "tree", "insect"] }
        }
      }
    });

    const category = categoryResult?.category || 'plant';

    // --- Step 2: Identify the specimen ---
    let result;

    if (category === 'fungus') {
      result = await identifyFungus(imageBase64, profile, base44);
    } else if (category === 'tree') {
      result = await identifyTree(imageBase64, profile, base44);
    } else if (category === 'plant') {
      result = await identifyPlant(imageBase64, profile, base44);
    } else if (category === 'bird') {
      result = await identifyBird(imageBase64, profile, base44);
    } else if (category === 'insect') {
      result = await identifyInsect(imageBase64, profile, base44);
    } else {
      result = await identifyRock(imageBase64, profile, base44);
    }

    if (!result) {
      return Response.json({ error: 'NO_PLANT_FOUND' }, { status: 200 });
    }

    // Increment daily counter
    await base44.asServiceRole.entities.UserProfile.update(profile.id, {
      daily_identifications_count: (profile.daily_identifications_count || 0) + 1
    });

    return Response.json({ ...result, category });

  } catch (error) {
    console.error('[identifyPlant] CRASH:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ---- PLANT identification (Plant.id API) ----
async function identifyPlant(imageBase64, profile, base44) {
  // Plant.id attend du base64 pur (sans préfixe)
  const b64 = imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64;
  const apiKey = Deno.env.get('PLANTID_API_KEY');
  const resp = await fetch('https://plant.id/api/v3/identification', {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: [b64],
      similar_images: false,
      classification_level: 'species',
      details: ['common_names', 'taxonomy', 'description', 'edibility', 'toxicity', 'common_uses', 'cultural_significance'],
      language: 'en'
    })
  });

  if (!resp.ok) {
    console.error('Plant.id error:', await resp.text());
    return null;
  }

  const data = await resp.json();
  const suggestions = data.result?.classification?.suggestions || [];
  if (!suggestions.length) return null;

  const top = suggestions[0];
  const details = top.details || {};
  const confidence = top.probability || 0;

  let rarity = 'commune';
  if (confidence > 0.8) rarity = 'commune';
  else if (confidence > 0.6) rarity = 'peu_commune';
  else if (confidence > 0.4) rarity = 'rare';
  else rarity = 'legendaire';

  const edibilityText = (details.edibility || '').toLowerCase();
  const toxicityText = (details.toxicity || '').toLowerCase();
  const is_edible = edibilityText.includes('edible') || edibilityText.includes('comestible');
  const is_toxic = toxicityText.includes('toxic') || toxicityText.includes('poison') || toxicityText.includes('dangereux');

  // Detect cannabis strains via LLM
  const scientificName = (top.name || '').toLowerCase();
  const commonName = (details.common_names?.[0] || '').toLowerCase();
  const isCannabisGenus = scientificName.includes('cannabis');
  let is_cannabis = false;
  let strain_type = '';

  if (isCannabisGenus || commonName.includes('cannabis') || commonName.includes('marijuana') || commonName.includes('hemp') || commonName.includes('weed')) {
    is_cannabis = true;
    // Ask LLM to determine strain type
    const strainData = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `This image shows a cannabis plant (${top.name || 'Cannabis sp.'}). Determine the strain type.
- "sativa": tall, narrow leaves, energizing, longer flowering
- "indica": short, wide leaves, relaxing, compact
- "hybrid": mix of both, most modern strains
- "autoflowering": flowers based on age, not light cycle
Respond with only one of: sativa, indica, hybrid, autoflowering`,
      file_urls: [imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`],
      response_json_schema: {
        type: "object",
        properties: {
          strain_type: { type: "string", enum: ["sativa", "indica", "hybrid", "autoflowering"] }
        }
      }
    });
    strain_type = strainData?.strain_type || 'hybrid';
  }

  return {
    top_result: {
      common_name: (details.common_names?.[0]) || top.name,
      scientific_name: top.name,
      family: details.taxonomy?.family || '',
      confidence: Math.round(confidence * 100),
      rarity,
      is_edible,
      is_toxic,
      is_cannabis,
      strain_type,
      description: details.description?.value || '',
      edibility_details: details.edibility || '',
      medicinal_uses: details.common_uses || '',
      anecdote: details.cultural_significance?.value || '',
      habitat: '',
      behavior: ''
    },
    alternatives: profile.is_pro
      ? suggestions.slice(1, 3).map(s => ({
          common_name: s.details?.common_names?.[0] || s.name,
          scientific_name: s.name,
          confidence: Math.round((s.probability || 0) * 100)
        }))
      : [],
    is_pro: profile.is_pro,
    daily_count: (profile.daily_identifications_count || 0) + 1,
    daily_limit: 5
  };
}

// ---- FUNGUS identification (LLM) ----
async function identifyFungus(imageBase64, profile, base44) {
  const imageDataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
  const data = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Tu es un expert mycologue. Identifie le champignon ou le fungi dans cette image et fournis des informations détaillées.
Détermine la rareté :
- "commune": très commun (Boletus edulis, Cantharellus, Amanita muscaria)
- "peu_commune": assez commun mais régional
- "rare": difficile à trouver, saisonnier ou local
- "legendaire": extrêmement rare, protégé ou spécimen exceptionnel

IMPORTANT : Précise toujours clairement s'il est comestible ou toxique. Réponds en français.`,
    file_urls: [imageDataUri],
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        found: { type: "boolean" },
        common_name: { type: "string" },
        scientific_name: { type: "string" },
        family: { type: "string" },
        confidence: { type: "number", description: "0-100" },
        rarity: { type: "string", enum: ["commune", "peu_commune", "rare", "legendaire"] },
        is_edible: { type: "boolean" },
        is_toxic: { type: "boolean" },
        description: { type: "string" },
        habitat: { type: "string", description: "Saison et environnement où il pousse" },
        edibility_details: { type: "string", description: "Détails sur la comestibilité ou la toxicité" },
        anecdote: { type: "string", description: "Fait mycologique intéressant" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              common_name: { type: "string" },
              scientific_name: { type: "string" },
              confidence: { type: "number" }
            }
          }
        }
      }
    }
  });

  if (!data?.found || !data?.common_name) return null;

  return {
    top_result: {
      common_name: data.common_name,
      scientific_name: data.scientific_name || '',
      family: data.family || '',
      confidence: data.confidence || 70,
      rarity: data.rarity || 'commune',
      is_edible: data.is_edible || false,
      is_toxic: data.is_toxic || false,
      description: data.description || '',
      edibility_details: data.edibility_details || '',
      medicinal_uses: '',
      anecdote: data.anecdote || '',
      habitat: data.habitat || '',
      behavior: ''
    },
    alternatives: profile.is_pro ? (data.alternatives || []).slice(0, 2) : [],
    is_pro: profile.is_pro,
    daily_count: (profile.daily_identifications_count || 0) + 1,
    daily_limit: 5
  };
}

// ---- TREE identification (LLM via Plant.id) ----
async function identifyTree(imageBase64, profile, base44) {
  const b64 = imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64;
  const apiKey = Deno.env.get('PLANTID_API_KEY');
  const resp = await fetch('https://plant.id/api/v3/identification', {
    method: 'POST',
    headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      images: [b64],
      similar_images: false,
      classification_level: 'species',
      details: ['common_names', 'taxonomy', 'description', 'edibility', 'common_uses', 'cultural_significance'],
      language: 'en'
    })
  });

  if (!resp.ok) {
    console.error('Plant.id tree error:', await resp.text());
    return null;
  }

  const data = await resp.json();
  const suggestions = data.result?.classification?.suggestions || [];
  if (!suggestions.length) return null;

  const top = suggestions[0];
  const details = top.details || {};
  const confidence = top.probability || 0;

  let rarity = 'commune';
  if (confidence > 0.8) rarity = 'commune';
  else if (confidence > 0.6) rarity = 'peu_commune';
  else if (confidence > 0.4) rarity = 'rare';
  else rarity = 'legendaire';

  return {
    top_result: {
      common_name: details.common_names?.[0] || top.name,
      scientific_name: top.name,
      family: details.taxonomy?.family || '',
      confidence: Math.round(confidence * 100),
      rarity,
      is_edible: false,
      is_toxic: false,
      description: details.description?.value || '',
      edibility_details: details.edibility || '',
      medicinal_uses: details.common_uses || '',
      anecdote: details.cultural_significance?.value || '',
      habitat: '',
      behavior: ''
    },
    alternatives: profile.is_pro
      ? suggestions.slice(1, 3).map(s => ({
          common_name: s.details?.common_names?.[0] || s.name,
          scientific_name: s.name,
          confidence: Math.round((s.probability || 0) * 100)
        }))
      : [],
    is_pro: profile.is_pro,
    daily_count: (profile.daily_identifications_count || 0) + 1,
    daily_limit: 5
  };
}

// ---- BIRD identification (LLM) ----
async function identifyBird(imageBase64, profile, base44) {
  const imageDataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
  const data = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Tu es un expert ornithologue. Identifie l'oiseau dans cette image et fournis des informations détaillées.
Détermine la rareté selon la fréquence à laquelle l'espèce est observée par les ornithologues :
- "commune": très commun, observé quotidiennement (moineaux, pigeons, merles)
- "peu_commune": assez commun mais pas partout (pics, martins-pêcheurs)
- "rare": difficile à observer, régional ou migrateur
- "legendaire": extrêmement rare, en danger ou observation exceptionnelle

Réponds avec des informations précises et factuelles en français.`,
    file_urls: [imageDataUri],
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        found: { type: "boolean" },
        common_name: { type: "string" },
        scientific_name: { type: "string" },
        family: { type: "string" },
        confidence: { type: "number", description: "0-100" },
        rarity: { type: "string", enum: ["commune", "peu_commune", "rare", "legendaire"] },
        description: { type: "string", description: "2-3 phrases sur l'oiseau" },
        habitat: { type: "string", description: "Où il vit" },
        behavior: { type: "string", description: "Régime alimentaire, migration, habitudes de nidification" },
        anecdote: { type: "string", description: "Fait intéressant ou signification culturelle" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              common_name: { type: "string" },
              scientific_name: { type: "string" },
              confidence: { type: "number" }
            }
          }
        }
      }
    }
  });

  if (!data?.found || !data?.common_name) return null;

  return {
    top_result: {
      common_name: data.common_name,
      scientific_name: data.scientific_name || '',
      family: data.family || '',
      confidence: data.confidence || 70,
      rarity: data.rarity || 'commune',
      is_edible: false,
      is_toxic: false,
      description: data.description || '',
      edibility_details: '',
      medicinal_uses: '',
      anecdote: data.anecdote || '',
      habitat: data.habitat || '',
      behavior: data.behavior || ''
    },
    alternatives: profile.is_pro ? (data.alternatives || []).slice(0, 2) : [],
    is_pro: profile.is_pro,
    daily_count: (profile.daily_identifications_count || 0) + 1,
    daily_limit: 5
  };
}

// ---- INSECT identification (iNaturalist + LLM) ----
async function identifyInsect(imageBase64, profile, base44) {
  const imageDataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
  const data = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Tu es un expert entomologiste. Identifie l'insecte dans cette image et fournis des informations détaillées.
Détermine la rareté selon la fréquence à laquelle l'espèce est observée :
- "commune": très commun, observé régulièrement (fourmis, mouches, abeilles)
- "peu_commune": assez commun mais régional
- "rare": difficile à observer, régional ou saisonnier
- "legendaire": extrêmement rare, en danger ou observation exceptionnelle

Réponds avec des informations précises et factuelles en français.`,
    file_urls: [imageDataUri],
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        found: { type: "boolean" },
        common_name: { type: "string" },
        scientific_name: { type: "string" },
        family: { type: "string" },
        confidence: { type: "number", description: "0-100" },
        rarity: { type: "string", enum: ["commune", "peu_commune", "rare", "legendaire"] },
        description: { type: "string", description: "2-3 phrases sur l'insecte" },
        habitat: { type: "string", description: "Où il vit" },
        behavior: { type: "string", description: "Régime alimentaire, cycle de vie, habitudes" },
        anecdote: { type: "string", description: "Fait intéressant ou signification écologique" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              common_name: { type: "string" },
              scientific_name: { type: "string" },
              confidence: { type: "number" }
            }
          }
        }
      }
    }
  });

  if (!data?.found || !data?.common_name) return null;

  // Validate with iNaturalist
  let photo_url = null;
  try {
    const inatUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(data.scientific_name)}&rank=species&iconic_taxa=Insecta`;
    const inatRes = await fetch(inatUrl);
    const inatData = await inatRes.json();
    if (inatData.results && inatData.results.length > 0) {
      const taxon = inatData.results[0];
      photo_url = taxon.default_photo?.medium_url || null;
    }
  } catch (e) {
    console.log('iNaturalist validation skipped:', e.message);
  }

  return {
    top_result: {
      common_name: data.common_name,
      scientific_name: data.scientific_name || '',
      family: data.family || '',
      confidence: data.confidence || 70,
      rarity: data.rarity || 'commune',
      is_edible: false,
      is_toxic: false,
      description: data.description || '',
      edibility_details: '',
      medicinal_uses: '',
      anecdote: data.anecdote || '',
      habitat: data.habitat || '',
      behavior: data.behavior || '',
      photo_url: photo_url || ''
    },
    alternatives: profile.is_pro ? (data.alternatives || []).slice(0, 2) : [],
    is_pro: profile.is_pro,
    daily_count: (profile.daily_identifications_count || 0) + 1,
    daily_limit: 5
  };
}

// ---- ROCK identification (LLM) ----
async function identifyRock(imageBase64, profile, base44) {
  const imageDataUri = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
  const data = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Tu es un expert géologue et minéralogiste. Identifie la roche, le minéral ou le cristal dans cette image.
Détermine la rareté selon la fréquence à laquelle le spécimen est trouvé :
- "commune": roches très communes (granite, calcaire, quartz, grès)
- "peu_commune": moins communes mais trouvables (basalte, obsidie nne, marbre)
- "rare": minéraux rares ou pierres précieuses
- "legendaire": minéraux extrêmement rares, cristaux de qualité gemme, météorites

Réponds avec des informations précises et factuelles en français.`,
    file_urls: [imageDataUri],
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        found: { type: "boolean" },
        common_name: { type: "string" },
        scientific_name: { type: "string", description: "Formule chimique ou classification minérale" },
        family: { type: "string", description: "Type de roche : ignée, sédimentaire, métamorphique ou groupe minéral" },
        confidence: { type: "number", description: "0-100" },
        rarity: { type: "string", enum: ["commune", "peu_commune", "rare", "legendaire"] },
        description: { type: "string", description: "2-3 phrases sur la roche ou le minéral" },
        habitat: { type: "string", description: "Où on le trouve typiquement sur le plan géologique" },
        behavior: { type: "string", description: "Processus de formation, dureté, utilisations" },
        anecdote: { type: "string", description: "Fait historique ou scientifique intéressant" },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              common_name: { type: "string" },
              scientific_name: { type: "string" },
              confidence: { type: "number" }
            }
          }
        }
      }
    }
  });

  if (!data?.found || !data?.common_name) return null;

  return {
    top_result: {
      common_name: data.common_name,
      scientific_name: data.scientific_name || '',
      family: data.family || '',
      confidence: data.confidence || 70,
      rarity: data.rarity || 'commune',
      is_edible: false,
      is_toxic: false,
      description: data.description || '',
      edibility_details: '',
      medicinal_uses: '',
      anecdote: data.anecdote || '',
      habitat: data.habitat || '',
      behavior: data.behavior || ''
    },
    alternatives: profile.is_pro ? (data.alternatives || []).slice(0, 2) : [],
    is_pro: profile.is_pro,
    daily_count: (profile.daily_identifications_count || 0) + 1,
    daily_limit: 5
  };
}