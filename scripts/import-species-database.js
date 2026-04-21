/**
 * Script d'import des espèces de référence W1LD
 * Import du CSV PlantDiscovery_export.csv vers Supabase
 *
 * Usage: node scripts/import-species-database.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_KEY';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || SUPABASE_URL.includes('YOUR')) {
  console.error('❌ Configurer SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Parse CSV simple (sans dépendance externe)
 */
function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const headers = parseCSVLine(lines[0]);

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = parseCSVLine(lines[i]);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    data.push(row);
  }

  return data;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map(v => v.replace(/^"|"$/g, '').trim());
}

/**
 * Nettoie et normalise les données
 */
function normalizeSpecies(row) {
  // Skip les lignes de test
  if (row.common_name === 'Test Plant' || !row.scientific_name) {
    return null;
  }

  return {
    scientific_name: row.scientific_name,
    common_name: row.common_name,
    family: row.family || 'Unknown',
    category: row.category || 'plant',
    rarity: row.rarity || 'commune',
    habitat: row.habitat || '',
    description: row.description || '',
    behavior: row.behavior || '',
    anecdote: row.anecdote || '',
    photo_url: row.photo_url || '',
    thumbnail_url: row.thumbnail_url || row.photo_url || '',
    is_edible: row.is_edible === 'true',
    is_toxic: row.is_toxic === 'true',
    edibility_details: row.edibility_details || '',
    medicinal_uses: row.medicinal_uses || '',
    latitude: parseFloat(row.latitude) || null,
    longitude: parseFloat(row.longitude) || null,
    location_name: row.location_name || '',
    biome: row.biome || 'inconnu',
    confidence: parseInt(row.confidence) || 95,
    // Métadonnées
    source: 'reference_database',
    is_verified: true,
    created_at: new Date().toISOString()
  };
}

/**
 * Import vers Supabase
 */
async function importSpecies() {
  console.log('🌿 W1LD Species Database Import\n');

  // Lire le CSV
  const csvPath = path.join(__dirname, '../..', 'Downloads', 'PlantDiscovery_export.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV not found: ${csvPath}`);
    console.log('💡 Placer PlantDiscovery_export.csv dans /Users/sam/Downloads/');
    process.exit(1);
  }

  console.log(`📁 Reading CSV: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const rawData = parseCSV(csvContent);

  console.log(`📊 Parsed ${rawData.length} rows\n`);

  // Normaliser les données
  const species = rawData
    .map(normalizeSpecies)
    .filter(s => s !== null);

  console.log(`✅ ${species.length} valid species found\n`);

  // Créer la table si elle n'existe pas (optionnel)
  console.log('📝 Table structure (reference_species):');
  console.log('  - scientific_name (text, unique)');
  console.log('  - common_name (text)');
  console.log('  - family (text)');
  console.log('  - category (text)');
  console.log('  - rarity (text)');
  console.log('  - latitude, longitude (float)');
  console.log('  - habitat, description, behavior, anecdote (text)');
  console.log('  - photo_url, thumbnail_url (text)');
  console.log('  - is_edible, is_toxic, is_verified (boolean)\n');

  // Stats par catégorie
  const stats = species.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {});

  console.log('📊 Species by category:');
  Object.entries(stats).forEach(([cat, count]) => {
    const emoji = {
      plant: '🌿',
      bird: '🦜',
      fungus: '🍄',
      tree: '🌳',
      insect: '🦗',
      rock: '💎',
      arachnid: '🕷️'
    }[cat] || '❓';
    console.log(`  ${emoji} ${cat}: ${count}`);
  });

  console.log('\n⏳ Importing to Supabase...\n');

  // Import par batch (évite timeout)
  const BATCH_SIZE = 10;
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < species.length; i += BATCH_SIZE) {
    const batch = species.slice(i, i + BATCH_SIZE);

    for (const sp of batch) {
      try {
        // Vérifier si existe déjà
        const { data: existing } = await supabase
          .from('reference_species')
          .select('scientific_name')
          .eq('scientific_name', sp.scientific_name)
          .single();

        if (existing) {
          console.log(`⏭️  Skip: ${sp.common_name} (already exists)`);
          skipped++;
          continue;
        }

        // Insert
        const { error } = await supabase
          .from('reference_species')
          .insert([sp]);

        if (error) throw error;

        imported++;
        console.log(`✅ ${imported}/${species.length} - ${sp.common_name} (${sp.scientific_name})`);

      } catch (error) {
        errors++;
        console.error(`❌ Error importing ${sp.common_name}:`, error.message);
      }
    }
  }

  console.log('\n📊 Import Summary:');
  console.log(`  ✅ Imported: ${imported}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Errors: ${errors}`);
  console.log(`  📦 Total: ${species.length}\n`);

  console.log('🎉 Import complete!\n');
  console.log('💡 Next steps:');
  console.log('  1. Verify data in Supabase dashboard');
  console.log('  2. Create indexes on scientific_name, category, rarity');
  console.log('  3. Update Ghost Species system to use reference_species table\n');
}

// Run
importSpecies().catch(console.error);
