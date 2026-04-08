/**
 * Régénère les URLs publiques pour les anciennes photos
 * À exécuter APRÈS avoir rendu le bucket public
 *
 * Usage: node scripts/fix-old-photo-urls.js
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://rejrtvrkpkopjmowzuqn.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanJ0dnJrcGtvcGptb3d6dXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTY0NDIsImV4cCI6MjA5MDk5MjQ0Mn0.nLTm6EXzcu72cJpArcX7LcuXUKVVg19mSJrxrJbLbhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixPhotoUrls() {
  console.log('🔧 Régénération des URLs publiques...\n');

  try {
    // 1. Trouver toutes les découvertes avec signed URLs
    const { data: discoveries, error } = await supabase
      .from('plant_discoveries')
      .select('id, common_name, photo_url')
      .not('photo_url', 'is', null)
      .neq('photo_url', '')
      .like('photo_url', '%/object/sign/%');

    if (error) {
      console.error('❌ Erreur:', error.message);
      return;
    }

    if (!discoveries || discoveries.length === 0) {
      console.log('✅ Aucune signed URL trouvée! Toutes les photos sont déjà publiques.');
      return;
    }

    console.log(`📊 Trouvé ${discoveries.length} découvertes avec signed URLs\n`);

    let fixed = 0;
    let failed = 0;

    for (const disc of discoveries) {
      try {
        // Extraire le path depuis l'URL signée
        const match = disc.photo_url.match(/discoveries\/([^?]+)/);
        if (!match) {
          console.log(`⚠️  ${disc.common_name}: Impossible d'extraire le path`);
          failed++;
          continue;
        }

        const path = match[1];

        // Générer la nouvelle URL publique
        const { data: publicUrlData } = supabase.storage
          .from('discoveries')
          .getPublicUrl(path);

        if (!publicUrlData || !publicUrlData.publicUrl) {
          console.log(`⚠️  ${disc.common_name}: Impossible de générer URL publique`);
          failed++;
          continue;
        }

        // Vérifier que c'est bien une URL publique (pas signée)
        if (publicUrlData.publicUrl.includes('/object/sign/')) {
          console.log(`❌ ${disc.common_name}: Le bucket n'est PAS encore public!`);
          console.log('   → Rends d\'abord le bucket public dans le Dashboard\n');
          return;
        }

        // Mettre à jour la découverte
        const { error: updateError } = await supabase
          .from('plant_discoveries')
          .update({ photo_url: publicUrlData.publicUrl })
          .eq('id', disc.id);

        if (updateError) {
          console.log(`⚠️  ${disc.common_name}: Erreur update - ${updateError.message}`);
          failed++;
        } else {
          console.log(`✅ ${disc.common_name}`);
          fixed++;
        }

      } catch (e) {
        console.log(`⚠️  ${disc.common_name}: ${e.message}`);
        failed++;
      }
    }

    console.log(`\n📊 Résumé:`);
    console.log(`   ✅ Corrigées: ${fixed}`);
    console.log(`   ⚠️  Échouées: ${failed}`);
    console.log(`   📈 Total: ${discoveries.length}`);

    if (fixed > 0) {
      console.log('\n✨ Les photos devraient maintenant s\'afficher dans le journal!\n');
    }

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

// Vérifier d'abord que le bucket est public
async function checkBucketPublic() {
  console.log('🔍 Vérification du bucket...\n');

  // Test avec un path quelconque
  const { data } = supabase.storage
    .from('discoveries')
    .getPublicUrl('test.jpg');

  if (data.publicUrl.includes('/object/public/')) {
    console.log('✅ Le bucket est PUBLIC\n');
    return true;
  } else {
    console.log('❌ Le bucket N\'EST PAS public!\n');
    console.log('📖 Solution:');
    console.log('   1. Dashboard Supabase → Storage → discoveries');
    console.log('   2. Settings → Cocher "Public bucket"');
    console.log('   3. Re-exécuter ce script\n');
    return false;
  }
}

async function main() {
  const isPublic = await checkBucketPublic();
  if (!isPublic) {
    process.exit(1);
  }

  await fixPhotoUrls();
}

main();
