import { supabase } from '@/api/supabaseClient';

/**
 * TODO: remplacer MOCK_MODE par un vrai appel LLM.
 *
 * Pour activer le vrai LLM :
 * 1. Crée une Vercel API route : /api/identify-plant.js
 * 2. Dans cette route, appelle OpenAI / Anthropic avec l'image base64
 * 3. Retourne le même format que top_result ci-dessous
 * 4. Remplace le bloc MOCK par : const res = await fetch('/api/identify-plant', ...)
 *
 * Format attendu par Home.jsx :
 * {
 *   top_result: { common_name, scientific_name, family, confidence, rarity,
 *                 is_edible, is_toxic, description, ... },
 *   category: 'plant' | 'fungus' | 'tree' | 'bird' | 'insect' | 'rock',
 *   daily_count: number,
 *   daily_limit: 5,
 *   is_pro: false,
 * }
 */

const MOCK_MODE = true; // ← passer à false quand le LLM est prêt

export async function identifyPlant({ imageBase64 }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  if (MOCK_MODE) {
    // Simule un délai réseau
    await new Promise(r => setTimeout(r, 800));

    return {
      top_result: {
        common_name: 'Plante de test',
        scientific_name: 'Plantus mockus',
        family: 'Mockaceae',
        confidence: 92,
        rarity: 'commune',
        is_edible: false,
        is_toxic: false,
        is_cannabis: false,
        strain_type: '',
        description: '[MODE MOCK] Identification LLM non configurée.',
        edibility_details: '',
        medicinal_uses: '',
        anecdote: '',
        habitat: '',
        behavior: '',
      },
      category: 'plant',
      daily_count: 1,
      daily_limit: 5,
      is_pro: false,
    };
  }

  // TODO: appel réel ici
  // const res = await fetch('/api/identify-plant', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ imageBase64 }),
  // });
  // return res.json();
}
