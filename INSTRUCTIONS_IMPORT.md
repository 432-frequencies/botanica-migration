# 🚀 Instructions d'Import - Zone Explorer

## ⚡ Quick Start (3 commandes)

```bash
# 1. Créer la table dans Supabase
# → Copier le contenu de supabase_reference_species.sql dans Supabase SQL Editor

# 2. Vérifier que SUPABASE_SERVICE_ROLE_KEY est dans .env
cat .env | grep SUPABASE_SERVICE_ROLE_KEY

# 3. Importer les 500 espèces
node scripts/import-reference-species.js
```

---

## 📝 Détails Étape par Étape

### 1️⃣ Créer la Table Supabase

**Option A : Via SQL Editor (recommandé)**
1. Aller sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionner votre projet
3. Aller dans **SQL Editor**
4. Ouvrir `supabase_reference_species.sql` dans un éditeur
5. Copier tout le contenu
6. Coller dans SQL Editor
7. Cliquer **Run**

**Option B : Via CLI Supabase**
```bash
supabase db push supabase_reference_species.sql
```

### 2️⃣ Configurer les Variables d'Environnement

Vérifier que `.env` contient :
```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANT** : Utiliser la **Service Role Key** (pas l'anon key)

Pour la trouver :
1. Supabase Dashboard → **Settings** → **API**
2. Section **Project API keys**
3. Copier `service_role` (secret, ne jamais exposer côté client)

### 3️⃣ Installer les Dépendances

```bash
npm install csv-parse
```

### 4️⃣ Exécuter l'Import

```bash
node scripts/import-reference-species.js
```

**Durée estimée** : ~10 secondes

---

## ✅ Vérification

### Test 1 : Table créée
```sql
SELECT COUNT(*) FROM reference_species;
-- Résultat attendu: 500
```

### Test 2 : Données présentes
```sql
SELECT category, COUNT(*)
FROM reference_species
GROUP BY category;
```

### Test 3 : Géolocalisation fonctionnelle
```sql
SELECT common_name, latitude, longitude
FROM reference_species
WHERE latitude BETWEEN 48.8 AND 48.9
  AND longitude BETWEEN 2.3 AND 2.4
LIMIT 5;
```

### Test 4 : App fonctionne
1. Lancer : `npm run dev`
2. Aller sur `/TerritorialMap`
3. Cliquer sur une zone
4. Cliquer "Explorer cette zone"
5. Voir des points colorés sur la carte ✨

---

## 🐛 Problèmes Courants

### Erreur : `Cannot find module 'csv-parse'`
**Solution** : `npm install csv-parse`

### Erreur : `VITE_SUPABASE_URL is not defined`
**Solution** : Vérifier `.env` et redémarrer le script

### Erreur : `401 Unauthorized`
**Solution** : Vérifier que `SUPABASE_SERVICE_ROLE_KEY` est correcte (pas l'anon key)

### Erreur : `relation "reference_species" does not exist`
**Solution** : Exécuter le SQL de création de table (étape 1)

### Import réussi mais carte vide
**Solutions** :
1. Vérifier les coordonnées utilisateur (console browser)
2. Vérifier que les espèces sont dans le rayon de 2km
3. Essayer une autre zone (ex: Paris centre)

---

## 📞 Support

Si problème persistant :
1. Vérifier les logs console browser (F12)
2. Vérifier les logs Supabase (Dashboard → Logs)
3. Vérifier que RLS est bien configurée (lecture publique)

---

**C'est tout !** 🎉

Après ces 3 étapes, tu peux explorer les zones avec 500 espèces de France + toutes les découvertes utilisateurs.
