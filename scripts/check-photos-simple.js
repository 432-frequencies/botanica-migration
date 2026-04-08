/**
 * Simple check using anon key (no service role needed)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://rejrtvrkpkopjmowzuqn.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanJ0dnJrcGtvcGptb3d6dXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTY0NDIsImV4cCI6MjA5MDk5MjQ0Mn0.nLTm6EXzcu72cJpArcX7LcuXUKVVg19mSJrxrJbLbhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkPhotos() {
  console.log('🔍 Vérification rapide des photos\n');

  try {
    // Check table structure
    const { data: sample, error: sampleError } = await supabase
      .from('plant_discoveries')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Erreur:', sampleError.message);
      return;
    }

    if (sample && sample.length > 0) {
      const columns = Object.keys(sample[0]);
      console.log('📋 Colonnes présentes:', columns.join(', '));
      console.log('   photo_url présente:', columns.includes('photo_url') ? '✅' : '❌');
      console.log('   thumbnail_url présente:', columns.includes('thumbnail_url') ? '✅' : '❌');
    }

    // Count discoveries
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

    // Get sample URLs
    const { data: samples } = await supabase
      .from('plant_discoveries')
      .select('id, common_name, photo_url')
      .not('photo_url', 'is', null)
      .neq('photo_url', '')
      .order('created_at', { ascending: false })
      .limit(3);

    if (samples && samples.length > 0) {
      console.log(`\n🔗 Exemples d'URLs:`);
      samples.forEach((s, i) => {
        console.log(`\n${i + 1}. ${s.common_name}`);
        console.log(`   URL: ${s.photo_url.substring(0, 100)}...`);

        if (s.photo_url.startsWith('http')) {
          console.log('   Format: ✅ HTTP URL');
        } else if (s.photo_url.startsWith('data:')) {
          console.log('   Format: ⚠️ Data URI (base64)');
        } else {
          console.log('   Format: ❌ Invalide');
        }
      });
    } else {
      console.log('\n⚠️ Aucune découverte avec photo trouvée');
    }

    // Try to check storage bucket (may fail without service key)
    console.log('\n💾 Vérification du bucket Storage...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();

    if (bucketError) {
      console.log('   ℹ️  Impossible de lister les buckets (besoin service key)');
    } else {
      const discoveryBucket = buckets?.find(b => b.name === 'discoveries');
      if (discoveryBucket) {
        console.log('   ✅ Bucket "discoveries" existe');
        console.log(`   Public: ${discoveryBucket.public ? 'OUI ✅' : 'NON ❌'}`);
      } else {
        console.log('   ❌ Bucket "discoveries" introuvable');
      }
    }

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

checkPhotos();
