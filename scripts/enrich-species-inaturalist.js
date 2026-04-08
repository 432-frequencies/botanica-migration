/**
 * Enrichit les espèces de référence avec des photos depuis iNaturalist
 * 100% GRATUIT - Pas de crédits requis !
 *
 * Rate limit: 60 requêtes/minute (1 req/seconde)
 * Temps estimé: ~15-20 minutes pour 2500 espèces
 *
 * Usage: node scripts/enrich-species-inaturalist.js [--test] [--limit N]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://rejrtvrkpkopjmowzuqn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanJ0dnJrcGtvcGptb3d6dXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTY0NDIsImV4cCI6MjA5MDk5MjQ0Mn0.nLTm6EXzcu72cJpArcX7LcuXUKVVg19mSJrxrJbLbhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const INATURALIST_API = 'https://api.inaturalist.org/v1';

// Arguments
const args = process.argv.slice(2);
const IS_TEST = args.includes('--test');
const LIMIT_ARG = args.find(arg => arg.startsWith('--limit='));
const BATCH_SIZE = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : (IS_TEST ? 5 : 100);

/**
 * Cherche un taxon sur iNaturalist par nom scientifique
 */
async function searchTaxon(scientificName) {
  try {
    const res = await fetch(
      `${INATURALIST_API}/taxa?q=${encodeURIComponent(scientificName)}&per_page=1`
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.results?.[0] || null;
  } catch (error) {
    console.error(`   ⚠️  Erreur API:`, error.message);
    return null;
  }
}

/**
 * Récupère la meilleure photo d'un taxon
 */
async function getTaxonPhoto(taxonId) {
  try {
    const res = await fetch(
      `${INATURALIST_API}/observations?taxon_id=${taxonId}&quality_grade=research&has[]=photos&per_page=1&order=desc&order_by=votes`
    );

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const observation = data.results?.[0];

    if (!observation?.photos?.[0]) {
      return null;
    }

    // Retourner l'URL en taille medium (meilleure qualité que square)
    const photo = observation.photos[0];
    const photoUrl = photo.url?.replace('square', 'medium') || photo.url;

    return {
      url: photoUrl,
      attribution: photo.attribution || `© ${observation.user?.login || 'Unknown'}`,
      license: photo.license_code || 'all-rights-reserved'
    };
  } catch (error) {
    console.error(`   ⚠️  Erreur récupération photo:`, error.message);
    return null;
  }
}

/**
 * Enrichit une espèce avec une photo iNaturalist
 */
async function enrichSpecies(species) {
  const { id, common_name, scientific_name } = species;

  if (!scientific_name || scientific_name.trim() === '') {
    return { success: false, reason: 'no_scientific_name' };
  }

  // 1. Chercher le taxon
  const taxon = await searchTaxon(scientific_name);

  if (!taxon?.id) {
    return { success: false, reason: 'taxon_not_found' };
  }

  // 2. Récupérer la photo
  const photo = await getTaxonPhoto(taxon.id);

  if (!photo?.url) {
    return { success: false, reason: 'no_photo' };
  }

  // 3. Mettre à jour la DB (stocker l'URL dans description pour l'instant)
  const { error } = await supabase
    .from('reference_species')
    .update({ description: photo.url })
    .eq('id', id);

  if (error) {
    console.error(`   ❌ Erreur update:`, error.message);
    return { success: false, reason: 'update_error', error };
  }

  return {
    success: true,
    photo_url: photo.url,
    attribution: photo.attribution
  };
}

/**
 * Programme principal
 */
async function main() {
  console.log('\n🌿 Enrichissement des espèces avec photos iNaturalist\n');
  console.log('💰 Coût: 0 crédits (API gratuite !)');
  console.log(`⚡ Mode: ${IS_TEST ? 'TEST (5 espèces)' : `PRODUCTION (${BATCH_SIZE} par batch)`}`);
  console.log('⏱️  Rate limit: 1 requête/seconde (60/min)\n');

  // 1. Récupérer les espèces sans photo
  console.log('📊 Récupération des espèces...\n');

  const { data: species, error } = await supabase
    .from('reference_species')
    .select('id, common_name, scientific_name, description')
    .is('description', null)
    .limit(BATCH_SIZE);

  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }

  if (!species || species.length === 0) {
    console.log('✅ Toutes les espèces ont déjà des photos!\n');
    return;
  }

  console.log(`📦 ${species.length} espèces à enrichir\n`);
  console.log('─'.repeat(70));
  console.log('\n');

  // 2. Enrichir chaque espèce
  let enriched = 0;
  let noScientificName = 0;
  let taxonNotFound = 0;
  let noPhoto = 0;
  let errors = 0;

  const startTime = Date.now();

  for (let i = 0; i < species.length; i++) {
    const sp = species[i];
    const progress = Math.round(((i + 1) / species.length) * 100);

    console.log(`[${i + 1}/${species.length}] (${progress}%) ${sp.common_name}`);
    console.log(`   🔬 ${sp.scientific_name || 'Pas de nom scientifique'}`);

    const result = await enrichSpecies(sp);

    if (result.success) {
      console.log(`   ✅ Photo trouvée: ${result.photo_url.substring(0, 50)}...`);
      enriched++;
    } else {
      switch (result.reason) {
        case 'no_scientific_name':
          console.log('   ⚠️  Ignoré (pas de nom scientifique)');
          noScientificName++;
          break;
        case 'taxon_not_found':
          console.log('   ⚠️  Taxon introuvable sur iNaturalist');
          taxonNotFound++;
          break;
        case 'no_photo':
          console.log('   ⚠️  Aucune photo disponible');
          noPhoto++;
          break;
        case 'update_error':
          console.log('   ❌ Erreur lors de la mise à jour');
          errors++;
          break;
      }
    }

    console.log('');

    // Rate limit: 1 requête/seconde
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 3. Résumé
  const duration = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  console.log('\n');
  console.log('─'.repeat(70));
  console.log('\n📊 RÉSULTAT FINAL\n');
  console.log(`   ✅ Photos trouvées:          ${enriched} (${Math.round((enriched / species.length) * 100)}%)`);
  console.log(`   ⚠️  Sans nom scientifique:   ${noScientificName}`);
  console.log(`   ⚠️  Taxon introuvable:       ${taxonNotFound}`);
  console.log(`   ⚠️  Pas de photo:            ${noPhoto}`);
  console.log(`   ❌ Erreurs:                  ${errors}`);
  console.log(`\n⏱️  Durée: ${minutes}m ${seconds}s`);
  console.log(`💰 Coût total: 0 crédits\n`);

  if (enriched > 0) {
    console.log('✨ Enrichissement terminé avec succès!\n');
    console.log('💡 Les URLs sont stockées dans le champ "description"');
    console.log('   Tu peux ensuite créer une colonne "photo_url" dédiée si besoin\n');
  }

  // 4. Reste-t-il des espèces à traiter ?
  const { count } = await supabase
    .from('reference_species')
    .select('*', { count: 'exact', head: true })
    .is('description', null);

  if (count > 0) {
    console.log(`📦 Il reste ${count} espèces à traiter`);
    console.log(`   Relance le script pour continuer: node scripts/enrich-species-inaturalist.js\n`);
  } else {
    console.log('🎉 Toutes les espèces ont été enrichies!\n');
  }
}

main();
