import { supabase } from '@/api/supabaseClient';

/**
 * Upload une image vers Supabase Storage (bucket: discoveries).
 * Retourne l'URL publique, ou "" si échec (fallback silencieux).
 */
export async function uploadPhoto(dataUri) {
  const startTime = Date.now();
  console.group('[uploadPhoto] 📸 Upload de photo');

  try {
    // 1. Vérifier l'authentification
    console.log('1️⃣ Vérification authentification...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('❌ Erreur auth:', authError.message);
      console.groupEnd();
      return "";
    }

    if (!user) {
      console.error('❌ Utilisateur non authentifié');
      console.groupEnd();
      return "";
    }

    console.log('✅ User:', user.id);

    // 2. Convertir Data URI en Blob
    console.log('2️⃣ Conversion Data URI → Blob...');
    const blob = await fetch(dataUri).then(r => r.blob());
    const sizeKB = Math.round(blob.size / 1024);
    const sizeMB = (blob.size / 1024 / 1024).toFixed(2);

    console.log(`✅ Blob créé: ${sizeKB} KB (${sizeMB} MB)`);
    console.log(`   Type: ${blob.type}`);

    if (blob.size > 5 * 1024 * 1024) {
      console.warn('⚠️  WARNING: Image > 5MB, peut échouer');
    }

    // 3. Préparer le path
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/${Date.now()}.${ext}`;
    console.log(`3️⃣ Upload vers: discoveries/${path}`);

    // 4. Upload vers Supabase Storage
    console.log('4️⃣ Upload en cours...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('discoveries')
      .upload(path, blob, {
        contentType: blob.type,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('❌ Upload échoué:', uploadError.message);
      console.error('   Code:', uploadError.statusCode || uploadError.status);
      console.error('   Details:', uploadError);

      // Messages d'aide spécifiques
      if (uploadError.message.includes('not found') || uploadError.message.includes('Bucket not found')) {
        console.error('');
        console.error('🔴 PROBLÈME: Le bucket "discoveries" n\'existe pas !');
        console.error('   📖 Solution: Lire SUPABASE_STORAGE_SETUP.md');
        console.error('   🚀 Quick fix:');
        console.error('      1. Supabase Dashboard → Storage');
        console.error('      2. New bucket → "discoveries"');
        console.error('      3. ✅ Public bucket');
      } else if (uploadError.message.includes('policy') || uploadError.message.includes('403')) {
        console.error('');
        console.error('🔴 PROBLÈME: Permissions insuffisantes');
        console.error('   📖 Solution: Configurer les policies dans SUPABASE_STORAGE_SETUP.md');
      } else if (uploadError.message.includes('size') || uploadError.message.includes('too large')) {
        console.error('');
        console.error('🔴 PROBLÈME: Image trop lourde');
        console.error(`   Taille: ${sizeMB} MB`);
        console.error('   Solution: Réduire la qualité de la photo');
      }

      console.groupEnd();
      return "";
    }

    console.log('✅ Upload réussi:', uploadData.path);

    // 5. Récupérer l'URL publique
    console.log('5️⃣ Génération URL publique...');
    const { data: urlData } = supabase.storage
      .from('discoveries')
      .getPublicUrl(path);

    if (!urlData || !urlData.publicUrl) {
      console.error('❌ Impossible de générer l\'URL publique');
      console.groupEnd();
      return "";
    }

    const publicUrl = urlData.publicUrl;
    console.log('✅ URL publique:', publicUrl);

    // 6. Tester l'accessibilité (optionnel, quick check)
    const isAccessible = publicUrl.startsWith('http');
    console.log(`6️⃣ URL ${isAccessible ? '✅ valide' : '❌ invalide'}`);

    const duration = Date.now() - startTime;
    console.log(`⏱️  Durée totale: ${duration}ms`);
    console.groupEnd();

    return publicUrl;

  } catch (err) {
    console.error('❌ Erreur inattendue:', err.message);
    console.error('   Stack:', err.stack);
    console.groupEnd();
    return "";
  }
}
