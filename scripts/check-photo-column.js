/**
 * Vérifie que la colonne photo_url existe dans plant_discoveries
 * Et l'ajoute si nécessaire
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables manquantes');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkColumn() {
  console.log('🔍 Vérification de la colonne photo_url\n');

  // Test: Insérer puis lire
  try {
    const { data, error } = await supabase
      .from('plant_discoveries')
      .select('photo_url, thumbnail_url')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.error('❌ Colonne photo_url manquante !');
        console.log('\n📝 SQL à exécuter dans Supabase SQL Editor:\n');
        console.log('ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS photo_url TEXT;');
        console.log('ALTER TABLE plant_discoveries ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;');
        console.log('\n');
        process.exit(1);
      } else {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
      }
    }

    console.log('✅ Colonnes présentes:');
    console.log('   - photo_url ✅');
    console.log('   - thumbnail_url ✅');

    // Stats
    const { count: total } = await supabase
      .from('plant_discoveries')
      .select('*', { count: 'exact', head: true });

    const { count: withPhoto } = await supabase
      .from('plant_discoveries')
      .select('*', { count: 'exact', head: true })
      .not('photo_url', 'is', null)
      .neq('photo_url', '');

    console.log(`\n📊 Statistiques:`);
    console.log(`   Total: ${total}`);
    console.log(`   Avec photo: ${withPhoto} (${Math.round(withPhoto / total * 100)}%)`);
    console.log(`   Sans photo: ${total - withPhoto} (${Math.round((total - withPhoto) / total * 100)}%)`);

    if (withPhoto === 0 && total > 0) {
      console.log('\n⚠️  AUCUNE photo trouvée !');
      console.log('   Causes possibles:');
      console.log('   1. Bucket Supabase pas configuré → Lire SUPABASE_STORAGE_SETUP.md');
      console.log('   2. uploadPhoto() échoue → Vérifier logs console browser');
      console.log('   3. Les scans datent d\'avant la mise en place du système');
    }

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }

  console.log('\n✅ Vérification terminée\n');
}

checkColumn();
