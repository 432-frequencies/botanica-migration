# Configuration Supabase pour Botanica

## ✅ État de la migration

**Backend** : 100% migré vers Supabase
- ✅ AuthContext (Supabase Auth)
- ✅ Onboarding complet
- ✅ identifyPlant (Gemini)
- ✅ saveDiscovery (Supabase)
- ✅ uploadPhoto (Supabase Storage)
- ✅ getUserProfile (Supabase)
- ✅ Home, Profile migrés
- ✅ API iNaturalist créée

**Frontend** : Tous les fichiers principaux utilisent Supabase
- Plus aucune référence à Base44 dans le code critique

---

## 1. Configuration Supabase Database (OBLIGATOIRE)

### 1.1 Créer les tables principales

**Où :** Supabase Dashboard > SQL Editor > New query

**Étape 1 :** Copier-coller tout le contenu de `supabase_schema.sql`
- Crée : `user_profiles`, `plant_discoveries`, `user_badges`

**Étape 2 :** Copier-coller tout le contenu de `supabase_missing_tables.sql`
- Crée : `leaderboard`, `weekly_challenges`, `challenge_progress`

### 1.2 Créer le bucket Storage

**Où :** Supabase Dashboard > Storage > Create bucket

1. Nom : `discoveries`
2. Public : ✅ **OUI** (cocher "Public bucket")
3. Cliquer **Create bucket**

**Policy RLS pour le bucket :**

Dans Storage > discoveries > Policies, créer 2 policies :

**Policy 1 - Upload :**
```sql
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'discoveries' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**Policy 2 - Read :**
```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'discoveries');
```

---

## 2. Variables d'environnement Vercel

Vérifiez dans **Vercel > Settings > Environment Variables** :

### ✅ Requises (déjà configurées) :
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`

### Optionnelles (pour features avancées) :
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_ID_PRO`

---

## 3. Test complet du parcours utilisateur

### Parcours critique (MVP) :

1. **Signup/Login** : `/login`
   - ✅ Créer un compte avec email + mot de passe
   - ✅ Se connecter

2. **Onboarding** : `/onboarding`
   - ✅ Compléter les 5 étapes
   - ✅ Scanner une première plante (optionnel)
   - ✅ Finaliser l'onboarding

3. **Home** : `/home`
   - ✅ Scanner une plante
   - ✅ Voir le résultat d'identification (Gemini)
   - ✅ Photo uploadée dans Supabase Storage
   - ✅ Découverte sauvegardée
   - ✅ XP ajoutés

4. **Profile** : `/profile`
   - ✅ Voir son profil
   - ✅ Voir ses découvertes
   - ✅ Logout

### Test iNaturalist (optionnel) :

Dans n'importe quel composant frontend :

```javascript
import { searchTaxon, getTaxonPhotos } from '@/api/inaturalist';

// Après identification Gemini
const taxon = await searchTaxon('Quercus robur');
const photos = await getTaxonPhotos(taxon.taxon.id, 6);
// Afficher les photos réelles
```

---

## 4. Tables Supabase créées

Après avoir exécuté les 2 fichiers SQL, vous aurez 6 tables :

| Table | Description | RLS |
|-------|-------------|-----|
| `user_profiles` | Profils utilisateurs (XP, rank, daily limits) | ✅ |
| `plant_discoveries` | Historique des scans | ✅ |
| `user_badges` | Badges débloqués | ✅ |
| `leaderboard` | Classement global | ✅ Public read |
| `weekly_challenges` | Défis hebdomadaires | ✅ Public read |
| `challenge_progress` | Progression défis | ✅ |

---

## 5. Vérification post-migration

### Checklist :

- [ ] 6 tables créées dans Supabase
- [ ] Bucket `discoveries` créé et public
- [ ] 2 policies RLS sur le bucket
- [ ] Variables d'env sur Vercel
- [ ] Login fonctionne
- [ ] Onboarding complet
- [ ] Scan + identification fonctionnent
- [ ] Photo uploadée visible dans Storage
- [ ] Profil affiche les données
- [ ] Logout fonctionne

---

## 6. Rate Limits

### Gemini :
- Selon votre plan Google Cloud
- Modèle utilisé : `gemini-1.5-flash`

### iNaturalist :
- Max 60 requêtes/minute
- Max 10 000 requêtes/jour
- API publique (pas de clé)

### Supabase :
- Free tier : 500 MB database, 1 GB storage
- Upgrade si besoin

---

## 7. Support et debug

### Logs Vercel :
- Vercel Dashboard > Deployments > Logs
- Chercher `[identify-plant]` ou `[SCAN]`

### Logs Supabase :
- Supabase Dashboard > Logs > Postgres Logs
- Vérifier les requêtes SQL

### Console navigateur :
- Ouvrir DevTools > Console
- Chercher les erreurs API

---

## ✅ Migration terminée !

Tout le code backend et frontend est migré vers Supabase.
Il ne reste que la configuration Database + Storage à faire dans le dashboard.
