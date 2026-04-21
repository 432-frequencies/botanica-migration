/**
 * Enrichit les espèces de référence avec des photos depuis Wikipédia.
 *
 * Usage:
 *   source .env.local
 *   node scripts/enrich-species-wikipedia.js
 *   node scripts/enrich-species-wikipedia.js --test
 *   node scripts/enrich-species-wikipedia.js --limit=250
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables manquantes: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.');
  console.error('   Lance par exemple: source .env.local && node scripts/enrich-species-wikipedia.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const args = process.argv.slice(2);
const IS_TEST = args.includes('--test');
const LIMIT_ARG = args.find((arg) => arg.startsWith('--limit='));
const BATCH_SIZE = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : (IS_TEST ? 5 : 100);
const pageSearchCache = new Map();
const imageCache = new Map();
const commonsImageCache = new Map();

function isRemoteImageUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function buildSearchQueries(species) {
  const scientific = (species.scientific_name || '').replace(/\s+/g, ' ').trim();
  const common = (species.common_name || '').replace(/\s+/g, ' ').trim();
  const strippedScientific = scientific
    .replace(/\b(subsp\.?|ssp\.?|var\.?|forma|f\.)\s+\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const binomial = strippedScientific.split(' ').slice(0, 2).join(' ').trim();

  return [...new Set([scientific, strippedScientific, binomial, common].filter(Boolean))];
}

async function searchWikipediaPage(query, lang) {
  const cacheKey = `${lang}:${query}`;
  if (pageSearchCache.has(cacheKey)) {
    return pageSearchCache.get(cacheKey);
  }

  const baseUrl = lang === 'fr' ? 'https://fr.wikipedia.org' : 'https://en.wikipedia.org';
  const searchUrl = `${baseUrl}/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&origin=*`;

  const res = await fetch(searchUrl);
  if (!res.ok) {
    pageSearchCache.set(cacheKey, null);
    return null;
  }

  const data = await res.json();
  const pageTitle = data.query?.search?.[0]?.title || null;
  pageSearchCache.set(cacheKey, pageTitle);
  return pageTitle;
}

async function getPageMainImage(pageTitle, lang) {
  const cacheKey = `${lang}:${pageTitle}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  const baseUrl = lang === 'fr' ? 'https://fr.wikipedia.org' : 'https://en.wikipedia.org';
  const url = `${baseUrl}/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(pageTitle)}&pithumbsize=800&origin=*`;

  const res = await fetch(url);
  if (!res.ok) {
    imageCache.set(cacheKey, null);
    return null;
  }

  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) {
    imageCache.set(cacheKey, null);
    return null;
  }

  const page = Object.values(pages)[0];
  const imageUrl = page?.thumbnail?.source || null;
  imageCache.set(cacheKey, imageUrl);
  return imageUrl;
}

async function searchCommonsImage(query) {
  if (commonsImageCache.has(query)) {
    return commonsImageCache.get(query);
  }

  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=800&origin=*`;

  const res = await fetch(url);
  if (!res.ok) {
    commonsImageCache.set(query, null);
    return null;
  }

  const data = await res.json();
  const pages = Object.values(data.query?.pages || {});
  const match = pages.find((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url) || null;
  const imageUrl = match?.imageinfo?.[0]?.thumburl || match?.imageinfo?.[0]?.url || null;

  commonsImageCache.set(query, imageUrl);
  return imageUrl;
}

async function getWikipediaImage(species) {
  const queries = buildSearchQueries(species);
  const languages = ['fr', 'en'];

  for (const query of queries) {
    for (const lang of languages) {
      try {
        const pageTitle = await searchWikipediaPage(query, lang);
        if (!pageTitle) continue;

        const imageUrl = await getPageMainImage(pageTitle, lang);
        if (!imageUrl) continue;

        return {
          imageUrl,
          source: lang === 'fr' ? 'wikipedia_fr' : 'wikipedia_en',
          attribution: `Wikipedia (${lang.toUpperCase()}) - ${pageTitle}`,
        };
      } catch (error) {
        console.error(`   ⚠️  Erreur Wikipédia (${lang}/${query}):`, error.message);
      }
    }
  }

  for (const query of queries) {
    try {
      const imageUrl = await searchCommonsImage(query);
      if (!imageUrl) continue;

      return {
        imageUrl,
        source: 'wikimedia_commons',
        attribution: `Wikimedia Commons - ${query}`,
      };
    } catch (error) {
      console.error(`   ⚠️  Erreur Commons (${query}):`, error.message);
    }
  }

  return null;
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

async function updateSpeciesPhoto(species, image, usePhotoColumn) {
  const payload = usePhotoColumn
    ? {
        photo_url: image.imageUrl,
        photo_attribution: image.attribution,
        photo_source: image.source,
      }
    : {
        description: image.imageUrl,
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

  return {
    species: (data || [])
      .filter((species) => !getExistingPhoto(species, usePhotoColumn))
      .slice(0, BATCH_SIZE),
    selectFields,
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
  console.log('\n🖼️  Enrichissement des espèces avec photos Wikipédia\n');
  console.log(`⚡ Mode: ${IS_TEST ? 'TEST' : 'PRODUCTION'} (${BATCH_SIZE} espèces max)`);
  console.log('⏱️  Rate limit: 1 requête/seconde\n');

  const usePhotoColumn = await detectPhotoColumn();
  console.log(`🗂️  Stockage cible: ${usePhotoColumn ? 'photo_url' : 'description (legacy)'}`);

  const { species, selectFields } = await fetchSpeciesBatch(usePhotoColumn);

  if (!species.length) {
    console.log('✅ Toutes les espèces ont déjà une photo.\n');
    return;
  }

  console.log(`📦 ${species.length} espèces à enrichir\n`);
  console.log('─'.repeat(70));
  console.log('');

  let enriched = 0;
  let notFound = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < species.length; i++) {
    const speciesItem = species[i];
    const progress = Math.round(((i + 1) / species.length) * 100);

    console.log(`[${i + 1}/${species.length}] (${progress}%) ${speciesItem.common_name}`);
    console.log(`   🔬 ${speciesItem.scientific_name || 'Pas de nom scientifique'}`);

    const image = await getWikipediaImage(speciesItem);

    if (!image?.imageUrl) {
      console.log('   ⚠️  Aucune photo trouvée sur Wikipédia');
      notFound++;
      console.log('');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    const { error } = await updateSpeciesPhoto(speciesItem, image, usePhotoColumn);
    if (error) {
      console.log(`   ❌ Erreur update: ${error.message}`);
      errors++;
    } else {
      console.log(`   ✅ Photo trouvée: ${image.imageUrl.substring(0, 60)}...`);
      enriched++;
    }

    console.log('');
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const remaining = await countRemaining(selectFields, usePhotoColumn);

  console.log('─'.repeat(70));
  console.log('\n📊 RÉSULTAT FINAL\n');
  console.log(`   ✅ Photos trouvées:          ${enriched}`);
  console.log(`   ⚠️  Non trouvées:            ${notFound}`);
  console.log(`   ❌ Erreurs:                  ${errors}`);
  console.log(`\n⏱️  Durée: ${minutes}m ${seconds}s`);

  if (remaining === 0) {
    console.log('\n🎉 Toutes les espèces ont maintenant une photo.\n');
  } else if (remaining !== null) {
    console.log(`\n📦 Il reste ${remaining} espèces à traiter`);
    console.log('   Relance le script pour continuer.\n');
  } else {
    console.log('\n⚠️  Impossible de recompter le reliquat automatiquement.\n');
  }
}

main();
