/**
 * Vérifie les photo_url dans la base de données
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://rejrtvrkpkopjmowzuqn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanJ0dnJrcGtvcGptb3d6dXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTY0NDIsImV4cCI6MjA5MDk5MjQ0Mn0.nLTm6EXzcu72cJpArcX7LcuXUKVVg19mSJrxrJbLbhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkDB() {
  console.log('🔍 Vérification des photo_url dans la DB\n');

  // Get all discoveries with photos
  const { data, error } = await supabase
    .from('plant_discoveries')
    .select('id, common_name, photo_url, created_at')
    .not('photo_url', 'is', null)
    .neq('photo_url', '')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Erreur:', error.message);
    return;
  }

  console.log(`📊 Trouvé ${data.length} découvertes avec photo_url\n`);

  if (data.length === 0) {
    console.log('⚠️  Aucune découverte avec photo_url dans la DB');
    console.log('   → Les photos dans le bucket ne sont peut-être pas liées aux découvertes');
    return;
  }

  data.forEach((d, i) => {
    console.log(`${i + 1}. ${d.common_name}`);
    console.log(`   ID: ${d.id}`);
    console.log(`   Date: ${d.created_at}`);
    console.log(`   URL: ${d.photo_url.substring(0, 120)}${d.photo_url.length > 120 ? '...' : ''}`);

    // Analyze URL type
    if (d.photo_url.includes('/object/sign/')) {
      console.log('   Type: ⚠️  SIGNED URL (expire après quelques jours)');
    } else if (d.photo_url.includes('/object/public/')) {
      console.log('   Type: ✅ PUBLIC URL (permanente)');
    } else if (d.photo_url.startsWith('data:')) {
      console.log('   Type: ❌ DATA URI (base64 - trop lourd)');
    } else {
      console.log('   Type: ❓ Autre format');
    }
    console.log('');
  });

  // Check if bucket is public
  console.log('\n💾 Vérification configuration bucket...');

  // Try to access a photo directly
  const firstPhoto = data[0];
  if (firstPhoto && firstPhoto.photo_url.includes('discoveries/')) {
    // Extract path from URL
    const match = firstPhoto.photo_url.match(/discoveries\/([^?]+)/);
    if (match) {
      const path = match[1];
      console.log(`\n🧪 Test d'accès à: ${path}`);

      // Try getPublicUrl
      const { data: publicUrlData } = supabase.storage
        .from('discoveries')
        .getPublicUrl(path);

      console.log('   getPublicUrl() retourne:');
      console.log(`   ${publicUrlData.publicUrl.substring(0, 120)}...`);

      if (publicUrlData.publicUrl.includes('/object/public/')) {
        console.log('   ✅ Le bucket est configuré comme PUBLIC');
      } else if (publicUrlData.publicUrl.includes('/object/sign/')) {
        console.log('   ⚠️  Le bucket N\'EST PAS public (retourne signed URLs)');
        console.log('   → Solution: Rendre le bucket public dans Dashboard');
      }
    }
  }
}

checkDB();
