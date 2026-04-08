/**
 * Enrichit les espèces de référence avec des photos depuis Wikipédia
 * Utilise le nom scientifique pour chercher l'image
 *
 * Usage: node scripts/enrich-species-wikipedia.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://rejrtvrkpkopjmowzuqn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanJ0dnJrcGtvcGptb3d6dXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTY0NDIsImV4cCI6MjA5MDk5MjQ0Mn0.nLTm6EXzcu72cJpArcX7LcuXUKVVg19mSJrxrJbLbhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Cherche une image sur Wikipédia pour un nom scientifique
 */
async function getWikipediaImage(scientificName) {
  if (!scientificName || scientificName.trim() === '') {
    return null;
  }

  try {
    // 1. Chercher la page Wikipédia
    const searchUrl = `https://fr.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(scientificName)}&srlimit=1&origin=*`;

    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (!searchData.query?.search?.[0]) {
      // Essayer en anglais si pas de résultat en français
      const searchUrlEn = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(scientificName)}&srlimit=1&origin=*`;
      const searchResEn = await fetch(searchUrlEn);
      const searchDataEn = await searchResEn.json();

      if (!searchDataEn.query?.search?.[0]) {
        return null;
      }

      const pageTitle = searchDataEn.query.search[0].title;
      return await getPageMainImage(pageTitle, 'en');
    }

    const pageTitle = searchData.query.search[0].title;
    return await getPageMainImage(pageTitle, 'fr');

  } catch (error) {
    console.error(`   ⚠️  Erreur Wikipedia pour ${scientificName}:`, error.message);
    return null;
  }
}

/**
 * Récupère l'image principale d'une page Wikipédia
 */
async function getPageMainImage(pageTitle, lang = 'fr') {
  try {
    const baseUrl = lang === 'fr' ? 'https://fr.wikipedia.org' : 'https://en.wikipedia.org';
    const url = `${baseUrl}/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(pageTitle)}&pithumbsize=500&origin=*`;

    const res = await fetch(url);
    const data = await res.json();

    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    return page?.thumbnail?.source || null;

  } catch (error) {
    return null;
  }
}

/**
 * Enrichit toutes les espèces sans photo
 */
async function enrichSpecies() {
  console.log('🖼️  Enrichissement des espèces avec photos Wikipédia\n');
  console.log('⚠️  Attention: Ce script peut prendre 10-20 minutes pour 2500 espèces');
  console.log('   (Rate limit: 1 requête par seconde pour Wikipédia)\n');

  // 1. Récupérer toutes les espèces sans description (on stockera l'URL dans description temporairement)
  const { data: species, error } = await supabase
    .from('reference_species')
    .select('id, common_name, scientific_name, description')
    .is('description', null)
    .limit(100); // Traiter par batch de 100

  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }

  if (!species || species.length === 0) {
    console.log('✅ Toutes les espèces ont déjà des photos (ou aucune espèce dans la DB)\n');
    return;
  }

  console.log(`📊 ${species.length} espèces à enrichir\n`);

  let enriched = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < species.length; i++) {
    const sp = species[i];

    console.log(`${i + 1}/${species.length} - ${sp.common_name} (${sp.scientific_name || 'pas de nom scientifique'})`);

    if (!sp.scientific_name || sp.scientific_name.trim() === '') {
      console.log('   ⚠️  Pas de nom scientifique, ignoré');
      notFound++;
      continue;
    }

    try {
      const imageUrl = await getWikipediaImage(sp.scientific_name);

      if (imageUrl) {
        // Stocker l'URL dans le champ description (temporaire)
        const { error: updateError } = await supabase
          .from('reference_species')
          .update({ description: imageUrl })
          .eq('id', sp.id);

        if (updateError) {
          console.log('   ❌ Erreur update:', updateError.message);
          errors++;
        } else {
          console.log(`   ✅ Photo trouvée: ${imageUrl.substring(0, 60)}...`);
          enriched++;
        }
      } else {
        console.log('   ⚠️  Aucune photo trouvée sur Wikipédia');
        notFound++;
      }

      // Rate limit: attendre 1 seconde entre chaque requête
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (err) {
      console.log(`   ❌ Erreur: ${err.message}`);
      errors++;
    }
  }

  console.log('\n📊 Résultat:');
  console.log(`   ✅ Photos trouvées: ${enriched}`);
  console.log(`   ⚠️  Non trouvées: ${notFound}`);
  console.log(`   ❌ Erreurs: ${errors}`);
  console.log(`\n✨ Enrichissement terminé!\n`);
  console.log('💡 Note: Les URLs sont stockées dans le champ "description"');
  console.log('   Tu peux ensuite créer une colonne "photo_url" et migrer les données\n');
}

enrichSpecies();
