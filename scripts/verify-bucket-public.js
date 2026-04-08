/**
 * Vérifie que le bucket discoveries est bien public
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://rejrtvrkpkopjmowzuqn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanJ0dnJrcGtvcGptb3d6dXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTY0NDIsImV4cCI6MjA5MDk5MjQ0Mn0.nLTm6EXzcu72cJpArcX7LcuXUKVVg19mSJrxrJbLbhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🔍 Vérification du bucket "discoveries"\n');

// Test avec un path factice
const { data } = supabase.storage
  .from('discoveries')
  .getPublicUrl('test.jpg');

console.log('URL générée:');
console.log(data.publicUrl + '\n');

if (data.publicUrl.includes('/object/public/')) {
  console.log('✅ LE BUCKET EST PUBLIC!');
  console.log('   Les nouvelles photos auront des URLs permanentes.\n');
  console.log('📝 Prochaine étape:');
  console.log('   Exécute: node scripts/fix-old-photo-urls.js');
  console.log('   pour régénérer les URLs des anciennes photos.\n');
} else if (data.publicUrl.includes('/object/sign/')) {
  console.log('❌ LE BUCKET N\'EST PAS PUBLIC');
  console.log('   Les URLs générées sont temporaires et expirent!\n');
  console.log('📖 Solution (30 secondes):');
  console.log('   1. https://supabase.com/dashboard/project/rejrtvrkpkopjmowzuqn');
  console.log('   2. Menu: Storage → discoveries');
  console.log('   3. Settings (⚙️) → Cocher "Public bucket" ✅');
  console.log('   4. Save\n');
  console.log('📄 Guide détaillé: FIX_BUCKET_PUBLIC.md\n');
} else {
  console.log('⚠️  Format d\'URL inconnu');
  console.log('   Vérifie manuellement dans le Dashboard Supabase.\n');
}
