/**
 * Vérifie si le RLS est activé sur reference_species
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://rejrtvrkpkopjmowzuqn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanJ0dnJrcGtvcGptb3d6dXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTY0NDIsImV4cCI6MjA5MDk5MjQ0Mn0.nLTm6EXzcu72cJpArcX7LcuXUKVVg19mSJrxrJbLbhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRLS() {
  console.log('🔒 Test d\'insertion pour vérifier le RLS\n');

  // Tenter une insertion test
  const testSpecies = {
    common_name: 'TEST_SPECIES_DELETE_ME',
    scientific_name: 'Testus speciesus',
    latitude: 48.8566,
    longitude: 2.3522,
    category: 'plant',
    rarity: 'commune'
  };

  const { data, error } = await supabase
    .from('reference_species')
    .insert(testSpecies)
    .select();

  if (error) {
    if (error.message.includes('policy') || error.code === '42501') {
      console.log('❌ RLS EST ACTIVÉ - Les insertions sont bloquées\n');
      console.log('📖 Solution:');
      console.log('   1. Supabase SQL Editor');
      console.log('   2. Exécuter: ALTER TABLE reference_species DISABLE ROW LEVEL SECURITY;\n');
      return false;
    } else {
      console.error('❌ Autre erreur:', error.message);
      return false;
    }
  }

  console.log('✅ RLS DÉSACTIVÉ - Les insertions fonctionnent\n');

  // Nettoyer l'espèce test
  if (data && data[0]) {
    await supabase
      .from('reference_species')
      .delete()
      .eq('id', data[0].id);
    console.log('🗑️  Espèce test supprimée\n');
  }

  console.log('✅ Prêt pour l\'import!\n');
  return true;
}

checkRLS();
