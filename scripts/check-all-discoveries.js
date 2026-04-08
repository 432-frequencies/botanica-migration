/**
 * Vérifie toutes les découvertes dans la DB
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://rejrtvrkpkopjmowzuqn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanJ0dnJrcGtvcGptb3d6dXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTY0NDIsImV4cCI6MjA5MDk5MjQ0Mn0.nLTm6EXzcu72cJpArcX7LcuXUKVVg19mSJrxrJbLbhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDiscoveries() {
  console.log('🔍 Vérification des découvertes\n');

  // Count total
  const { count: total, error } = await supabase
    .from('plant_discoveries')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }

  console.log(`📊 Total découvertes: ${total}\n`);

  if (total === 0) {
    console.log('⚠️  Aucune découverte trouvée!');
    console.log('\nPossibilités:');
    console.log('   1. L\'app n\'a jamais été utilisée pour scanner');
    console.log('   2. Les scans sont dans une autre base/environnement');
    console.log('   3. Les découvertes ont été supprimées');
    console.log('\n💡 Teste en scannant une plante dans l\'app!\n');
    return;
  }

  // Get samples
  const { data: samples } = await supabase
    .from('plant_discoveries')
    .select('id, user_email, common_name, photo_url, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('📋 Dernières découvertes:\n');
  samples.forEach((d, i) => {
    console.log(`${i + 1}. ${d.common_name}`);
    console.log(`   User: ${d.user_email}`);
    console.log(`   Date: ${d.created_at}`);
    console.log(`   Photo: ${d.photo_url ? '✅ OUI' : '❌ NON'}`);
    if (d.photo_url) {
      const isPublic = d.photo_url.includes('/object/public/');
      const isSigned = d.photo_url.includes('/object/sign/');
      console.log(`   Type: ${isPublic ? '✅ Public' : isSigned ? '⚠️ Signed (expire)' : '❓ Autre'}`);
    }
    console.log('');
  });

  // Count by photo status
  const { count: withPhoto } = await supabase
    .from('plant_discoveries')
    .select('*', { count: 'exact', head: true })
    .not('photo_url', 'is', null)
    .neq('photo_url', '');

  const { count: withPublicUrl } = await supabase
    .from('plant_discoveries')
    .select('*', { count: 'exact', head: true })
    .like('photo_url', '%/object/public/%');

  const { count: withSignedUrl } = await supabase
    .from('plant_discoveries')
    .select('*', { count: 'exact', head: true })
    .like('photo_url', '%/object/sign/%');

  console.log('📊 Statistiques photos:');
  console.log(`   Total: ${total}`);
  console.log(`   Avec photo: ${withPhoto} (${Math.round(withPhoto/total*100)}%)`);
  console.log(`   URLs publiques: ${withPublicUrl} (${Math.round(withPublicUrl/total*100)}%)`);
  console.log(`   URLs signées (expire): ${withSignedUrl} (${Math.round(withSignedUrl/total*100)}%)`);
  console.log(`   Sans photo: ${total - withPhoto} (${Math.round((total-withPhoto)/total*100)}%)\n`);

  if (withSignedUrl > 0) {
    console.log('⚠️  Tu as des URLs signées qui vont expirer!');
    console.log('   Exécute: node scripts/fix-old-photo-urls.js\n');
  }
}

checkDiscoveries();
