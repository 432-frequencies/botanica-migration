# Configuration Supabase pour Botanica

## 1. Exécuter les requêtes SQL manquantes

**Où :** Supabase Dashboard > SQL Editor > New query

**Copier-coller le contenu de :** `supabase_missing_tables.sql`

Cela créera 3 tables :
- `leaderboard` (classement des utilisateurs)
- `weekly_challenges` (défis hebdomadaires)
- `challenge_progress` (progression des défis)

## 2. Vérifier les tables existantes

Les tables suivantes doivent déjà exister (voir `supabase_schema.sql`) :
- `user_profiles` (profils utilisateurs, points, XP, rank)
- `user_discoveries` (historique des découvertes)
- `user_badges` (badges débloqués)

## 3. Row Level Security (RLS)

Toutes les tables ont déjà les politiques RLS activées :
- ✅ Utilisateurs peuvent lire/modifier leurs propres données
- ✅ Leaderboard public en lecture seule
- ✅ Challenges publics en lecture seule

## 4. Variables d'environnement Vercel

Vérifiez que ces variables existent dans **Vercel > Settings > Environment Variables** :

### Requises :
- `SUPABASE_URL` ✅
- `SUPABASE_ANON_KEY` ✅
- `GEMINI_API_KEY` ✅

### Optionnelles :
- `STRIPE_SECRET_KEY` (pour paiements)
- `STRIPE_PUBLISHABLE_KEY` (pour frontend)
- `STRIPE_PRICE_ID_PRO` (ID du plan PRO)

## 5. Test de la configuration

Une fois les tables créées, testez :

1. **Identification de plantes** : `/api/identify-plant`
2. **iNaturalist** : `/api/inaturalist`
3. **Profil utilisateur** : Connexion + première identification

## Rate Limits iNaturalist

L'API `/api/inaturalist` respecte les limites :
- Max 60 requêtes/minute
- Max 10 000 requêtes/jour
- Pas de clé API requise (API publique)

## Prochaines étapes

1. Ouvrir Supabase Dashboard
2. Exécuter `supabase_missing_tables.sql`
3. Vérifier que les 6 tables existent
4. Tester l'application
