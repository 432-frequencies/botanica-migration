/**
 * Import des espèces de référence (version simplifiée sans service key)
 * Usage: node scripts/import-reference-species-simple.js
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration Supabase (anon key)
const SUPABASE_URL = "https://rejrtvrkpkopjmowzuqn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanJ0dnJrcGtvcGptb3d6dXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTY0NDIsImV4cCI6MjA5MDk5MjQ0Mn0.nLTm6EXzcu72cJpArcX7LcuXUKVVg19mSJrxrJbLbhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Mapping des raretés anglais → français
const RARITY_MAP = {
  'common': 'commune',
  'uncommon': 'peu_commune',
  'rare': 'rare',
  'legendary': 'legendaire',
};

async function importSpecies() {
  console.log('🚀 Import des espèces de référence...\n');

  // 1. Lire les trois CSV
  const csvFiles = [
    path.join(__dirname, '../data/especes_france_500.csv'),
    path.join(__dirname, '../data/especes_1000_autour_grandes_villes_france.csv'),
    path.join(__dirname, '../data/especes_urbaines_parcs_1000.csv'),
  ];

  let allRecords = [];

  for (const csvPath of csvFiles) {
    console.log(`📖 Lecture: ${path.basename(csvPath)}`);

    if (!fs.existsSync(csvPath)) {
      console.log(`⚠️  Fichier non trouvé, ignoré`);
      continue;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const cleanContent = csvContent.replace(/^\uFEFF/, ''); // Remove BOM

    const records = parse(cleanContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`   ✅ ${records.length} espèces lues`);
    allRecords = allRecords.concat(records);
  }

  console.log(`\n📊 Total: ${allRecords.length} espèces à importer`);
  console.log(`   📁 500 espèces France`);
  console.log(`   📁 1000 espèces grandes villes`);
  console.log(`   📁 1000 espèces urbaines/parcs\n`);

  // 2. Transformer les données
  const species = allRecords.map(record => ({
    common_name: record.common_name,
    scientific_name: record.scientific_name || null,
    latitude: parseFloat(record.latitude),
    longitude: parseFloat(record.longitude),
    category: record.category || 'plant',
    rarity: RARITY_MAP[record.rarity] || 'commune',
    description: null,
  }));

  // Validation
  const valid = species.filter(s =>
    s.common_name &&
    !isNaN(s.latitude) &&
    !isNaN(s.longitude) &&
    s.latitude >= -90 && s.latitude <= 90 &&
    s.longitude >= -180 && s.longitude <= 180
  );

  console.log(`✅ ${valid.length} espèces valides`);
  if (valid.length < species.length) {
    console.log(`⚠️  ${species.length - valid.length} espèces ignorées (invalides)`);
  }

  // 3. Vérifier la table actuelle
  const { count: currentCount } = await supabase
    .from('reference_species')
    .select('*', { count: 'exact', head: true });

  if (currentCount && currentCount > 0) {
    console.log(`\n⚠️  La table contient déjà ${currentCount} espèces`);
    console.log('   Cet import va AJOUTER les nouvelles espèces (pas de remplacement)');
    console.log('   Pour nettoyer d\'abord, utilise le SQL Editor Supabase\n');
  }

  // 4. Insérer par batch de 100
  console.log('\n📦 Insertion des données...');
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('reference_species')
      .insert(batch)
      .select();

    if (error) {
      console.error(`  ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      errors++;
    } else {
      inserted += data.length;
      const progress = Math.round((i + batch.length) / valid.length * 100);
      console.log(`  ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(valid.length / BATCH_SIZE)}: ${data.length} espèces (${progress}%)`);
    }
  }

  // 5. Statistiques finales
  console.log('\n📊 Résultat:');
  console.log(`   Insérées: ${inserted}`);
  console.log(`   Erreurs: ${errors}`);

  const { count: finalCount } = await supabase
    .from('reference_species')
    .select('*', { count: 'exact', head: true });

  console.log(`   Total en base: ${finalCount}\n`);

  // Stats par catégorie
  const { data: byCategory } = await supabase
    .from('reference_species')
    .select('category');

  if (byCategory) {
    const counts = {};
    byCategory.forEach(r => counts[r.category] = (counts[r.category] || 0) + 1);

    console.log('📁 Par catégorie:');
    Object.entries(counts).forEach(([cat, cnt]) => {
      console.log(`   ${cat.padEnd(10)}: ${cnt}`);
    });
  }

  // Stats par rareté
  const { data: byRarity } = await supabase
    .from('reference_species')
    .select('rarity');

  if (byRarity) {
    const counts = {};
    byRarity.forEach(r => counts[r.rarity] = (counts[r.rarity] || 0) + 1);

    console.log('\n⭐ Par rareté:');
    Object.entries(counts).forEach(([rar, cnt]) => {
      console.log(`   ${rar.padEnd(12)}: ${cnt}`);
    });
  }

  console.log('\n✨ Import terminé!\n');
}

// Exécution
importSpecies().catch(error => {
  console.error('\n❌ Erreur:', error.message);
  process.exit(1);
});
