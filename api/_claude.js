/**
 * Claude API integration for species identification
 * Premium quality, better than Gemini for critical info (toxicity, descriptions)
 */

export async function callClaude(b64, mediaType, category, outputLanguage = 'fr') {
  const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  if (!CLAUDE_API_KEY) {
    console.log('Claude API key not found, falling back to Gemini');
    return null;
  }

  const PROMPTS = {
    plant: outputLanguage === 'en'
      ? `You are a field botanist. Identify this plant precisely.

Return COMPLETE information in structured JSON. CRITICAL: Never truncate descriptions mid-sentence. Always finish sentences properly.

Required fields:
- common_name: specific name, never generic like "observed plant"
- scientific_name: Latin binomial
- family: botanical family
- confidence: 0-100
- rarity: commune/peu_commune/rare/legendaire (use peu_commune for precise IDs, rare only for genuinely uncommon)
- is_edible: true only if reliably edible
- is_toxic: true if any toxicity/irritation known
- edibility_status: edible/toxic/non_edible/unknown
- description: 2-3 SHORT sentences (max 180 chars), visual details ONLY, NO trailing "..."
- habitat: WHERE it grows naturally - specific ecosystem (forest floor, limestone cliffs, wetlands, etc.) max 80 chars
- anecdote: ONE interesting fact (cultural use, historical note, adaptation) max 120 chars
- ecological_role: role in ecosystem (pollination, nitrogen fixation, erosion control) max 180 chars
- biodiversity_importance: why it matters (keystone species, food web, indicator species) max 180 chars
- edibility_details: if edible/toxic, details; else empty
- medicinal_uses: if relevant, else empty
- safety_notes: warning if uncertain
- alternatives: up to 2 other possibilities with confidence

CRITICAL RULES:
- NEVER end ANY field with "..." unless it's a genuine ellipsis in quoted text
- ALWAYS complete sentences naturally
- Habitat must be SPECIFIC location/ecosystem, not vague "where it grows"
- Anecdote must be a CONCRETE fact, not generic statement
- Keep text SHORT but COMPLETE`
      : `Tu es botaniste de terrain. Identifie cette plante avec précision.

Retourne des informations COMPLÈTES en JSON structuré. CRITIQUE: Ne tronque JAMAIS les descriptions en milieu de phrase. Finis toujours les phrases proprement.

Champs requis:
- common_name: nom précis, jamais générique comme "plante observée"
- scientific_name: binôme latin
- family: famille botanique
- confidence: 0-100
- rarity: commune/peu_commune/rare/legendaire (utilise peu_commune pour IDs précises, rare seulement si vraiment rare)
- is_edible: true uniquement si comestibilité fiable
- is_toxic: true si toxicité/irritation connue
- edibility_status: edible/toxic/non_edible/unknown
- description: 2-3 phrases COURTES (max 180 car), détails visuels UNIQUEMENT, JAMAIS de "..." final
- habitat: OÙ elle pousse naturellement - écosystème précis (sous-bois humide, falaises calcaires, prairies sèches, etc.) max 80 car
- anecdote: UN fait intéressant CONCRET (usage traditionnel, particularité, adaptation) max 120 car
- ecological_role: rôle écosystème (pollinisation, fixation azote, stabilisation sols) max 180 car
- biodiversity_importance: pourquoi importante (espèce clé, réseau alimentaire, indicateur) max 180 car
- edibility_details: si comestible/toxique, détails; sinon vide
- medicinal_uses: si pertinent, sinon vide
- safety_notes: prudence si incertain
- alternatives: jusqu'à 2 autres possibilités avec confiance

RÈGLES CRITIQUES:
- JAMAIS terminer un champ par "..." sauf si ellipse légitime dans citation
- TOUJOURS finir les phrases naturellement
- Habitat doit être LIEU/ÉCOSYSTÈME PRÉCIS, pas vague "où elle pousse"
- Anecdote doit être fait CONCRET, pas généralité
- Texte COURT mais COMPLET`,

    fungus: outputLanguage === 'en'
      ? `You are a mycologist. Identify this mushroom. CRITICAL: toxicity info is MANDATORY and MUST be accurate.

COMPLETE JSON required. NEVER truncate mid-sentence. ALWAYS finish properly.

Fields:
- common_name: specific name
- scientific_name: Latin name
- family: mycological family
- confidence: 0-100
- rarity: commune/peu_commune/rare/legendaire
- is_edible: true ONLY if ID is certain AND species is well-known edible
- is_toxic: true if ANY toxicity or dangerous lookalike exists
- edibility_status: edible/toxic/non_edible/unknown - MANDATORY, ACCURATE
- description: 2-3 SHORT sentences, NO "..."
- habitat: SPECIFIC (oak forests, conifer litter, dead birch, etc.) max 80 chars
- anecdote: CONCRETE fact (culinary use, historical poisoning, symbiosis) max 120 chars
- ecological_role: role (decomposition, mycorrhizae, wood decay) max 180 chars
- biodiversity_importance: why it matters (nutrient cycling, tree health) max 180 chars
- edibility_details: MANDATORY - state clearly: edible choice/toxic/deadly/inedible
- safety_notes: ALWAYS warn "Never eat without expert verification"

CRITICAL RULES FOR MUSHROOMS:
- Toxicity info is LIFE OR DEATH - be conservative
- If ANY doubt: is_toxic=true, edibility_status=unknown
- ALWAYS mention dangerous lookalikes if they exist
- Habitat must be SUBSTRATE-SPECIFIC (mycorrhizal with pine, on dead elm, etc.)
- NEVER end with "..."`
      : `Tu es mycologue. Identifie ce champignon. CRITIQUE: info toxicité OBLIGATOIRE et PRÉCISE.

JSON COMPLET requis. JAMAIS tronquer mid-phrase. TOUJOURS finir proprement.

Champs:
- common_name: nom précis
- scientific_name: nom latin
- family: famille mycologique
- confidence: 0-100
- rarity: commune/peu_commune/rare/legendaire
- is_edible: true UNIQUEMENT si ID certaine ET espèce notoirement comestible
- is_toxic: true si TOUTE toxicité ou sosie dangereux existe
- edibility_status: edible/toxic/non_edible/unknown - OBLIGATOIRE, PRÉCIS
- description: 2-3 phrases COURTES, PAS de "..."
- habitat: SPÉCIFIQUE (chênaies, litière conifères, bouleau mort, etc.) max 80 car
- anecdote: fait CONCRET (usage culinaire, intox historique, symbiose) max 120 car
- ecological_role: rôle (décomposition, mycorhizes, dégradation bois) max 180 car
- biodiversity_importance: pourquoi important (recyclage nutriments, santé arbres) max 180 car
- edibility_details: OBLIGATOIRE - déclare clairement: excellent comestible/toxique/mortel/non comestible
- safety_notes: TOUJOURS avertir "Ne jamais consommer sans vérification experte"

RÈGLES CRITIQUES CHAMPIGNONS:
- Info toxicité = VIE OU MORT - sois conservateur
- Si MOINDRE doute: is_toxic=true, edibility_status=unknown
- TOUJOURS mentionner sosies dangereux s'ils existent
- Habitat doit être SUBSTRAT PRÉCIS (mycorhizien du pin, sur orme mort, etc.)
- JAMAIS finir par "..."`,

    bird: outputLanguage === 'en'
      ? `You are an ornithologist. Identify this bird from plumage, shape, beak.

COMPLETE JSON. NO truncation. Finish all sentences.

Fields:
- common_name: species name, never "observed bird"
- scientific_name: Latin name
- family: bird family
- confidence: 0-100
- rarity: commune/peu_commune/rare/legendaire (peu_commune for most specific IDs)
- description: 2-3 SHORT sentences, plumage/features, NO "..."
- habitat: SPECIFIC (urban parks, conifer forests, rocky coasts, etc.) max 80 chars
- anecdote: CONCRETE (migration distance, song pattern, nesting quirk) max 120 chars
- ecological_role: role (insect control, seed dispersal, scavenging) max 180 chars
- biodiversity_importance: why important (pest control, pollination, indicator) max 180 chars

NEVER end with "...". Habitat must be PRECISE location type.`
      : `Tu es ornithologue. Identifie cet oiseau par plumage, silhouette, bec.

JSON COMPLET. PAS de troncature. Finis toutes les phrases.

Champs:
- common_name: nom d'espèce, jamais "oiseau observé"
- scientific_name: nom latin
- family: famille d'oiseaux
- confidence: 0-100
- rarity: commune/peu_commune/rare/legendaire (peu_commune pour IDs spécifiques)
- description: 2-3 phrases COURTES, plumage/traits, PAS de "..."
- habitat: SPÉCIFIQUE (parcs urbains, forêts conifères, côtes rocheuses, etc.) max 80 car
- anecdote: CONCRET (distance migration, chant particulier, nidification) max 120 car
- ecological_role: rôle (contrôle insectes, dispersion graines, charognage) max 180 car
- biodiversity_importance: pourquoi important (contrôle ravageurs, pollinisation, indicateur) max 180 car

JAMAIS finir par "...". Habitat doit être TYPE DE LIEU PRÉCIS.`,

    insect: outputLanguage === 'en'
      ? `You are an entomologist. Identify this insect.

COMPLETE JSON. NO "..." endings.

Fields:
- common_name: species/family, never "observed insect"
- scientific_name: Latin name
- family: insect family
- confidence: 0-100
- rarity: commune/peu_commune/rare/legendaire
- is_toxic: true if stings, bites, irritates, urticating hairs
- edibility_status: "toxic" if risk, else "unknown"
- safety_notes: if risky, what to do if stung/bitten (one clear sentence)
- description: 2-3 SHORT sentences, NO "..."
- habitat: SPECIFIC (meadows, dead wood, aquatic larvae, etc.) max 80 chars
- anecdote: CONCRETE (metamorphosis detail, role in pollination, speed) max 120 chars
- ecological_role: role (pollination, decomposition, prey) max 180 chars
- biodiversity_importance: why important (food web, ecosystem services) max 180 chars

Habitat must be PRECISE microhabitat.`
      : `Tu es entomologiste. Identifie cet insecte.

JSON COMPLET. PAS de "..." finaux.

Champs:
- common_name: espèce/famille, jamais "insecte observé"
- scientific_name: nom latin
- family: famille d'insectes
- confidence: 0-100
- rarity: commune/peu_commune/rare/legendaire
- is_toxic: true si pique, mord, irrite, poils urticants
- edibility_status: "toxic" si risque, sinon "unknown"
- safety_notes: si risque, quoi faire si piqûre/morsure (une phrase claire)
- description: 2-3 phrases COURTES, PAS "..."
- habitat: SPÉCIFIQUE (prairies, bois mort, larve aquatique, etc.) max 80 car
- anecdote: CONCRET (détail métamorphose, rôle pollinisation, vitesse) max 120 car
- ecological_role: rôle (pollinisation, décomposition, proie) max 180 car
- biodiversity_importance: pourquoi important (chaîne alimentaire, services écosystème) max 180 car

Habitat doit être MICROHABITAT PRÉCIS.`,
  };

  const prompt = PROMPTS[category] || PROMPTS.plant;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: b64,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', response.status, err);
      return null;
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    console.log('Claude raw response:', text);

    // Parse JSON from response
    try {
      // Try direct parse first
      return JSON.parse(text);
    } catch (e) {
      // Try extracting JSON from markdown code blocks
      const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
      if (match) {
        const jsonStr = match[1] || match[0];
        return JSON.parse(jsonStr);
      }
      console.error('Claude JSON parse failed:', text);
      return null;
    }
  } catch (error) {
    console.error('Claude API call failed:', error);
    return null;
  }
}
