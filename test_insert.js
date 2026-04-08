#!/usr/bin/env node
/**
 * Script de test pour identifier les problèmes d'insertion dans plant_discoveries
 * Usage: node test_insert.js
 */

// Données de test (exactement comme ce que le code envoie)
const testDiscovery = {
  user_email: 'test@test.com',
  category: 'rock',
  common_name: 'Azurite',
  scientific_name: 'Cu3(CO3)2(OH)2',
  family: 'Carbonate',
  photo_url: 'https://example.com/test.jpg',
  rarity: 'peu_commune',  // ← Valeur française
  is_edible: false,
  is_toxic: true,
  description: 'A striking deep blue copper carbonate mineral...',
  habitat: 'Found in the oxidized zones of copper ore deposits...',
  ecological_role: 'Azurite forms in the oxidized zones...',
  biodiversity_importance: 'As a copper mineral, it\'s part of the biogeochemical cycle...',
  edibility_details: 'Not edible and toxic if ingested...',
  medicinal_uses: 'No recognized medicinal uses...',
  anecdote: 'Azurite was historically used as a pigment...',
  confidence: 95,
  latitude: null,
  longitude: null,
  points_earned: 10,
  discovered_date: new Date().toISOString().split('T')[0],
};

console.log('🧪 TEST - Données qui seraient envoyées à Supabase:');
console.log(JSON.stringify(testDiscovery, null, 2));

console.log('\n📊 Vérifications:');
console.log(`✓ rarity: "${testDiscovery.rarity}" (doit être: commune, peu_commune, rare, ou legendaire)`);
console.log(`✓ category: "${testDiscovery.category}" (doit être: plant, bird, rock, fungus, tree, ou insect)`);
console.log(`✓ user_email: "${testDiscovery.user_email}"`);
console.log(`✓ points_earned: ${testDiscovery.points_earned}`);
console.log(`✓ ecological_role: ${testDiscovery.ecological_role ? 'présent' : 'manquant'}`);
console.log(`✓ biodiversity_importance: ${testDiscovery.biodiversity_importance ? 'présent' : 'manquant'}`);

console.log('\n⚠️  Colonnes qui pourraient causer des problèmes:');
if (!testDiscovery.user_id) console.log('- user_id: NULL (doit être nullable)');
if (testDiscovery.rarity && !['commune', 'peu_commune', 'rare', 'legendaire'].includes(testDiscovery.rarity)) {
  console.log(`- rarity: "${testDiscovery.rarity}" n'est pas dans les valeurs autorisées françaises!`);
}
