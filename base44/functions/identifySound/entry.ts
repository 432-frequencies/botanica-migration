import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { audioBase64, mimeType, durationSeconds, latitude, longitude, soundType } = await req.json();

    if (!audioBase64) {
      return Response.json({ error: 'Audio data required' }, { status: 400 });
    }

    // Get user profile and check daily limit
    const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
    let profile = profiles[0];

    if (!profile) {
      profile = await base44.entities.UserProfile.create({
        user_email: user.email,
        is_pro: false,
        total_points: 0,
        total_plants: 0,
        daily_identifications_count: 0,
        daily_reset_date: new Date().toISOString().split('T')[0],
        rank: "Débutant",
        onboarding_completed: false
      });
    }

    const today = new Date().toISOString().split('T')[0];
    if (profile.daily_reset_date !== today) {
      await base44.entities.UserProfile.update(profile.id, {
        daily_identifications_count: 0,
        daily_reset_date: today
      });
      profile.daily_identifications_count = 0;
    }

    if (!profile.is_pro && profile.daily_identifications_count >= 3) {
      return Response.json({
        error: 'daily_limit_reached',
        message: 'Daily limit reached. Upgrade to Pro for unlimited identifications.'
      }, { status: 403 });
    }

    // Step 1: Identify category and species via LLM
    const isInsect = soundType === "insect";

    const insectPrompt = `Tu es un expert en acoustique entomologique. 
Analyse cet enregistrement audio ou spectrogramme.
Identifie l'insecte européen le plus probable selon :
- Pattern de stridulation (régulier/irrégulier, durée des impulsions)
- Fréquence dominante estimée
- Rythme (impulsions par seconde)
- Contexte habitat si mentionné

Retourne : common_name (français), scientific_name, family, 
confidence (0-100), rarity, description du chant, habitat, 
comportement acoustique, anecdote sur le chant de cette espèce.

Si non identifiable avec confiance > 30%, retourner found: false.`;

    const birdPrompt = `Analyze this audio recording (duration: ${durationSeconds}s) and identify:
1. Category: Is this a bird or an insect?
2. Species: What is the scientific name and common French name?
3. Sound type: For birds (chant/cri/alarme), for insects (stridulation/bourdonnement/crépitement)
4. Confidence level (0-1)
5. Brief description of the sound characteristics

Provide detailed analysis based on audio patterns, frequency, rhythm, and duration.`;

    const identification = await base44.integrations.Core.InvokeLLM({
      prompt: isInsect ? insectPrompt : birdPrompt,
      file_urls: [`data:${mimeType};base64,${audioBase64}`],
      response_json_schema: {
        type: "object",
        properties: {
          found: { type: "boolean" },
          category: { type: "string", enum: ["bird", "insect"] },
          scientific_name: { type: "string" },
          common_name_fr: { type: "string" },
          sound_type: { type: "string" },
          confidence: { type: "number" },
          description: { type: "string" },
          family: { type: "string" },
          rarity: { type: "string" },
          habitat: { type: "string" },
          behavior: { type: "string" },
          anecdote: { type: "string" }
        }
      }
    });

    if (identification.found === false) {
      return Response.json({ error: 'NO_SOUND_FOUND', message: 'Aucun insecte identifiable avec suffisamment de confiance.' });
    }

    if (isInsect && !identification.category) {
      identification.category = "insect";
    }

    let result = {
      category: identification.category || (isInsect ? "insect" : "bird"),
      common_name: identification.common_name_fr,
      scientific_name: identification.scientific_name,
      sound_type: identification.sound_type,
      confidence: identification.confidence,
      description: identification.description,
      family: identification.family,
      rarity: identification.rarity || "commune",
      habitat: identification.habitat,
      behavior: identification.behavior,
      anecdote: identification.anecdote,
      detection_method: "audio",
      is_edible: false,
      is_toxic: false
    };

    // Step 2: Validate and enrich based on category
    if (identification.category === "bird") {
      // Xeno-canto API validation
      try {
        const xenoUrl = `https://xeno-canto.org/api/2/recordings?query=${encodeURIComponent(identification.scientific_name)}`;
        const xenoRes = await fetch(xenoUrl);
        const xenoData = await xenoRes.json();

        if (xenoData.recordings && xenoData.recordings.length > 0) {
          const recording = xenoData.recordings[0];
          result.xeno_canto_id = recording.id;
          result.spectrogram_url = `https://xeno-canto.org/${recording.id}/spectrogram`;
          result.sound_type = recording.type || result.sound_type;
          result.photo_url = recording.sono?.small || null;
          result.habitat = `Habitat typical: ${recording.loc?.locality || 'Various locations'}`;
        }
      } catch (e) {
        console.log('Xeno-canto validation skipped:', e.message);
      }

      // Enrich with additional bird info
      const enrichPrompt = `Provide detailed information about this bird species: ${identification.scientific_name} (${identification.common_name_fr})
Include: family, habitat, behavior, fun anecdote in French.`;

      const enrichment = await base44.integrations.Core.InvokeLLM({
        prompt: enrichPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            family: { type: "string" },
            habitat: { type: "string" },
            behavior: { type: "string" },
            anecdote: { type: "string" }
          }
        }
      });

      result = { ...result, ...enrichment };

    } else if (identification.category === "insect") {
      // iNaturalist API validation
      try {
        const inatUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(identification.scientific_name)}&rank=species&iconic_taxa=Insecta`;
        const inatRes = await fetch(inatUrl);
        const inatData = await inatRes.json();

        if (inatData.results && inatData.results.length > 0) {
          const taxon = inatData.results[0];
          result.inaturalist_id = taxon.id;
          result.photo_url = taxon.default_photo?.medium_url || null;
          result.thumbnail_url = taxon.default_photo?.square_url || null;
        }
      } catch (e) {
        console.log('iNaturalist validation skipped:', e.message);
      }

      // Enrich with additional insect info
      const enrichPrompt = `Provide detailed information about this insect species: ${identification.scientific_name} (${identification.common_name_fr})
Include: family, habitat, behavior, fun anecdote in French.`;

      const enrichment = await base44.integrations.Core.InvokeLLM({
        prompt: enrichPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            family: { type: "string" },
            habitat: { type: "string" },
            behavior: { type: "string" },
            anecdote: { type: "string" }
          }
        }
      });

      result = { ...result, ...enrichment };
    }

    // Increment daily counter
    await base44.entities.UserProfile.update(profile.id, {
      daily_identifications_count: profile.daily_identifications_count + 1
    });

    return Response.json(result);

  } catch (error) {
    console.error('Sound identification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});