import { createClient } from '@supabase/supabase-js';
import { getDailyScanLimit, hasLaunchAccess } from '../src/lib/app-config.js';
import { resolveDisplayName } from '../src/lib/displayName.js';
import { inferCategoryFromText, normalizeSpeciesCategory } from '../src/lib/species.js';
import { refreshPremiumStatusForUser } from './_premium.js';
import { callClaude } from './_claude.js';

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

function normalizeOutputLanguage(value) {
  return String(value || '').slice(0, 2).toLowerCase() === 'en' ? 'en' : 'fr';
}

function getOutputLanguageInstruction(outputLanguage) {
  return outputLanguage === 'en'
    ? `Output language: English.
Write every user-facing text field in natural, concise English: common_name when an English common name exists, description, habitat, ecological_role, biodiversity_importance, edibility_details, medicinal_uses, safety_notes, anecdote, sound_type and behavior.
Keep enum values exactly as specified in the schema.`
    : `Langue de sortie: français.
Rédige tous les champs affichés à l'utilisateur en français naturel et concis.
Garde les valeurs enum exactement comme demandé dans le schéma.`;
}

function withOutputLanguage(prompt, outputLanguage) {
  return `${getOutputLanguageInstruction(outputLanguage)}

${prompt}`;
}

async function callGemini(b64, mediaType, prompt, maxTokens = 4096) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
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
              edibility_status: { type: 'string', enum: ['edible', 'toxic', 'non_edible', 'unknown'] },
              is_cannabis: { type: 'boolean' },
              description: { type: 'string', maxLength: 800 },
              edibility_details: { type: 'string', maxLength: 600 },
              safety_notes: { type: 'string', maxLength: 500 },
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
      console.error('Gemini error:', res.status, err);
      if ((res.status === 429 || res.status === 503) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
        continue;
      }
      return null;
    }

    const out = await res.json();
    const text = out.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini raw:', text);

    try {
      return JSON.parse(text);
    } catch (e) {
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

  return null;
}

async function callGeminiUniversal(b64, mediaType, outputLanguage = 'fr') {
  for (let attempt = 0; attempt < 3; attempt += 1) {
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
              text: withOutputLanguage(`Tu es un naturaliste de terrain. Identifie le sujet principal de cette photo parmi ces catégories: tree, plant, bird, fungus, rock, insect, arachnid.

Objectif:
- donner d'abord la meilleure hypothèse d'espèce ou de taxon visible
- éviter les libellés génériques comme "oiseau observé", "insecte observé", "spécimen observé" sauf si c'est vraiment impossible
- si tu reconnais une espèce probable à partir du plumage, des couleurs, de la silhouette, du bec, des feuilles, de l'écorce ou du port, donne ce nom

Réponds UNIQUEMENT avec un objet JSON brut, sans markdown.

Format attendu:
{
  "found": true,
  "category": "bird",
  "common_name": "Martin-pêcheur",
  "scientific_name": "Alcedo atthis",
  "family": "Alcedinidae",
  "confidence": 84,
  "rarity": "commune",
  "is_edible": false,
  "is_toxic": false,
  "edibility_status": "unknown",
  "edibility_details": "",
  "safety_notes": "Information indicative — ne pas consommer sans vérification experte.",
  "description": "Court résumé visuel précis",
  "habitat": "Habitat court",
  "ecological_role": "Rôle écologique court",
  "biodiversity_importance": "Importance biodiversité courte",
  "anecdote": "Fait bref",
  "alternatives": [
    { "common_name": "Autre hypothèse", "scientific_name": "Nom latin", "confidence": 58 }
  ]
}

Règles:
- found=true si un sujet principal identifiable est visible
- category doit être une des 7 catégories autorisées
- common_name ne doit jamais être vide
- si l'espèce exacte est incertaine, donne le taxon le plus précis plausible
- confidence de 0 à 100
- alternatives jusqu'à 2 hypothèses
- pour plantes, arbres et champignons: renseigner is_edible, is_toxic, edibility_status et edibility_details seulement si l'information est fiable
- pour araignées/arachnides et insectes à risque: is_toxic=true si venin, piqûre, morsure ou poils urticants peuvent poser un risque; edibility_status="toxic"; safety_notes doit dire quoi faire en cas de morsure/piqûre
- si la comestibilité/toxicité est incertaine: is_edible=false, is_toxic=false, edibility_status="unknown"
- ne jamais affirmer qu'une espèce est comestible si l'identification ou la partie consommable est incertaine
- rarity: sois plus généreux que strict. "commune" seulement pour espèces très banales/omniprésentes; "peu_commune" pour taxons précis, discrets, localisés ou moins souvent observés; "rare" pour espèces réellement peu fréquentes, protégées, menacées ou difficiles à voir; "legendaire" uniquement exceptionnel.

Si la photo est vraiment inexploitable, réponds:
{"found":false,"category":"plant","common_name":"Spécimen non identifié","confidence":25,"is_edible":false,"is_toxic":false,"edibility_status":"unknown","description":"Le sujet principal n'est pas assez net pour être identifié."}`, outputLanguage),
            },
          ],
        }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.2,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Gemini universal error:', res.status, err);
      if ((res.status === 429 || res.status === 503) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
        continue;
      }
      return null;
    }

    const out = await res.json();
    const text = out.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('Gemini universal raw:', text);

    try {
      return JSON.parse(text);
    } catch (e) {
      try {
        const clean = text.replace(/```json|```/g, '').trim();
        const match = clean.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
      } catch {
        console.error('Gemini universal JSON parse failed:', text);
        return null;
      }
    }
  }

  return null;
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
            text: 'What does this image primarily show? Categories: fungus (mushrooms), tree (woody plants), plant (flowers/herbs/leaves), bird (any bird), rock (stones/minerals/crystals/gems), insect (true insects), arachnid (spiders and relatives). Reply with the category name.',
          },
        ],
      }],
      generationConfig: {
        maxOutputTokens: 20,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: ['fungus', 'tree', 'plant', 'bird', 'rock', 'insect', 'arachnid'] },
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
    const valid = ['fungus', 'tree', 'plant', 'bird', 'rock', 'insect', 'arachnid'];
    return valid.includes(result.category) ? result.category : 'plant';
  } catch {
    // Fallback to old parsing if JSON fails
    const category = text.trim().toLowerCase().split(/\s/)[0];
    const valid = ['fungus', 'tree', 'plant', 'bird', 'rock', 'insect', 'arachnid'];
    return valid.includes(category) ? category : 'plant';
  }
}

// ─── identification prompts (Claude pour toutes les catégories) ───────────────

const PROMPTS = {
  plant: `Identifie cette plante. JSON UNIQUEMENT, AUCUN MARKDOWN.

STRUCTURE EXACTE REQUISE (NE PAS TRONQUER):
{
  "found": true,
  "common_name": "Nom commun précis",
  "scientific_name": "Nom latin",
  "family": "Famille",
  "confidence": 75,
  "is_edible": false,
  "is_toxic": false,
  "edibility_status": "unknown",
  "safety_notes": "Texte complet sans ... (max 100 char)",
  "description": "Phrase complète descriptive (max 180 char)",
  "habitat": "Habitat naturel précis et complet (ex: forêts humides de feuillus, 300-1500m alt) max 120 char",
  "fun_fact": "Fait concret et intéressant sans ... (max 140 char)",
  "edibility_details": "",
  "medicinal_uses": "",
  "ecological_role": "Phrase complète sur le rôle (max 180 char)",
  "biodiversity_importance": "Phrase complète sur l'importance (max 180 char)",
  "rarity": "peu_commune"
}

RÈGLES CRITIQUES:
- TOUTES les phrases doivent être COMPLÈTES, PAS de "..." à la fin
- habitat: SPÉCIFIQUE (région, altitude, type de sol) pas générique
- fun_fact: CONCRET et UNIQUE à cette espèce
- Si pas plante: {"found":false,"common_name":"Pas une plante","description":"..."}`,

  tree: `Identifie cet arbre ou arbuste avec précision. Réponds en JSON structuré.
- is_edible: true uniquement si les fruits/parties visibles sont comestibles de façon fiable
- is_toxic: true si une partie notable est toxique ou dangereuse
- edibility_status: edible/toxic/non_edible/unknown
- safety_notes: courte prudence si comestibilité ou toxicité non vérifiée
- description: 1-2 phrases courtes (max 200 caractères)
- edibility_details: si fruits comestibles, sinon vide
- medicinal_uses: si pertinent, sinon vide
- anecdote: 1 fait intéressant court (max 150 caractères)
- habitat: où pousse-t-il (max 100 caractères)
- ecological_role: rôle dans l'écosystème (habitat faune, stabilisation sols, production oxygène, etc.) max 200 caractères
- biodiversity_importance: pourquoi cet arbre est important pour la biodiversité (niche écologique, corridor biologique, etc.) max 200 caractères
- rarity: commune/peu_commune/rare/legendaire. Ne mets "commune" que si l'espèce est très banale; utilise "peu_commune" pour une identification précise, distinctive ou moins souvent observée.
Si ce n'est pas un arbre, réponds {"found":false,"common_name":"Pas un arbre","description":"Décris brièvement ce que tu vois"}`,

  fungus: `Identifie ce champignon. JSON UNIQUEMENT. RESPONSABILITÉ CRITIQUE: TOXICITÉ.

STRUCTURE EXACTE REQUISE (COMPLÉTER TOUTES LES PHRASES):
{
  "found": true,
  "common_name": "Nom commun précis",
  "scientific_name": "Nom latin",
  "family": "Famille",
  "confidence": 70,
  "is_edible": false,
  "is_toxic": true,
  "edibility_status": "toxic",
  "safety_notes": "NE JAMAIS CONSOMMER sans expert mycologue. Confusion mortelle possible avec [espèce]. (max 120 char)",
  "description": "Description complète des caractéristiques (max 180 char)",
  "habitat": "Habitat naturel détaillé (type de forêt, substrat, saison) max 120 char",
  "fun_fact": "Fait concret unique et complet (max 140 char)",
  "edibility_details": "OBLIGATOIRE: Toxique mortel / Toxique dangereux / Comestible excellent / Non comestible / Confusion possible avec [espèce mortelle] (max 140 char)",
  "ecological_role": "Rôle écologique complet et précis (max 180 char)",
  "biodiversity_importance": "Importance biodiversité complète (max 180 char)",
  "rarity": "peu_commune"
}

RÈGLES ABSOLUES:
- TOUJOURS remplir edibility_details avec détails toxicité/comestibilité
- Si DOUTE sur identification: is_toxic=true + safety_notes STRICT
- TOUTES phrases COMPLÈTES, JAMAIS de "..."
- habitat: PRÉCIS (feuillus/résineux, substrat, mois)
- Si pas champignon: {"found":false}`,

  bird: `Identifie cet oiseau avec précision. Réponds en JSON structuré.
- description: 1-2 phrases courtes (max 200 caractères)
- habitat: où vit-il (max 100 caractères)
- ecological_role: rôle dans l'écosystème (régulation insectes, dispersion graines, prédation, etc.) max 200 caractères
- biodiversity_importance: pourquoi cet oiseau est important pour la biodiversité (contrôle ravageurs, indicateur santé environnement, etc.) max 200 caractères
- anecdote: 1 fait intéressant court (max 150 caractères)
- rarity: commune/peu_commune/rare/legendaire. Ne mets "commune" que si l'espèce est très banale; utilise "peu_commune" pour une identification précise, distinctive ou moins souvent observée.
Si ce n'est pas un oiseau, réponds {"found":false,"common_name":"Pas un oiseau","description":"Décris brièvement ce que tu vois"}`,

  insect: `Identifie cet insecte avec précision. Réponds en JSON structuré.
- is_edible: false
- is_toxic: true si l'espèce pique, mord, irrite, possède des poils urticants, ou présente un risque allergique notable
- edibility_status: "toxic" si risque de piqûre/morsure/irritation, sinon "unknown"
- safety_notes: si risque, indique quoi faire en cas de piqûre/contact en une phrase claire
- description: 1-2 phrases courtes (max 200 caractères)
- habitat: où vit-il (max 100 caractères)
- ecological_role: rôle dans l'écosystème (pollinisation, décomposition, proie pour autres espèces, etc.) max 200 caractères
- biodiversity_importance: pourquoi cet insecte est important pour la biodiversité (maillon chaîne alimentaire, services écosystémiques, etc.) max 200 caractères
- anecdote: 1 fait intéressant court (max 150 caractères)
- rarity: commune/peu_commune/rare/legendaire. Ne mets "commune" que si l'espèce est très banale; utilise "peu_commune" pour une identification précise, distinctive ou moins souvent observée.
Si ce n'est pas un insecte, réponds {"found":false,"common_name":"Pas un insecte","description":"Décris brièvement ce que tu vois"}`,

  arachnid: `Identifie cette araignée ou autre arachnide avec précision. Réponds en JSON structuré.
- is_edible: false
- is_toxic: true si l'espèce est venimeuse, médicalement notable, ou si une morsure peut nécessiter prudence
- edibility_status: "toxic" si risque de morsure/venin, sinon "unknown"
- safety_notes: obligatoire. Pour une veuve noire, recluse, scorpion ou arachnide à risque, indique de ne pas manipuler et quoi faire en cas de morsure/piqûre
- description: 1-2 phrases courtes (max 200 caractères)
- habitat: où vit-il (max 100 caractères)
- ecological_role: rôle dans l'écosystème (régulation d'insectes, prédation, équilibre des populations, etc.) max 200 caractères
- biodiversity_importance: pourquoi cet arachnide est important pour la biodiversité (chaîne alimentaire, contrôle naturel, indicateur habitat, etc.) max 200 caractères
- anecdote: 1 fait intéressant court (max 150 caractères)
- rarity: commune/peu_commune/rare/legendaire. Ne mets "commune" que si l'espèce est très banale; utilise "peu_commune" pour une identification précise, distinctive ou moins souvent observée.
Si ce n'est pas un arachnide, réponds {"found":false,"common_name":"Pas un arachnide","description":"Décris brièvement ce que tu vois"}`,

  rock: `Identifie cette roche, minéral ou cristal avec précision. Réponds en JSON structuré.
- description: 1-2 phrases courtes (max 200 caractères)
- habitat: où trouve-t-on ce minéral (max 100 caractères)
- ecological_role: rôle géologique (formation sols, cycle minéraux, habitat micro-organismes, etc.) max 200 caractères
- biodiversity_importance: importance pour la biodiversité (fertilité sols, filtration eau, substrat pour vie, etc.) max 200 caractères
- anecdote: 1 fait intéressant court (max 150 caractères)
- rarity: commune/peu_commune/rare/legendaire. Ne mets "commune" que si l'objet est très banal; utilise "peu_commune" pour une identification précise, distinctive ou moins souvent observée.
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
  return inferCategoryFromText(description, commonName);
}

const GENERIC_LABEL_PATTERNS = [
  /^sp[ée]cimen observ[ée]$/i,
  /^sp[ée]cimen non identifi[ée]$/i,
  /^oiseau observ[ée]$/i,
  /^insecte observ[ée]$/i,
  /^araign[ée]e observ[ée]$/i,
  /^champignon observ[ée]$/i,
  /^arbre observ[ée]$/i,
  /^min[ée]ral observ[ée]$/i,
  /^petit oiseau$/i,
  /^rapace$/i,
];

function isGenericLabelValue(value) {
  return GENERIC_LABEL_PATTERNS.some((pattern) => pattern.test(String(value || '').trim()));
}

const SPECIES_HINTS = [
  { category: 'bird', regex: /\bmartin[- ]p[êe]cheur\b/i, label: 'Martin-pêcheur' },
  { category: 'bird', regex: /\bm[ée]sange charbonni[èe]re\b/i, label: 'Mésange charbonnière' },
  { category: 'bird', regex: /\brouge[- ]gorge\b/i, label: 'Rouge-gorge familier' },
  { category: 'bird', regex: /\bmerle noir\b/i, label: 'Merle noir' },
  { category: 'bird', regex: /\bmoineau domestique\b/i, label: 'Moineau domestique' },
  { category: 'bird', regex: /\bpie bavarde\b/i, label: 'Pie bavarde' },
  { category: 'bird', regex: /\bgeai des ch[êe]nes\b/i, label: 'Geai des chênes' },
  { category: 'bird', regex: /\bpigeon biset\b/i, label: 'Pigeon biset' },
  { category: 'bird', regex: /\bhirondelle\b/i, label: 'Hirondelle' },
  { category: 'bird', regex: /\bfaucon cr[ée]cerelle\b/i, label: 'Faucon crécerelle' },
  { category: 'bird', regex: /\bbuse variable\b/i, label: 'Buse variable' },
  { category: 'bird', regex: /\bchouette hulotte\b/i, label: 'Chouette hulotte' },
  { category: 'bird', regex: /\bhibou moyen-duc\b/i, label: 'Hibou moyen-duc' },
  { category: 'bird', regex: /\bbergeronnette grise\b/i, label: 'Bergeronnette grise' },
  { category: 'bird', regex: /\bpinson des arbres\b/i, label: 'Pinson des arbres' },
  { category: 'bird', regex: /\bsittelle torchepot\b/i, label: 'Sittelle torchepot' },
  { category: 'bird', regex: /\bgrive musicienne\b/i, label: 'Grive musicienne' },
  { category: 'bird', regex: /\bcorneille noire\b/i, label: 'Corneille noire' },
  { category: 'bird', regex: /\bcygne tubercul[ée]\b/i, label: 'Cygne tuberculé' },
  { category: 'bird', regex: /\bcanard colvert\b/i, label: 'Canard colvert' },
];

function toDisplayCase(label) {
  if (!label) return '';
  return label
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(^|[\s-])([a-zà-ÿ])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function extractSpecificNameFromDescription(description, detectedType) {
  const raw = String(description || '').trim();
  if (!raw) return null;

  for (const hint of SPECIES_HINTS) {
    if (hint.category === detectedType && hint.regex.test(raw)) return hint.label;
  }

  const lower = raw.toLowerCase();
  const nounPhrasePatterns = [
    /(?:montre|représente|on voit|c'est|il s'agit de)\s+(?:un|une|le|la|des)\s+([^,.]{3,70})/i,
    /(?:photo de|image de)\s+(?:un|une|le|la|des)\s+([^,.]{3,70})/i,
  ];

  for (const pattern of nounPhrasePatterns) {
    const match = raw.match(pattern);
    if (!match?.[1]) continue;
    const candidate = match[1]
      .replace(/\b(oiseau|insecte|araignée|arachnide|champignon|arbre|minéral|plante)\b.*$/i, '$1')
      .replace(/\s+(avec|aux|sur|dans|perch[ée]|pos[ée]).*$/i, '')
      .trim();

    if (candidate.length >= 4) {
      const isTooGeneric = /^(oiseau|insecte|araign[ée]e|arachnide|champignon|arbre|min[ée]ral|plante)$/i.test(candidate);
      if (!isTooGeneric) return toDisplayCase(candidate);
    }
  }

  if (detectedType === 'bird') {
    if (lower.includes('long bec') && lower.includes('bleu') && lower.includes('orange')) return 'Martin-pêcheur';
    if (lower.includes('tête noire') && lower.includes('joues blanches') && lower.includes('ventre jaune')) return 'Mésange charbonnière';
  }

  return null;
}

function generateNeutralTitle(description, detectedType, outputLanguage = 'fr') {
  const extractedName = extractSpecificNameFromDescription(description, detectedType);
  if (extractedName) return extractedName;

  const text = (description || '').toLowerCase();
  const english = outputLanguage === 'en';

  // Extract specific features from description
  if (detectedType === 'bird') {
    if (text.includes('trapu') || text.includes('stocky')) return english ? 'Stocky bird' : 'Oiseau trapu';
    if (text.includes('long bec') || text.includes('long bill')) return english ? 'Long-billed bird' : 'Oiseau à long bec';
    if (text.includes('petit') || text.includes('small')) return english ? 'Small bird' : 'Petit oiseau';
    if (text.includes('rapace') || text.includes('raptor')) return english ? 'Raptor' : 'Rapace';
    return english ? 'Observed bird' : 'Oiseau observé';
  }

  if (detectedType === 'insect') {
    if (text.includes('beetle') || text.includes('coléoptère')) return english ? 'Beetle' : 'Coléoptère';
    if (text.includes('fly') || text.includes('mouche')) return english ? 'Fly' : 'Diptère';
    if (text.includes('papillon') || text.includes('butterfly')) return english ? 'Butterfly or moth' : 'Lépidoptère';
    return english ? 'Observed insect' : 'Insecte observé';
  }

  if (detectedType === 'arachnid') {
    if (text.includes('épeire') || text.includes('epeire') || text.includes('orb')) return english ? 'Orb-weaver spider' : 'Épeire';
    if (text.includes('saltique') || text.includes('jumping')) return english ? 'Jumping spider' : 'Araignée sauteuse';
    if (text.includes('toile') || text.includes('web')) return english ? 'Web-building spider' : 'Araignée tisseuse';
    return english ? 'Observed spider' : 'Araignée observée';
  }

  if (detectedType === 'fungus') {
    if (text.includes('chapeau') || text.includes('cap')) return english ? 'Capped mushroom' : 'Champignon à chapeau';
    if (text.includes('toxique') || text.includes('toxic')) return english ? 'Mushroom (toxicity uncertain)' : 'Champignon (toxicité incertaine)';
    return english ? 'Observed mushroom' : 'Champignon observé';
  }

  if (detectedType === 'rock') {
    if (text.includes('crystal') || text.includes('cristal')) return english ? 'Mineral crystal' : 'Cristal minéral';
    if (text.includes('quartz')) return 'Quartz';
    if (text.includes('calcaire') || text.includes('limestone')) return english ? 'Limestone rock' : 'Roche calcaire';
    return english ? 'Observed mineral' : 'Minéral observé';
  }

  if (detectedType === 'tree') {
    if (text.includes('conifer') || text.includes('conifère')) return english ? 'Conifer' : 'Conifère';
    if (text.includes('feuillus') || text.includes('deciduous')) return english ? 'Deciduous tree' : 'Arbre feuillu';
    return english ? 'Observed tree' : 'Arbre observé';
  }

  return english ? 'Observed specimen' : 'Spécimen observé';
}

function normalizeConfidenceValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 70;
  if (raw === 'high' || raw === 'élevée' || raw === 'elevee') return 86;
  if (raw === 'medium' || raw === 'moyenne') return 68;
  if (raw === 'low' || raw === 'faible') return 48;

  const parsed = Number.parseFloat(raw.replace(',', '.'));
  if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, Math.round(parsed)));
  return 70;
}

function parseOptionalBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value > 0;

  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (['true', 'yes', 'oui', 'vrai', '1'].includes(raw)) return true;
  if (['false', 'no', 'non', 'faux', '0'].includes(raw)) return false;
  return null;
}

function inferSafetyFromText(...parts) {
  const text = parts
    .filter(Boolean)
    .map((part) => String(part).toLowerCase())
    .join(' ');

  if (!text) {
    return {
      is_edible: null,
      is_toxic: null,
      status: 'unknown',
    };
  }

  const toxicPattern = /\b(toxique|toxicity|toxic|poison|poisonous|venom|venomous|v[ée]n[ée]neux|mortel|dangereux|irritant|urticant|allerg[èe]ne|hallucinog[èe]ne|piq[ûu]re|morsure)\b/i;
  const nonToxicPattern = /\b(non[- ]?toxique|pas toxique|not toxic|non poisonous)\b/i;
  const nonEdiblePattern = /\b(non[- ]?comestible|pas comestible|immangeable|not edible|inedible|unpalatable)\b/i;
  const ediblePattern = /\b(comestible|edible|consommable|se mange|fruit comestible|fruits comestibles)\b/i;

  const isToxic = toxicPattern.test(text) && !nonToxicPattern.test(text);
  const isNonEdible = nonEdiblePattern.test(text);
  const isEdible = ediblePattern.test(text) && !isNonEdible && !isToxic;

  return {
    is_edible: isEdible ? true : isNonEdible || isToxic ? false : null,
    is_toxic: isToxic ? true : null,
    status: isToxic ? 'toxic' : isEdible ? 'edible' : isNonEdible ? 'non_edible' : 'unknown',
  };
}

function normalizeEdibilityStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['edible', 'comestible'].includes(raw)) return 'edible';
  if (['toxic', 'toxique', 'dangerous', 'poisonous'].includes(raw)) return 'toxic';
  if (['non_edible', 'inedible', 'non-comestible', 'non comestible', 'not_edible'].includes(raw)) return 'non_edible';
  if (['unknown', 'inconnu', 'uncertain', 'incertain', 'unverified', 'non_verifie', 'non vérifié'].includes(raw)) return 'unknown';
  return null;
}

const BIOLOGICAL_RISK_CATEGORIES = new Set(['plant', 'tree', 'fungus', 'arachnid', 'insect']);
const BITE_STING_RISK_CATEGORIES = new Set(['arachnid', 'insect']);

const MEDICAL_RISK_RULES = [
  {
    categories: ['arachnid'],
    pattern: /\b(latrodectus|veuve noire|black widow|redback|tredecimguttatus|mactans|hasselti)\b/i,
    note: "Araignée venimeuse à ne pas manipuler. En cas de morsure, nettoie, applique du froid enveloppé et appelle le 15/112 ou un centre antipoison si douleur intense, crampes, malaise ou enfant.",
    note_en: "Venomous spider: do not handle. If bitten, clean the area, apply wrapped cold, and call emergency services or poison control if pain is intense, cramps, malaise occurs, or a child is involved.",
  },
  {
    categories: ['arachnid'],
    pattern: /\b(loxosceles|recluse|violoniste|violin spider|rufescens|laeta|reclusa)\b/i,
    note: "Araignée à morsure potentiellement problématique. Nettoie la zone, évite de gratter et demande un avis médical rapide si douleur forte, plaque qui s'étend, fièvre ou nécrose.",
    note_en: "Spider with a potentially problematic bite. Clean the area, avoid scratching, and seek medical advice quickly if pain is strong, the patch spreads, fever appears, or necrosis is suspected.",
  },
  {
    categories: ['arachnid'],
    pattern: /\b(cheiracanthium|chiracanthium|punctorium|sac spider|araign[ée]e jaune|sac jaune)\b/i,
    note: "Morsure parfois douloureuse: ne manipule pas l'animal. Nettoie, applique du froid enveloppé et consulte si douleur importante, gonflement rapide ou réaction générale.",
    note_en: "Bite can be painful: do not handle the animal. Clean, apply wrapped cold, and seek advice if pain is significant, swelling spreads quickly, or a general reaction appears.",
  },
  {
    categories: ['arachnid'],
    pattern: /\b(phoneutria|atrax|hadronyche|funnel[- ]web|sicarius|six[- ]eyed sand|scorpion)\b/i,
    note: "Arachnide potentiellement dangereux: garde tes distances. En cas de morsure ou piqûre, appelle immédiatement le 15/112 ou un centre antipoison.",
    note_en: "Potentially dangerous arachnid: keep distance. If bitten or stung, call emergency services or poison control immediately.",
  },
  {
    categories: ['insect'],
    pattern: /\b(frelon|hornet|vespa|gu[êe]pe|wasp|abeille|bee|bourdon|vespula|polistes)\b/i,
    note: "Risque de piqûre, surtout en cas d'allergie. Retire le dard si visible, nettoie, applique du froid et appelle le 15/112 si gêne respiratoire, malaise ou gonflement du visage.",
    note_en: "Sting risk, especially with allergies. Remove the stinger if visible, clean, apply cold, and call emergency services if breathing difficulty, malaise, or facial swelling occurs.",
  },
  {
    categories: ['insect'],
    pattern: /\b(processionnaire|thaumetopoea|chenille urticante|urticating caterpillar)\b/i,
    note: "Poils urticants dangereux pour la peau, les yeux et les animaux. Ne touche pas, rince sans frotter en cas de contact et demande un avis médical si irritation forte.",
    note_en: "Urticating hairs can harm skin, eyes and pets. Do not touch; rinse without rubbing after contact and seek medical advice if irritation is strong.",
  },
];

function buildSafetyText(data = {}) {
  return [
    data.common_name,
    data.scientific_name,
    data.family,
    data.description,
    data.habitat,
    data.edibility_details,
    data.safety_notes,
  ]
    .filter(Boolean)
    .join(' ');
}

function localizedSafetyNote(rule, outputLanguage) {
  return outputLanguage === 'en' ? (rule.note_en || rule.note) : rule.note;
}

function inferMedicalRiskSafety(data, category, outputLanguage = 'fr') {
  const text = buildSafetyText(data);
  for (const rule of MEDICAL_RISK_RULES) {
    if (!rule.categories.includes(category)) continue;
    if (rule.pattern.test(text)) {
      return {
        is_toxic: true,
        status: 'toxic',
        safety_notes: localizedSafetyNote(rule, outputLanguage),
      };
    }
  }

  if (category === 'arachnid') {
    return {
      is_toxic: null,
      status: 'unknown',
      safety_notes: outputLanguage === 'en'
        ? "Observe arachnids without handling them: photo identification is not enough to assess risk. If a bite is painful, clean it, apply wrapped cold, and seek medical advice."
        : "Arachnide à observer sans manipuler: l'identification photo ne suffit pas à évaluer le risque. En cas de morsure douloureuse, nettoie, applique du froid et demande un avis médical.",
    };
  }

  if (category === 'insect') {
    return {
      is_toxic: null,
      status: 'unknown',
      safety_notes: outputLanguage === 'en'
        ? "Observe without handling if the species can sting, bite or irritate. If a sting causes malaise, breathing difficulty or rapid swelling, call emergency services."
        : "Observe sans manipuler si l'espèce pique, mord ou irrite. En cas de piqûre avec malaise, gêne respiratoire ou gonflement rapide, appelle le 15/112.",
    };
  }

  if (category === 'fungus') {
    return {
      is_toxic: null,
      status: 'unknown',
      safety_notes: outputLanguage === 'en'
        ? 'Indicative information: never eat a mushroom without local expert verification.'
        : 'Information indicative: ne jamais consommer un champignon sans vérification experte locale.',
    };
  }

  if (category === 'plant' || category === 'tree') {
    return {
      is_toxic: null,
      status: 'unknown',
      safety_notes: outputLanguage === 'en'
        ? 'Indicative information: do not consume or handle without expert verification, especially with sap, berries or latex.'
        : 'Information indicative: ne pas consommer ou manipuler sans vérification experte, surtout en cas de sève, baie ou latex.',
    };
  }

  return {
    is_toxic: null,
    status: 'unknown',
    safety_notes: '',
  };
}

function normalizeRarity(data, category) {
  const raw = String(data?.rarity || '').trim().toLowerCase();
  const valid = new Set(['commune', 'peu_commune', 'rare', 'legendaire']);
  let rarity = valid.has(raw) ? raw : 'commune';
  const confidence = normalizeConfidenceValue(data?.confidence);
  const text = [
    data?.common_name,
    data?.scientific_name,
    data?.family,
    data?.description,
    data?.habitat,
    category,
  ].filter(Boolean).join(' ').toLowerCase();
  const hasSpecificName = Boolean(String(data?.scientific_name || '').trim()) && !isGenericLabelValue(data?.common_name);
  const veryCommonPattern = /\b(pissenlit|taraxacum|plantain|plantago|tr[èe]fle|trifolium|pigeon biset|columba livia|moineau|passer domesticus|abeille domestique|apis mellifera|coccinelle|bellis perennis|paquerette|pâquerette)\b/i;
  const uncommonPattern = /\b(peu commun|peu commune|rare|localis[ée]|m[ée]diterran[ée]en|prot[ée]g[ée]|end[ée]mique|menac[ée]|discret|difficile [àa] observer|moins fr[ée]quent)\b/i;
  const rarePattern = /\b(tr[èe]s rare|rarissime|menac[ée]|prot[ée]g[ée]|end[ée]mique|liste rouge|en danger|vuln[ée]rable)\b/i;

  if (rarity === 'legendaire' && confidence < 82) return 'rare';
  if (rarePattern.test(text) && confidence >= 68) return rarity === 'legendaire' ? 'legendaire' : 'rare';
  if (uncommonPattern.test(text) && confidence >= 58 && rarity === 'commune') return 'peu_commune';

  // Product tuning: avoid flattening every precise observation to "commune".
  // If the model is confident and names a real taxon, default to "peu commune"
  // unless the species is explicitly very common.
  if (rarity === 'commune' && hasSpecificName && confidence >= 72 && !veryCommonPattern.test(text)) {
    return 'peu_commune';
  }

  return rarity;
}

function normalizeSafetyFields(data, category, outputLanguage = 'fr') {
  const medicalRisk = inferMedicalRiskSafety(data, category, outputLanguage);
  const inferred = inferSafetyFromText(
    data?.common_name,
    data?.scientific_name,
    data?.family,
    data?.edibility_details,
    data?.safety_notes,
    data?.description,
  );
  const explicitStatus = normalizeEdibilityStatus(data?.edibility_status);
  const explicitEdible = parseOptionalBoolean(data?.is_edible);
  const explicitToxic = parseOptionalBoolean(data?.is_toxic);
  const isRiskCategory = BIOLOGICAL_RISK_CATEGORIES.has(category);

  let isToxic = medicalRisk.is_toxic ?? explicitToxic ?? inferred.is_toxic ?? false;
  let isEdible = explicitEdible ?? inferred.is_edible ?? false;
  let status = medicalRisk.status === 'toxic'
    ? 'toxic'
    : explicitStatus || inferred.status || medicalRisk.status || 'unknown';

  if (BITE_STING_RISK_CATEGORIES.has(category) && status === 'non_edible') {
    status = 'unknown';
  }

  if (status === 'toxic') {
    isToxic = true;
    isEdible = false;
  } else if (status === 'edible') {
    isEdible = !isToxic;
  } else if (status === 'non_edible') {
    isEdible = false;
    isToxic = false;
  } else if (isToxic) {
    status = 'toxic';
    isEdible = false;
  } else if (isEdible) {
    status = 'edible';
  } else if (!isRiskCategory) {
    status = 'unknown';
  }

  const rawSafetyNotes = String(data?.safety_notes || '').trim();
  const usableSafetyNotes = BITE_STING_RISK_CATEGORIES.has(category) && /\b(consommer|comestible|edible)\b/i.test(rawSafetyNotes)
    ? ''
    : rawSafetyNotes;
  const safetyNotes = usableSafetyNotes
    || medicalRisk.safety_notes
    || (isRiskCategory
      ? (outputLanguage === 'en'
        ? 'Indicative information — do not consume without expert verification.'
        : 'Information indicative — ne pas consommer sans vérification experte.')
      : '');

  return {
    is_edible: Boolean(isEdible && !isToxic),
    is_toxic: Boolean(isToxic),
    edibility_status: status,
    safety_notes: safetyNotes,
  };
}

function isSpecificResultLabel(label) {
  const raw = String(label || '').trim();
  if (!raw) return false;
  if (isGenericLabelValue(raw)) return false;
  if (/^sp[ée]cimen (observ[ée]|non identifi[ée])$/i.test(raw)) return false;
  return true;
}

function synthesizeFallbackData(data, category, outputLanguage = 'fr') {
  const detectedType = normalizeSpeciesCategory(category, data || { category });
  const description = String(data?.description || '').trim();
  const commonName = generateNeutralTitle(description, detectedType, outputLanguage);

  if (!commonName) return null;

  return {
    found: true,
    category: detectedType,
    common_name: commonName,
    scientific_name: data?.scientific_name || '',
    family: data?.family || '',
    confidence: Math.min(normalizeConfidenceValue(data?.confidence), 62),
    rarity: normalizeRarity(data, detectedType),
    description: description || (outputLanguage === 'en'
      ? `Field observation still being qualified.`
      : `Observation ${detectedType === 'bird' ? "d'avifaune" : 'de terrain'} en cours de qualification.`),
    is_edible: false,
    is_toxic: false,
    edibility_status: 'unknown',
    safety_notes: inferMedicalRiskSafety(data, detectedType, outputLanguage).safety_notes,
    habitat: data?.habitat || '',
    ecological_role: data?.ecological_role || '',
    biodiversity_importance: data?.biodiversity_importance || '',
    anecdote: data?.anecdote || '',
    alternatives: data?.alternatives || [],
  };
}

function normalizeGeminiResponse(data, category, outputLanguage = 'fr') {
  if (!data) return null;

  // Check for negative/rejection responses
  const commonNameLower = (data.common_name || '').toLowerCase();
  const isNegative = commonNameLower.startsWith('pas un') ||
                     commonNameLower.startsWith('pas une') ||
                     commonNameLower.startsWith('not a') ||
                     data.found === false;

  const inferredCategory = normalizeSpeciesCategory(category, {
    category,
    common_name: data.common_name,
    scientific_name: data.scientific_name,
    family: data.family,
    description: data.description,
    habitat: data.habitat,
  });

  let finalCommonName = data.common_name;
  let correctedCategory = inferredCategory;
  const isGenericLabel = isGenericLabelValue(finalCommonName);

  if (isNegative) {
    // Detect actual type from description
    const detectedType = detectActualTypeFromDescription(data.description, data.common_name);

    if (detectedType) {
      correctedCategory = detectedType;
      finalCommonName = generateNeutralTitle(data.description, detectedType, outputLanguage);
    } else {
      // No clear type detected, use generic title
      finalCommonName = outputLanguage === 'en' ? 'Unidentified specimen' : 'Spécimen non identifié';
    }
  }

  if (!isNegative && (commonNameLower.includes('spécimen non identifié') || commonNameLower.includes('specimen non identifie'))) {
    finalCommonName = generateNeutralTitle(data.description, correctedCategory, outputLanguage);
  }

  if (!isNegative && isGenericLabel) {
    const extractedName = extractSpecificNameFromDescription(data.description, correctedCategory);
    if (extractedName) {
      finalCommonName = extractedName;
    } else {
      finalCommonName = generateNeutralTitle(data.description, correctedCategory, outputLanguage);
    }
  }

  // Ensure we have a valid common name
  if (!finalCommonName || finalCommonName.trim().length === 0) {
    finalCommonName = outputLanguage === 'en' ? 'Observed specimen' : 'Spécimen observé';
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
  const safety = normalizeSafetyFields(data, correctedCategory, outputLanguage);
  const rarity = normalizeRarity(data, correctedCategory);
  const safetyNotes = truncateSentences(safety.safety_notes, 2, 220);
  const medicinalUses = truncateSentences(data.medicinal_uses, 2, 180);
  const anecdote = truncateSentences(data.anecdote || data.fun_fact, 1, 150);
  const habitat = truncateSentences(data.habitat, 1, 120);
  const ecologicalRole = truncateSentences(data.ecological_role, 2, 200);
  const biodiversityImportance = truncateSentences(data.biodiversity_importance, 2, 200);
  const family = (data.family || '').trim().substring(0, 80);

  return {
    common_name: finalCommonName,
    scientific_name: scientificName || null,
    family: family || null,
    confidence: data.found === false
      ? Math.max(normalizeConfidenceValue(data.confidence) - 10, 50)
      : normalizeConfidenceValue(data.confidence),
    rarity,
    is_edible: safety.is_edible,
    is_toxic: safety.is_toxic,
    edibility_status: safety.edibility_status,
    safety_notes: safetyNotes || null,
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

function buildResult(data, category, profile, outputLanguage = 'fr') {
  if (!data || !data.common_name) return null;

  const normalized = normalizeGeminiResponse(data, category, outputLanguage);
  if (!normalized) return null;
  const hasFullAccess = hasLaunchAccess(profile);

  return {
    top_result: {
      common_name: normalized.common_name,
      scientific_name: normalized.scientific_name || '',
      family: normalized.family || '',
      confidence: normalized.confidence,
      rarity: normalized.rarity,
      is_edible: normalized.is_edible,
      is_toxic: normalized.is_toxic,
      edibility_status: normalized.edibility_status,
      safety_notes: normalized.safety_notes || '',
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
    alternatives: hasFullAccess ? (data.alternatives || []).slice(0, 2) : [],
    is_pro: hasFullAccess,
    daily_count: (profile.daily_identifications_count || 0) + 1,
    daily_limit: getDailyScanLimit(profile),
    correctedCategory: normalized.correctedCategory,
  };
}

function buildSeededPrompt(basePrompt, seedData) {
  const seedBits = [
    seedData?.common_name ? `hypothèse initiale: ${seedData.common_name}` : null,
    seedData?.scientific_name ? `nom latin probable: ${seedData.scientific_name}` : null,
    seedData?.description ? `indices visuels déjà relevés: ${seedData.description}` : null,
  ].filter(Boolean);

  if (!seedBits.length) return basePrompt;

  return `${basePrompt}

Contexte de pré-analyse:
- ${seedBits.join('\n- ')}

Important:
- si l'hypothèse initiale semble cohérente avec l'image, affine-la au lieu de revenir à un titre générique
- évite absolument les libellés comme "oiseau observé", "insecte observé", "spécimen observé" si un taxon plus précis est plausible`;
}

function mergeGeminiData(seedData, focusedData) {
  if (!seedData && !focusedData) return null;
  if (!seedData) return focusedData;
  if (!focusedData) return seedData;

  const merged = { ...seedData, ...focusedData };

  const focusedName = String(focusedData.common_name || '').trim();
  const seedName = String(seedData.common_name || '').trim();

  if (!focusedName || isGenericLabelValue(focusedName)) {
    merged.common_name = seedName || focusedName;
  }

  if ((!focusedData.scientific_name || !String(focusedData.scientific_name).trim()) && seedData.scientific_name) {
    merged.scientific_name = seedData.scientific_name;
  }

  if ((!focusedData.family || !String(focusedData.family).trim()) && seedData.family) {
    merged.family = seedData.family;
  }

  const focusedConfidence = Number(focusedData.confidence || 0);
  const seedConfidence = Number(seedData.confidence || 0);
  merged.confidence = Math.max(focusedConfidence, seedConfidence) || focusedConfidence || seedConfidence || 65;

  if ((!focusedData.alternatives || !focusedData.alternatives.length) && seedData.alternatives?.length) {
    merged.alternatives = seedData.alternatives;
  }

  return merged;
}

function shouldUseUniversalFallback(data, result) {
  if (!data) return true;
  if (!data.common_name || !String(data.common_name).trim()) return true;
  if (!result) return true;

  const commonNameLower = String(data.common_name || '').toLowerCase();
  const description = String(data.description || '').trim();
  const isNegative =
    data.found === false ||
    commonNameLower.startsWith('pas un') ||
    commonNameLower.startsWith('pas une') ||
    commonNameLower.startsWith('not a');

  if (isNegative && !description) return true;
  return false;
}

// ─── audio identification helpers ───────────────────────────────────────────

const VALID_SOUND_TYPES = new Set(['bird', 'insect']);

function parseAudioPayload(audioBase64, mimeType) {
  if (!audioBase64) return null;
  if (audioBase64.startsWith('data:')) {
    const [header, data] = audioBase64.split(',');
    return {
      data,
      mediaType: header.match(/data:([^;]+)/)?.[1] || mimeType || 'audio/webm',
    };
  }
  return { data: audioBase64, mediaType: mimeType || 'audio/webm' };
}

function normalizeSoundType(value) {
  const normalized = String(value || 'bird').trim().toLowerCase();
  return VALID_SOUND_TYPES.has(normalized) ? normalized : 'bird';
}

function normalizeSoundConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 62;
  return Math.max(1, Math.min(100, number > 1 ? number : number * 100));
}

function normalizeSoundRarity(value) {
  const normalized = String(value || 'commune').trim().toLowerCase();
  const valid = new Set(['commune', 'peu_commune', 'rare', 'legendaire']);
  return valid.has(normalized) ? normalized : 'commune';
}

function truncateSoundText(value, maxLength) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

async function callGeminiSound({
  audioBase64,
  mediaType,
  soundType,
  durationSeconds,
  frequencyAnalysis,
  environmentalContext,
  outputLanguage = 'fr'
}) {
  const categoryLabel = soundType === 'bird' ? 'oiseau' : soundType === 'insect' ? 'insecte' : soundType === 'amphibian' ? 'amphibien' : 'animal';

  // Build enriched context section
  let contextSection = `
Contexte de l'enregistrement:
- Type demandé: ${soundType}
- Durée: ${Number(durationSeconds) || 0}s`;

  // Add frequency analysis if available
  if (frequencyAnalysis) {
    contextSection += `

Analyse fréquentielle (FFT):
- Fréquences dominantes détectées: ${frequencyAnalysis.frequencies || 'non disponible'}
- Pattern temporel: ${frequencyAnalysis.pattern || 'non disponible'}
- Rythme: ${frequencyAnalysis.rhythm || 'non disponible'}
- Qualité du signal: ${frequencyAnalysis.quality || 'non disponible'}
- Intensité du signal: ${frequencyAnalysis.signalStrength || 'non disponible'}
- Filtre appliqué: ${frequencyAnalysis.filterApplied || 'non disponible'}`;
  }

  // Add environmental context if available
  if (environmentalContext) {
    const { timeOfDay, season, region, habitatHint, weather } = environmentalContext;

    contextSection += `

Contexte environnemental:
- Heure: ${timeOfDay?.formatted || 'inconnue'} (${timeOfDay?.description || 'non spécifié'})
- Saison: ${season?.label || 'inconnue'} (${season?.description || 'non spécifié'})
- Région biogéographique: ${region?.label || 'inconnue'} (${region?.description || 'non spécifié'})
- Habitat probable: ${habitatHint || 'non déterminé'}`;

    if (weather) {
      contextSection += `
- Météo: ${weather.description || 'inconnue'}, ${weather.temperature || '?'}°C`;
    }
  }

  const prompt = withOutputLanguage(`Tu es un expert en bioacoustique pour une application mobile de biodiversité de terrain.

Analyse cet extrait audio et identifie le ${categoryLabel} le plus probable en utilisant TOUS les indices disponibles.
${contextSection}

Instructions CRITIQUES:
- Utilise l'analyse fréquentielle pour affiner ton identification (fréquences dominantes, pattern temporel, rythme)
- Prends en compte le contexte environnemental (heure, saison, région) pour éliminer les espèces improbables
- Par exemple: un chant nocturne en été dans le sud de la France avec des fréquences 2-4kHz évoque des amphibiens ou orthoptères nocturnes
- Un chant diurne au printemps avec des fréquences 3-7kHz évoque des passereaux en période de reproduction
- Réponds UNIQUEMENT en JSON brut, sans markdown ni blocs de code
- Si l'audio est trop faible ou non exploitable, renvoie found=false
- Ne donne JAMAIS de nom générique comme "oiseau observé" - utilise le taxon le plus précis possible
- Pour les oiseaux: analyse le chant/cri, le rythme, le timbre, les fréquences dominantes
- Pour les insectes: analyse la stridulation/bourdonnement, le pattern, la fréquence porteuse
- Pour les amphibiens: analyse le coassement, la fréquence fondamentale, le rythme
- confidence: 0-100 (utilise les données fréquentielles pour ajuster la confiance)
- rarity: "commune" (espèces très banales), "peu_commune" (taxons précis/discrets), "rare" (peu fréquent), "legendaire" (exceptionnel uniquement)

Format JSON attendu:
{
  "found": true,
  "category": "${soundType}",
  "common_name": "Nom commun précis",
  "scientific_name": "Nom latin",
  "family": "Famille taxonomique",
  "confidence": 75,
  "rarity": "commune",
  "sound_type": "chant / cri / stridulation / coassement / bourdonnement",
  "description": "Description du son entendu avec détails fréquentiels",
  "habitat": "Habitat typique de l'espèce",
  "behavior": "Comportement vocal et période d'activité",
  "ecological_role": "Rôle dans l'écosystème",
  "biodiversity_importance": "Importance pour la biodiversité",
  "anecdote": "Fait intéressant en 1 phrase",
  "alternatives": [
    { "common_name": "Autre hypothèse", "scientific_name": "Nom latin", "confidence": 45 }
  ]
}`, outputLanguage);

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mediaType,
              data: audioBase64,
            },
          },
          { text: prompt },
        ],
      }],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.15,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[identify-plant API][sound] Gemini error', response.status, text);
    return null;
  }

  const payload = await response.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    return JSON.parse(text);
  } catch {
    const clean = text.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
}

function buildSoundFallbackResult(soundType, outputLanguage = 'fr') {
  const english = outputLanguage === 'en';
  return {
    found: false,
    category: soundType,
    common_name: soundType === 'bird'
      ? english ? "Unidentified bird sound" : "Son d'oiseau non identifié"
      : english ? "Unidentified insect sound" : "Son d'insecte non identifié",
    scientific_name: '',
    family: '',
    confidence: 35,
    rarity: 'commune',
    sound_type: soundType === 'bird'
      ? english ? 'uncertain song or call' : 'chant ou cri incertain'
      : english ? 'uncertain stridulation or buzzing' : 'stridulation ou bourdonnement incertain',
    description: english
      ? "The sample is too weak or noisy to produce a reliable identification."
      : "L'extrait est trop faible ou trop bruité pour produire une identification fiable.",
    habitat: '',
    behavior: '',
    ecological_role: '',
    biodiversity_importance: '',
    anecdote: '',
    alternatives: [],
  };
}

function normalizeSoundResult(raw, soundType, profile, outputLanguage = 'fr') {
  const fallback = buildSoundFallbackResult(soundType, outputLanguage);
  const data = raw?.found === false ? fallback : (raw || fallback);
  const category = normalizeSoundType(data.category || soundType);
  const hasFullAccess = hasLaunchAccess(profile);

  return {
    found: data.found !== false,
    category,
    common_name: truncateSoundText(data.common_name || fallback.common_name, 100),
    scientific_name: truncateSoundText(data.scientific_name, 120),
    family: truncateSoundText(data.family, 100),
    confidence: normalizeSoundConfidence(data.confidence),
    rarity: normalizeSoundRarity(data.rarity),
    sound_type: truncateSoundText(data.sound_type || (category === 'bird'
      ? outputLanguage === 'en' ? 'song / call' : 'chant / cri'
      : outputLanguage === 'en' ? 'stridulation' : 'stridulation'), 90),
    description: truncateSoundText(data.description, 420),
    habitat: truncateSoundText(data.habitat, 220),
    behavior: truncateSoundText(data.behavior, 220),
    ecological_role: truncateSoundText(data.ecological_role, 260),
    biodiversity_importance: truncateSoundText(data.biodiversity_importance, 260),
    anecdote: truncateSoundText(data.anecdote, 180),
    alternatives: hasFullAccess ? (data.alternatives || []).slice(0, 2) : [],
    detection_method: 'audio',
    daily_count: (profile?.daily_identifications_count || 0) + 1,
    daily_limit: getDailyScanLimit(profile),
  };
}

async function handleSoundIdentification({ body, profile, supabase, user, res, outputLanguage = 'fr' }) {
  const soundType = normalizeSoundType(body.soundType);
  const audio = parseAudioPayload(body.audioBase64, body.mimeType);
  if (!audio?.data) {
    console.error('[identify-plant API][sound] No audio provided in body');
    return res.status(400).json({ error: 'No audio provided' });
  }

  let rawResult = null;
  try {
    rawResult = await callGeminiSound({
      audioBase64: audio.data,
      mediaType: audio.mediaType,
      soundType,
      durationSeconds: body.durationSeconds,
      // Pass enriched data to Gemini
      frequencyAnalysis: body.frequencyAnalysis || null,
      environmentalContext: body.environmentalContext || null,
      outputLanguage,
    });
  } catch (error) {
    console.error('[identify-plant API][sound] Gemini sound exception:', error?.message || error);
  }

  const result = normalizeSoundResult(rawResult, soundType, profile, outputLanguage);

  await supabase
    .from('user_profiles')
    .update({ daily_identifications_count: (profile.daily_identifications_count || 0) + 1 })
    .eq('user_email', user.email);

  return res.json(result);
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
      hasAudioBase64: !!body.audioBase64,
      mode: body.mode || null,
      imageLength: body.imageBase64?.length,
      imageStart: body.imageBase64?.substring(0, 30),
      isAdminTest: body.isAdminTest,
      language: body.language || user.user_metadata?.preferred_language || null,
    });
  } catch (err) {
    console.error('[identify-plant API] Body parse error:', err);
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const outputLanguage = normalizeOutputLanguage(body.language || user.user_metadata?.preferred_language);
  const isSoundMode = body.mode === 'sound' || !!body.audioBase64;
  const { imageBase64, isAdminTest } = body;
  if (!isSoundMode && !imageBase64) {
    console.error('[identify-plant API] No image provided in body');
    return res.status(400).json({ error: 'No image provided' });
  }

  const image = isSoundMode ? null : parseImage(imageBase64);
  const today = new Date().toISOString().split('T')[0];

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_email', user.email)
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  };

  // Get or create user profile
  let profile = await fetchProfile();

  if (!profile) {
    const basePayload = {
      user_email: user.email,
      user_id: user.id,
      display_name: resolveDisplayName({ fullName: user.user_metadata?.full_name, email: user.email }),
      is_pro: false,
      total_points: 0,
      total_plants: 0,
      daily_identifications_count: 0,
      daily_reset_date: today,
      rank: 'Débutant',
      onboarding_completed: false,
    };

    let { data: created, error: createError } = await supabase
      .from('user_profiles')
      .insert(basePayload)
      .select()
      .single();

    if (createError && /column .*user_id.* does not exist/i.test(createError.message || '')) {
      const { user_id, ...fallbackPayload } = basePayload;
      ({ data: created, error: createError } = await supabase
        .from('user_profiles')
        .insert(fallbackPayload)
        .select()
        .single());
    }

    if (createError && /duplicate key value/i.test(createError.message || '')) {
      profile = await fetchProfile();
    } else if (createError) {
      throw createError;
    } else {
      profile = created;
    }

    profile = profile || { is_pro: false, daily_identifications_count: 0, daily_reset_date: today };
  } else if (!profile.user_id) {
    await supabase
      .from('user_profiles')
      .update({ user_id: user.id })
      .eq('user_email', user.email);
    profile.user_id = user.id;
  } else if (profile.daily_reset_date !== today) {
    await supabase
      .from('user_profiles')
      .update({ daily_identifications_count: 0, daily_reset_date: today })
      .eq('user_email', user.email);
    profile.daily_identifications_count = 0;
  }

  if (process.env.REVENUECAT_SECRET_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });
      const premiumState = await refreshPremiumStatusForUser({
        adminClient,
        user,
        fallbackProfile: profile,
      });

      if (premiumState?.configured) {
        profile.is_pro = premiumState.isPremium;
        profile.pro_since = premiumState.purchaseDate || null;
        profile.pro_until = premiumState.expirationDate || null;
      }
    } catch (premiumError) {
      console.error("[identify-plant API] Premium sync fallback failed:", premiumError?.message || premiumError);
    }
  }

  // Daily limit check
  const dailyLimit = getDailyScanLimit(profile);
  if (!isAdminTest && dailyLimit !== null && (profile.daily_identifications_count || 0) >= dailyLimit) {
    return res.status(429).json({ error: 'LIMIT_REACHED' });
  }

  if (isSoundMode) {
    return handleSoundIdentification({ body, profile, supabase, user, res, outputLanguage });
  }

  // Try Claude first (premium quality), fallback to Gemini
  let universalData;
  try {
    console.log('[identify-plant] Attempting Claude API...');
    universalData = await callClaude(image.data, image.mediaType, 'plant', outputLanguage);
  } catch (claudeError) {
    console.log('[identify-plant] Claude failed, falling back to Gemini:', claudeError.message);
    universalData = await callGeminiUniversal(image.data, image.mediaType, outputLanguage);
  }

  let category = normalizeSpeciesCategory(universalData?.category, universalData || {});
  let data = universalData;
  let result = buildResult(data, category, profile, outputLanguage);

  const universalStrong = !!result?.top_result?.common_name && isSpecificResultLabel(result.top_result.common_name);

  if (!universalStrong) {
    const detectedCategory = await detectCategory(image.data, image.mediaType);
    console.log(`[identify-plant] user=${user.email} fallbackCategory=${detectedCategory} universalCategory=${category || 'unknown'}`);

    category = normalizeSpeciesCategory(category || detectedCategory, universalData || { category: detectedCategory });
    const prompt = withOutputLanguage(buildSeededPrompt(PROMPTS[category] || PROMPTS.plant, universalData), outputLanguage);
    const focusedData = await callGemini(image.data, image.mediaType, prompt);
    const mergedData = mergeGeminiData(universalData, focusedData);
    const mergedCategory = normalizeSpeciesCategory(focusedData?.category || category, mergedData || { category });
    const mergedResult = buildResult(mergedData, mergedCategory, profile, outputLanguage);

    if (mergedResult) {
      data = mergedData;
      category = mergedCategory;
      result = mergedResult;
      console.log(`[identify-plant] Focused pass succeeded with category=${category} common_name=${result.top_result.common_name}`);
    }

    if (shouldUseUniversalFallback(data, result)) {
      console.log(`[identify-plant] Falling back to detected-category retry for user=${user.email}`);
      const retryPrompt = withOutputLanguage(buildSeededPrompt(PROMPTS[detectedCategory] || PROMPTS.plant, mergedData || universalData), outputLanguage);
      const retryData = await callGemini(image.data, image.mediaType, retryPrompt);
      const retryCategory = normalizeSpeciesCategory(retryData?.category || detectedCategory, retryData || { category: detectedCategory });
      const retryResult = buildResult(retryData, retryCategory, profile, outputLanguage);

      if (retryResult) {
        data = retryData;
        category = retryCategory;
        result = retryResult;
        console.log(`[identify-plant] Detected-category retry succeeded with category=${category} common_name=${result.top_result.common_name}`);
      }
    }
  } else {
    console.log(`[identify-plant] Universal pass accepted with category=${category} common_name=${result.top_result.common_name}`);
  }

  if (!result) {
    const fallbackData = synthesizeFallbackData(data, category || universalData?.category || 'plant', outputLanguage);
    if (fallbackData) {
      result = buildResult(fallbackData, fallbackData.category, profile, outputLanguage);
      category = fallbackData.category;
      console.log(`[identify-plant] Synthesized fallback result with category=${category} common_name=${result?.top_result?.common_name}`);
    }
  }

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
