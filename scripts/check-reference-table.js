/**
 * Vérifie si la table reference_species existe
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://rejrtvrkpkopjmowzuqn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJlanJ0dnJrcGtvcGptb3d6dXFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTY0NDIsImV4cCI6MjA5MDk5MjQ0Mn0.nLTm6EXzcu72cJpArcX7LcuXUKVVg19mSJrxrJbLbhs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTable() {
  console.log('🔍 Vérification de la table reference_species\n');

  const { data, error } = await supabase
    .from('reference_species')
    .select('*', { count: 'exact', head: true });

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.log('❌ Table "reference_species" N\'EXISTE PAS\n');
      console.log('📖 Solution:');
      console.log('   1. Ouvre Supabase SQL Editor');
      console.log('   2. Exécute le fichier: supabase_reference_species.sql');
      console.log('   3. Re-lance ce script\n');
      return false;
    } else {
      console.error('❌ Erreur:', error.message);
      return false;
    }
  }

  console.log(`✅ Table "reference_species" existe`);
  console.log(`   Nombre d'espèces: ${data || 0}\n`);

  if (data === 0) {
    console.log('ℹ️  Table vide, prête pour l\'import');
    console.log('   Exécute: node scripts/import-reference-species.js\n');
  } else {
    console.log('⚠️  Table contient déjà des données');
    console.log('   L\'import va REMPLACER toutes les espèces existantes\n');
  }

  return true;
}

checkTable();
