/**
 * Enrichit les espèces de référence avec des photos depuis iNaturalist.
 *
 * Usage:
 *   source .env.local
 *   node scripts/enrich-species-inaturalist.js
 *   node scripts/enrich-species-inaturalist.js --test
 *   node scripts/enrich-species-inaturalist.js --limit=250
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables manquantes: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.');
  console.error('   Lance par exemple: source .env.local && node scripts/enrich-species-inaturalist.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const INATURALIST_API = 'https://api.inaturalist.org/v1';

const args = process.argv.slice(2);
const IS_TEST = args.includes('--test');
const LIMIT_ARG = args.find((arg) => arg.startsWith('--limit='));
const BATCH_SIZE = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : (IS_TEST ? 5 : 100);
const taxonCache = new Map();
const photoCache = new Map();

function isRemoteImageUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function buildSearchQueries(scientificName) {
  const cleaned = scientificName.replace(/\s+/g, ' ').trim();
  const withoutInfraspecies = cleaned
    .replace(/\b(subsp\.?|ssp\.?|var\.?|forma|f\.)\s+\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const binomial = withoutInfraspecies.split(' ').slice(0, 2).join(' ').trim();

  return [...new Set([cleaned, withoutInfraspecies, binomial].filter(Boolean))];
}

function normalizeTaxonName(value) {
  return (value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function searchTaxon(scientificName) {
  if (taxonCache.has(scientificName)) {
    return taxonCache.get(scientificName);
  }

  const queries = buildSearchQueries(scientificName);

  for (const query of queries) {
    try {
      const res = await fetch(
        `${INATURALIST_API}/taxa?q=${encodeURIComponent(query)}&per_page=5`
      );

      if (!res.ok) continue;

      const data = await res.json();
      const results = data.results || [];
      if (!results.length) continue;

      const normalizedQuery = normalizeTaxonName(query);
      const exactMatch = results.find((taxon) => normalizeTaxonName(taxon.name) === normalizedQuery);

      const bestMatch = exactMatch || results[0];
      taxonCache.set(scientificName, bestMatch);
      return bestMatch;
    } catch (error) {
      console.error(`   ⚠️  Erreur API (${query}):`, error.message);
    }
  }

  taxonCache.set(scientificName, null);
  return null;
}

async function getTaxonPhoto(taxonId) {
  if (photoCache.has(taxonId)) {
    return photoCache.get(taxonId);
  }

  try {
    const res = await fetch(
      `${INATURALIST_API}/observations?taxon_id=${taxonId}&quality_grade=research&has[]=photos&per_page=1&order=desc&order_by=votes`
    );

    if (!res.ok) {
      photoCache.set(taxonId, null);
      return null;
    }

    const data = await res.json();
    const observation = data.results?.[0];
    const photo = observation?.photos?.[0];

    if (!photo?.url) {
      photoCache.set(taxonId, null);
      return null;
    }

    const photoResult = {
      url: photo.url.replace('square', 'medium'),
      attribution: photo.attribution || `© ${observation.user?.login || 'Unknown'}`,
      license: photo.license_code || 'all-rights-reserved',
    };
    photoCache.set(taxonId, photoResult);
    return photoResult;
  } catch (error) {
    console.error('   ⚠️  Erreur récupération photo:', error.message);
    photoCache.set(taxonId, null);
    return null;
  }
}

async function detectPhotoColumn() {
  const { error } = await supabase
    .from('reference_species')
    .select('photo_url')
    .limit(1);

  return !error;
}

function getExistingPhoto(species, usePhotoColumn) {
  if (usePhotoColumn && isRemoteImageUrl(species.photo_url)) return species.photo_url;
  if (isRemoteImageUrl(species.description)) return species.description;
  return null;
}

async function moveLegacyDescriptionPhoto(species) {
  return await supabase
    .from('reference_species')
    .update({
      photo_url: species.description,
      photo_source: 'legacy_description',
    })
    .eq('id', species.id);
}

async function updateSpeciesPhoto(species, photo, usePhotoColumn) {
  const payload = usePhotoColumn
    ? {
        photo_url: photo.url,
        photo_attribution: photo.attribution,
        photo_source: 'inaturalist',
      }
    : {
        description: photo.url,
      };

  return await supabase
    .from('reference_species')
    .update(payload)
    .eq('id', species.id);
}

async function fetchSpeciesBatch(usePhotoColumn) {
  const selectFields = usePhotoColumn
    ? 'id, common_name, scientific_name, photo_url, description'
    : 'id, common_name, scientific_name, description';

  const { data, error } = await supabase
    .from('reference_species')
    .select(selectFields);

  if (error) throw error;

  const allSpecies = data || [];
  let migratedLegacy = 0;

  if (usePhotoColumn) {
    for (const species of allSpecies) {
      if (!species.photo_url && isRemoteImageUrl(species.description)) {
        const { error: migrateError } = await moveLegacyDescriptionPhoto(species);
        if (!migrateError) migratedLegacy++;
      }
    }
  }

  return {
    species: allSpecies
      .filter((species) => !getExistingPhoto(species, usePhotoColumn))
      .slice(0, BATCH_SIZE),
    migratedLegacy,
    selectFields,
  };
}

async function enrichSpecies(species, usePhotoColumn) {
  if (!species.scientific_name || species.scientific_name.trim() === '') {
    return { success: false, reason: 'no_scientific_name' };
  }

  const taxon = await searchTaxon(species.scientific_name);
  if (!taxon?.id) {
    return { success: false, reason: 'taxon_not_found' };
  }

  const photo = await getTaxonPhoto(taxon.id);
  if (!photo?.url) {
    return { success: false, reason: 'no_photo' };
  }

  const { error } = await updateSpeciesPhoto(species, photo, usePhotoColumn);
  if (error) {
    console.error('   ❌ Erreur update:', error.message);
    return { success: false, reason: 'update_error' };
  }

  return {
    success: true,
    photo_url: photo.url,
    attribution: photo.attribution,
  };
}

async function countRemaining(selectFields, usePhotoColumn) {
  const { data, error } = await supabase
    .from('reference_species')
    .select(selectFields);

  if (error) return null;

  return (data || []).filter((species) => !getExistingPhoto(species, usePhotoColumn)).length;
}

async function main() {
  console.log('\n🌿 Enrichissement des espèces avec photos iNaturalist\n');
  console.log('💰 Coût: 0 crédit');
  console.log(`⚡ Mode: ${IS_TEST ? 'TEST' : 'PRODUCTION'} (${BATCH_SIZE} espèces max)`);
  console.log('⏱️  Rate limit: 1 requête/seconde\n');

  const usePhotoColumn = await detectPhotoColumn();
  console.log(`🗂️  Stockage cible: ${usePhotoColumn ? 'photo_url' : 'description (legacy)'}`);

  const { species, migratedLegacy, selectFields } = await fetchSpeciesBatch(usePhotoColumn);

  if (migratedLegacy > 0) {
    console.log(`🔁 ${migratedLegacy} anciennes URLs migrées automatiquement`);
  }

  if (!species.length) {
    console.log('✅ Toutes les espèces ont déjà une photo.\n');
    return;
  }

  console.log(`📦 ${species.length} espèces à enrichir\n`);
  console.log('─'.repeat(70));
  console.log('');

  let enriched = 0;
  let noScientificName = 0;
  let taxonNotFound = 0;
  let noPhoto = 0;
  let errors = 0;

  const startTime = Date.now();

  for (let i = 0; i < species.length; i++) {
    const speciesItem = species[i];
    const progress = Math.round(((i + 1) / species.length) * 100);

    console.log(`[${i + 1}/${species.length}] (${progress}%) ${speciesItem.common_name}`);
    console.log(`   🔬 ${speciesItem.scientific_name || 'Pas de nom scientifique'}`);

    const result = await enrichSpecies(speciesItem, usePhotoColumn);

    if (result.success) {
      console.log(`   ✅ Photo trouvée: ${result.photo_url.substring(0, 60)}...`);
      enriched++;
    } else if (result.reason === 'no_scientific_name') {
      console.log('   ⚠️  Ignoré: pas de nom scientifique');
      noScientificName++;
    } else if (result.reason === 'taxon_not_found') {
      console.log('   ⚠️  Taxon introuvable');
      taxonNotFound++;
    } else if (result.reason === 'no_photo') {
      console.log('   ⚠️  Aucune photo disponible');
      noPhoto++;
    } else {
      console.log('   ❌ Erreur lors de la mise à jour');
      errors++;
    }

    console.log('');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  console.log('─'.repeat(70));
  console.log('\n📊 RÉSULTAT FINAL\n');
  console.log(`   ✅ Photos trouvées:          ${enriched} (${Math.round((enriched / species.length) * 100)}%)`);
  console.log(`   ⚠️  Sans nom scientifique:   ${noScientificName}`);
  console.log(`   ⚠️  Taxon introuvable:       ${taxonNotFound}`);
  console.log(`   ⚠️  Pas de photo:            ${noPhoto}`);
  console.log(`   ❌ Erreurs:                  ${errors}`);
  console.log(`\n⏱️  Durée: ${minutes}m ${seconds}s\n`);

  const remaining = await countRemaining(selectFields, usePhotoColumn);
  if (remaining == null) {
    console.log('⚠️  Impossible de calculer le nombre restant.');
    return;
  }

  if (remaining > 0) {
    console.log(`📦 Il reste ${remaining} espèces à traiter`);
    console.log('   Relance le script pour continuer.\n');
  } else {
    console.log('🎉 Toutes les espèces ont une photo.\n');
  }
}

main();
