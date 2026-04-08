/**
 * Script d'import des espèces de référence depuis CSV vers Supabase
 * Usage: node scripts/import-reference-species.js
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration Supabase
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables d\'environnement manquantes: VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Mapping des raretés anglais → français
const RARITY_MAP = {
  'common': 'commune',
  'uncommon': 'peu_commune',
  'rare': 'rare',
  'legendary': 'legendaire',
};

async function importSpecies() {
  console.log('🚀 Import des espèces de référence...\n');

  // 1. Lire les deux CSV
  const csvFiles = [
    path.join(__dirname, '../data/especes_france_500.csv'),
    path.join(__dirname, '../data/especes_1000_autour_grandes_villes_france.csv'),
  ];

  let allRecords = [];

  for (const csvPath of csvFiles) {
    console.log(`📖 Lecture du fichier: ${csvPath}`);

    if (!fs.existsSync(csvPath)) {
      console.log(`⚠️  Fichier non trouvé, ignoré: ${csvPath}`);
      continue;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const cleanContent = csvContent.replace(/^\uFEFF/, '');

    const records = parse(cleanContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`   ✅ ${records.length} espèces lues`);
    allRecords = allRecords.concat(records);
  }

  console.log(`\n📊 Total: ${allRecords.length} espèces à importer\n`);

  // 2. Transformer les données
  const species = allRecords.map(record => ({
    common_name: record.common_name,
    scientific_name: record.scientific_name || null,
    latitude: parseFloat(record.latitude),
    longitude: parseFloat(record.longitude),
    category: record.category || 'plant',
    rarity: RARITY_MAP[record.rarity] || 'commune',
    description: null, // Peut être enrichi plus tard
  }));

  // Validation basique
  const valid = species.filter(s =>
    s.common_name &&
    !isNaN(s.latitude) &&
    !isNaN(s.longitude) &&
    s.latitude >= -90 && s.latitude <= 90 &&
    s.longitude >= -180 && s.longitude <= 180
  );

  console.log(`✅ ${valid.length} espèces valides après validation`);
  if (valid.length < species.length) {
    console.log(`⚠️  ${species.length - valid.length} espèces ignorées (données invalides)`);
  }

  // 3. Nettoyer la table existante
  console.log('\n🗑️  Nettoyage de la table reference_species...');
  const { error: deleteError } = await supabase
    .from('reference_species')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (deleteError) {
    console.error('❌ Erreur lors du nettoyage:', deleteError.message);
  } else {
    console.log('✅ Table nettoyée');
  }

  // 4. Insérer par batch de 100
  console.log('\n📦 Insertion des données...');
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('reference_species')
      .insert(batch)
      .select();

    if (error) {
      console.error(`❌ Erreur batch ${i / BATCH_SIZE + 1}:`, error.message);
    } else {
      inserted += data.length;
      const progress = Math.round((i + batch.length) / valid.length * 100);
      console.log(`  ├─ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${data.length} espèces insérées (${progress}%)`);
    }
  }

  // 5. Statistiques finales
  console.log('\n📊 Statistiques d\'import:');

  const { count, error: countError } = await supabase
    .from('reference_species')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`  ✅ Total en base: ${count} espèces`);
  }

  // Stats par catégorie
  const { data: categories } = await supabase
    .from('reference_species')
    .select('category')
    .then(res => {
      const counts = {};
      res.data?.forEach(r => counts[r.category] = (counts[r.category] || 0) + 1);
      return { data: counts };
    });

  if (categories) {
    console.log('\n  📁 Par catégorie:');
    Object.entries(categories).forEach(([cat, cnt]) => {
      console.log(`     ${cat.padEnd(10)}: ${cnt}`);
    });
  }

  // Stats par rareté
  const { data: rarities } = await supabase
    .from('reference_species')
    .select('rarity')
    .then(res => {
      const counts = {};
      res.data?.forEach(r => counts[r.rarity] = (counts[r.rarity] || 0) + 1);
      return { data: counts };
    });

  if (rarities) {
    console.log('\n  ⭐ Par rareté:');
    Object.entries(rarities).forEach(([rar, cnt]) => {
      console.log(`     ${rar.padEnd(12)}: ${cnt}`);
    });
  }

  console.log('\n✨ Import terminé avec succès!\n');
}

// Exécution
importSpecies().catch(error => {
  console.error('\n❌ Erreur fatale:', error);
  process.exit(1);
});
