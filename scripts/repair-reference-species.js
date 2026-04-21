/**
 * Répare les lignes corrompues de reference_species à partir d'une taxonomie canonique.
 *
 * Usage:
 *   set -a && source .env.local && set +a && node scripts/repair-reference-species.js
 */

import { createClient } from '@supabase/supabase-js';
import { isReferenceSpeciesSuspicious, repairReferenceSpeciesRecord } from '../src/lib/referenceTaxonomy.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function getSelectFields(usePhotoColumn) {
  return usePhotoColumn
    ? 'id, common_name, scientific_name, category, rarity, latitude, longitude, description, photo_url'
    : 'id, common_name, scientific_name, category, rarity, latitude, longitude, description';
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

function getExistingPhoto(record, usePhotoColumn) {
  if (usePhotoColumn && isRemoteImageUrl(record.photo_url)) return record.photo_url;
  if (isRemoteImageUrl(record.description)) return record.description;
  return null;
}

function buildTrustedPhotoLookup(rows, usePhotoColumn) {
  const byScientific = new Map();
  const byCommon = new Map();

  for (const row of rows) {
    const repaired = repairReferenceSpeciesRecord(row);
    const photoUrl = getExistingPhoto(row, usePhotoColumn);
    if (!photoUrl || isReferenceSpeciesSuspicious(row)) continue;

    const scientificKey = normalizeKey(repaired.scientific_name);
    const commonKey = normalizeKey(repaired.common_name);
    if (scientificKey && !byScientific.has(scientificKey)) byScientific.set(scientificKey, photoUrl);
    if (commonKey && !byCommon.has(commonKey)) byCommon.set(commonKey, photoUrl);
  }

  return { byScientific, byCommon };
}

function buildUpdatePayload(row, repaired, trustedPhotos, usePhotoColumn) {
  const payload = {};
  const nextPhoto =
    trustedPhotos.byScientific.get(normalizeKey(repaired.scientific_name)) ||
    trustedPhotos.byCommon.get(normalizeKey(repaired.common_name)) ||
    getExistingPhoto(row, usePhotoColumn);

  if ((row.common_name || null) !== (repaired.common_name || null)) {
    payload.common_name = repaired.common_name || null;
  }

  if ((row.scientific_name || null) !== (repaired.scientific_name || null)) {
    payload.scientific_name = repaired.scientific_name || null;
  }

  if ((row.category || null) !== (repaired.category || null)) {
    payload.category = repaired.category || null;
  }

  if (nextPhoto && nextPhoto !== getExistingPhoto(row, usePhotoColumn)) {
    if (usePhotoColumn) {
      payload.photo_url = nextPhoto;
    } else {
      payload.description = nextPhoto;
    }
  }

  return payload;
}

async function main() {
  console.log('\n🧬 Réparation des espèces de référence\n');
  const usePhotoColumn = await detectPhotoColumn();
  const selectFields = getSelectFields(usePhotoColumn);

  console.log(`🗂️  Colonnes photo dédiées: ${usePhotoColumn ? 'oui' : 'non, fallback description'}`);

  const rows = await fetchAllReferenceSpecies(selectFields);

  console.log(`📚 ${rows.length} ligne(s) chargée(s)`);

  const trustedPhotos = buildTrustedPhotoLookup(rows || [], usePhotoColumn);
  const updates = [];

  for (const row of rows || []) {
    const repaired = repairReferenceSpeciesRecord(row);
    const payload = buildUpdatePayload(row, repaired, trustedPhotos, usePhotoColumn);

    if (Object.keys(payload).length > 0) {
      updates.push({ id: row.id, payload, before: row, after: repaired });
    }
  }

  console.log(`🔍 ${updates.length} ligne(s) à corriger`);

  if (!updates.length) {
    console.log('✅ Aucune correction nécessaire.\n');
    return;
  }

  let updated = 0;
  for (const [index, item] of updates.entries()) {
    const { error: updateError } = await supabase
      .from('reference_species')
      .update(item.payload)
      .eq('id', item.id);

    if (updateError) {
      console.error(`   ❌ ${index + 1}/${updates.length} ${item.before.common_name}: ${updateError.message}`);
      continue;
    }

    updated += 1;
    console.log(`   ✅ ${index + 1}/${updates.length} ${item.before.common_name} -> ${item.after.common_name}`);
  }

  console.log(`\n✨ ${updated}/${updates.length} ligne(s) réparée(s).\n`);
}

main().catch((error) => {
  console.error('❌ Réparation interrompue:', error);
  process.exit(1);
});
