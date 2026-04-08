/**
 * Script pour créer des ambassadeurs de test
 * Usage: node scripts/seed-ambassadors.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rejrtvrkpkopjmowzuqn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquant');
  console.error('   Ajoute-le dans .env.local ou passe-le en variable d\'environnement');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ambassadors = [
  {
    code: 'LUCDURAND',
    name: 'Luc Durand',
    contact_email: 'luc.durand@example.com',
    notes: 'Créateur YouTube nature - 50k abonnés'
  },
  {
    code: 'NATUREGIRL',
    name: 'Sarah Nature',
    contact_email: 'sarah@naturegirl.com',
    notes: 'Influenceuse Instagram - 120k followers'
  },
  {
    code: 'PLANTLOVER',
    name: 'Marc Botaniste',
    contact_email: 'marc@plantlover.fr',
    notes: 'Podcasteur botanique - 30k auditeurs'
  }
];

async function main() {
  console.log('\n🌿 Création des ambassadeurs de test\n');

  for (const ambassador of ambassadors) {
    console.log(`📝 Création : ${ambassador.code} (${ambassador.name})`);

    // Vérifier si l'ambassadeur existe déjà
    const { data: existing } = await supabase
      .from('ambassadors')
      .select('id, code')
      .eq('code', ambassador.code)
      .single();

    if (existing) {
      console.log(`   ⚠️  Ambassadeur ${ambassador.code} existe déjà (ID: ${existing.id})`);
      continue;
    }

    // Créer l'ambassadeur
    const { data: created, error: createError } = await supabase
      .from('ambassadors')
      .insert(ambassador)
      .select()
      .single();

    if (createError) {
      console.error(`   ❌ Erreur création :`, createError.message);
      continue;
    }

    console.log(`   ✅ Ambassadeur créé (ID: ${created.id})`);

    // Créer contrat initial (20% commission, durée indéfinie)
    const contract = {
      ambassador_id: created.id,
      valid_from: '2026-01-01',
      valid_until: null, // Durée indéfinie
      rate_type: 'percentage',
      rate_value: 20.00,
      grace_period_days: 30,
      notes: 'Contrat initial - 20% du MRR'
    };

    const { error: contractError } = await supabase
      .from('ambassador_contracts')
      .insert(contract);

    if (contractError) {
      console.error(`   ❌ Erreur création contrat :`, contractError.message);
    } else {
      console.log(`   ✅ Contrat créé : 20% commission, durée indéfinie\n`);
    }
  }

  // Afficher stats
  console.log('─'.repeat(60));
  console.log('\n📊 Résumé\n');

  const { data: allAmbassadors } = await supabase
    .from('ambassadors')
    .select('code, name, is_active')
    .order('created_at', { ascending: false });

  if (allAmbassadors && allAmbassadors.length > 0) {
    console.log('Ambassadeurs actifs :');
    allAmbassadors.forEach(a => {
      const status = a.is_active ? '✓' : '✗';
      console.log(`  ${status} ${a.code} - ${a.name}`);
    });
  }

  console.log('\n💡 Pour tester :');
  console.log('   1. Crée un nouveau compte sur /login');
  console.log('   2. Entre "LUCDURAND" dans le champ code ambassadeur');
  console.log('   3. Le nouveau user sera attribué à Luc Durand\n');
  console.log('📈 Pour voir les stats :');
  console.log('   SELECT * FROM ambassador_stats;\n');
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
