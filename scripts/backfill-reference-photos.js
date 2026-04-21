/**
 * Backfill des photos manquantes dans reference_species via l'API publique iNaturalist.
 *
 * Usage:
 *   set -a && source .env.local && set +a && node scripts/backfill-reference-photos.js
 */

import { createClient } from '@supabase/supabase-js';
import { repairReferenceSpeciesRecord } from '../src/lib/referenceTaxonomy.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const INATURALIST_API = 'https://api.inaturalist.org/v1';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables manquantes: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function isRemoteImageUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

async function detectPhotoColumn() {
  const { error } = await supabase
    .from('reference_species')
    .select('photo_url')
    .limit(1);

  return !error;
}

async function fetchAllReferenceSpecies(selectFields) {
  const pageSize = 1000;
  let from = 0;
  let allRows = [];

  while (true) {
    const { data, error } = await supabase
      .from('reference_species')
      .select(selectFields)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data?.length) break;

    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

function getExistingPhoto(row, usePhotoColumn) {
  if (usePhotoColumn && isRemoteImageUrl(row.photo_url)) return row.photo_url;
  if (isRemoteImageUrl(row.description)) return row.description;
  return null;
}

async function searchTaxon(query) {
  const res = await fetch(`${INATURALIST_API}/taxa?q=${encodeURIComponent(query)}&per_page=1`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.results?.[0] || null;
}

async function fetchPhotoForTaxon(taxonId) {
  const res = await fetch(
    `${INATURALIST_API}/observations?taxon_id=${taxonId}&quality_grade=research&has[]=photos&per_page=1&order=desc&order_by=votes`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const photo = data.results?.[0]?.photos?.[0];
  if (!photo?.url) return null;
  return photo.url.replace('square', 'medium');
}

function buildGroups(rows, usePhotoColumn) {
  const groups = new Map();

  for (const row of rows) {
    if (getExistingPhoto(row, usePhotoColumn)) continue;
    const repaired = repairReferenceSpeciesRecord(row);
    const key = normalizeKey(repaired.scientific_name || repaired.common_name || row.id);
    const group = groups.get(key) || {
      key,
      query: repaired.scientific_name || repaired.common_name,
      common_name: repaired.common_name,
      scientific_name: repaired.scientific_name,
      ids: [],
    };
    group.ids.push(row.id);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => b.ids.length - a.ids.length);
}

async function updateRows(group, photoUrl, usePhotoColumn) {
  const payload = usePhotoColumn
    ? { photo_url: photoUrl }
    : { description: photoUrl };

  const { error } = await supabase
    .from('reference_species')
    .update(payload)
    .in('id', group.ids);

  if (error) throw error;
}

async function main() {
  console.log('\n🖼️  Backfill des photos de référence\n');

  const usePhotoColumn = await detectPhotoColumn();
  const selectFields = usePhotoColumn
    ? 'id, common_name, scientific_name, description, photo_url'
    : 'id, common_name, scientific_name, description';

  const rows = await fetchAllReferenceSpecies(selectFields);
  const groups = buildGroups(rows, usePhotoColumn);

  console.log(`📚 ${rows.length} ligne(s) chargée(s)`);
  console.log(`🔎 ${groups.length} taxon(s) avec photo manquante`);

  let updatedGroups = 0;
  let updatedRows = 0;

  for (const [index, group] of groups.entries()) {
    if (!group.query) continue;

    try {
      const taxon = await searchTaxon(group.query);
      if (!taxon?.id) {
        console.log(`   ⚪ ${index + 1}/${groups.length} ${group.common_name}: aucun taxon trouvé`);
        continue;
      }

      const photoUrl = await fetchPhotoForTaxon(taxon.id);
      if (!photoUrl) {
        console.log(`   ⚪ ${index + 1}/${groups.length} ${group.common_name}: aucune photo trouvée`);
        continue;
      }

      await updateRows(group, photoUrl, usePhotoColumn);
      updatedGroups += 1;
      updatedRows += group.ids.length;
      console.log(`   ✅ ${index + 1}/${groups.length} ${group.common_name}: ${group.ids.length} ligne(s)`);
    } catch (error) {
      console.log(`   ❌ ${index + 1}/${groups.length} ${group.common_name}: ${error.message}`);
    }
  }

  console.log(`\n✨ ${updatedGroups}/${groups.length} taxon(s) enrichi(s), ${updatedRows} ligne(s) mises à jour.\n`);
}

main().catch((error) => {
  console.error('❌ Backfill interrompu:', error);
  process.exit(1);
});
