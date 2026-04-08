/**
 * Script de diagnostic des photos
 * Vérifie pourquoi les photos ne s'affichent pas dans le journal
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variables manquantes: VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnose() {
  console.log('🔍 Diagnostic des photos W1LD\n');
  console.log('═'.repeat(60));

  // 1. Vérifier la structure de la table
  console.log('\n📋 1. Structure de la table plant_discoveries');
  console.log('─'.repeat(60));

  const { data: columns, error: structError } = await supabase
    .from('plant_discoveries')
    .select('*')
    .limit(1);

  if (structError) {
    console.error('❌ Erreur:', structError.message);
  } else if (columns && columns.length > 0) {
    const cols = Object.keys(columns[0]);
    console.log('✅ Colonnes présentes:', cols.join(', '));

    const hasPhotoUrl = cols.includes('photo_url');
    const hasThumbnailUrl = cols.includes('thumbnail_url');

    if (!hasPhotoUrl) console.error('❌ Colonne "photo_url" MANQUANTE');
    if (!hasThumbnailUrl) console.warn('⚠️  Colonne "thumbnail_url" manquante (optionnel)');
  }

  // 2. Compter les découvertes avec/sans photos
  console.log('\n📊 2. Statistiques des photos');
  console.log('─'.repeat(60));

  const { count: totalCount } = await supabase
    .from('plant_discoveries')
    .select('*', { count: 'exact', head: true });

  const { count: withPhotoCount } = await supabase
    .from('plant_discoveries')
    .select('*', { count: 'exact', head: true })
    .not('photo_url', 'is', null)
    .neq('photo_url', '');

  const { count: nullPhotoCount } = await supabase
    .from('plant_discoveries')
    .select('*', { count: 'exact', head: true })
    .or('photo_url.is.null,photo_url.eq.');

  console.log(`Total découvertes      : ${totalCount}`);
  console.log(`Avec photo_url rempli  : ${withPhotoCount} (${Math.round(withPhotoCount / totalCount * 100)}%)`);
  console.log(`Avec photo_url vide/null : ${nullPhotoCount} (${Math.round(nullPhotoCount / totalCount * 100)}%)`);

  if (nullPhotoCount > totalCount * 0.5) {
    console.error('\n❌ PROBLÈME CRITIQUE : Plus de 50% des découvertes n\'ont PAS de photo_url !');
    console.error('   → Les photos ne sont PAS sauvegardées dans la base de données.');
  }

  // 3. Examiner quelques URLs
  console.log('\n🔗 3. Exemples d\'URLs de photos');
  console.log('─'.repeat(60));

  const { data: samples } = await supabase
    .from('plant_discoveries')
    .select('id, common_name, photo_url, created_at')
    .not('photo_url', 'is', null)
    .neq('photo_url', '')
    .order('created_at', { ascending: false })
    .limit(5);

  if (samples && samples.length > 0) {
    samples.forEach((s, i) => {
      console.log(`\n${i + 1}. ${s.common_name}`);
      console.log(`   ID: ${s.id}`);
      console.log(`   URL: ${s.photo_url}`);
      console.log(`   Date: ${s.created_at}`);

      // Vérifier le format de l'URL
      if (s.photo_url.startsWith('http')) {
        console.log('   ✅ URL HTTP valide');
      } else if (s.photo_url.startsWith('data:')) {
        console.log('   ⚠️  URL est un Data URI (base64) - PROBLÈME : trop lourd !');
      } else {
        console.log('   ❌ Format URL invalide');
      }
    });
  } else {
    console.log('❌ Aucune découverte avec photo_url trouvée !');
  }

  // 4. Vérifier le bucket Supabase Storage
  console.log('\n💾 4. Vérification du bucket "discoveries"');
  console.log('─'.repeat(60));

  const { data: buckets, error: bucketsError } = await supabase
    .storage
    .listBuckets();

  if (bucketsError) {
    console.error('❌ Impossible de lister les buckets:', bucketsError.message);
  } else {
    const discoveryBucket = buckets.find(b => b.name === 'discoveries');

    if (discoveryBucket) {
      console.log('✅ Bucket "discoveries" existe');
      console.log(`   Public: ${discoveryBucket.public ? 'OUI ✅' : 'NON ❌ - PROBLÈME'}`);

      // Lister quelques fichiers
      const { data: files } = await supabase
        .storage
        .from('discoveries')
        .list('', { limit: 10 });

      if (files && files.length > 0) {
        console.log(`   Fichiers: ${files.length} fichiers trouvés`);
        files.slice(0, 3).forEach(f => {
          console.log(`     - ${f.name} (${Math.round(f.metadata?.size / 1024)}KB)`);
        });
      } else {
        console.log('   ⚠️  Aucun fichier dans le bucket');
      }
    } else {
      console.error('❌ Bucket "discoveries" N\'EXISTE PAS !');
      console.error('   → Les uploads de photos ÉCHOUENT silencieusement.');
      console.error('   → SOLUTION : Créer le bucket dans Supabase Dashboard');
    }
  }

  // 5. Tester un upload
  console.log('\n🧪 5. Test d\'upload');
  console.log('─'.repeat(60));

  try {
    const testData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const blob = await fetch(testData).then(r => r.blob());
    const testPath = `test-${Date.now()}.png`;

    const { data, error } = await supabase
      .storage
      .from('discoveries')
      .upload(testPath, blob, { contentType: 'image/png' });

    if (error) {
      console.error('❌ Upload échoué:', error.message);
      if (error.message.includes('not found')) {
        console.error('   → Bucket "discoveries" n\'existe pas');
      } else if (error.message.includes('policy')) {
        console.error('   → Problème de permissions (RLS ou policies)');
      }
    } else {
      console.log('✅ Upload réussi:', testPath);

      const { data: publicUrl } = supabase
        .storage
        .from('discoveries')
        .getPublicUrl(testPath);

      console.log('   URL publique:', publicUrl.publicUrl);

      // Nettoyer
      await supabase.storage.from('discoveries').remove([testPath]);
      console.log('   🗑️  Fichier test supprimé');
    }
  } catch (err) {
    console.error('❌ Erreur test upload:', err.message);
  }

  // 6. Résumé et recommandations
  console.log('\n📝 RÉSUMÉ ET RECOMMANDATIONS');
  console.log('═'.repeat(60));

  const discoveryBucket = (await supabase.storage.listBuckets()).data?.find(b => b.name === 'discoveries');

  if (!discoveryBucket) {
    console.log('\n🔴 PROBLÈME CRITIQUE #1 : Bucket "discoveries" n\'existe pas');
    console.log('   SOLUTION :');
    console.log('   1. Aller dans Supabase Dashboard → Storage');
    console.log('   2. Créer un nouveau bucket nommé "discoveries"');
    console.log('   3. Cocher "Public bucket" ✅');
    console.log('   4. Sauvegarder');
  } else if (!discoveryBucket.public) {
    console.log('\n🔴 PROBLÈME CRITIQUE #2 : Bucket "discoveries" n\'est PAS public');
    console.log('   SOLUTION :');
    console.log('   1. Aller dans Supabase Dashboard → Storage → discoveries');
    console.log('   2. Settings → Make public');
  }

  if (nullPhotoCount > totalCount * 0.5) {
    console.log('\n🔴 PROBLÈME #3 : Les photos ne sont pas uploadées');
    console.log('   CAUSES POSSIBLES :');
    console.log('   - uploadPhoto() échoue silencieusement');
    console.log('   - Bucket n\'existe pas (voir ci-dessus)');
    console.log('   - Images trop lourdes (>5MB)');
    console.log('   SOLUTION :');
    console.log('   - Vérifier les logs console navigateur lors d\'un scan');
    console.log('   - Tester avec une petite image (<1MB)');
  }

  console.log('\n✨ Diagnostic terminé\n');
}

diagnose().catch(err => {
  console.error('\n❌ Erreur fatale:', err);
  process.exit(1);
});
