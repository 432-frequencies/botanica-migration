# 🔴 PROBLÈME IDENTIFIÉ: Bucket Storage Manquant

## Diagnostic Exécuté

✅ Script de diagnostic exécuté avec succès

**Résultat:**
```
❌ Bucket "discoveries" introuvable
📊 Total découvertes: 0
```

## Cause du Problème

Le bucket Supabase Storage **"discoveries"** n'existe pas. Sans ce bucket:
- Les photos ne peuvent pas être uploadées
- `uploadPhoto()` échoue silencieusement (retourne "")
- Les `photo_url` restent vides dans la base de données

## ✅ SOLUTION: 3 Étapes Rapides (2 minutes)

### Étape 1: Créer le Bucket (30 secondes)

1. Aller sur: https://supabase.com/dashboard
2. Sélectionner votre projet: **rejrtvrkpkopjmowzuqn**
3. Menu gauche → **Storage**
4. Cliquer **"New bucket"**
5. Nom: `discoveries`
6. **✅ COCHER "Public bucket"** (CRITIQUE!)
7. Cliquer **"Create bucket"**

### Étape 2: Configurer les Policies (1 minute)

Dans **Storage** → **discoveries** → **Policies**, exécuter ce SQL:

```sql
-- Policy 1: Upload (authenticated users)
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'discoveries');

-- Policy 2: Read (public)
CREATE POLICY "Public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'discoveries');
```

### Étape 3: Vérifier (30 secondes)

Exécuter ce script:
```bash
node scripts/check-photos-simple.js
```

**Résultat attendu:**
```
✅ Bucket "discoveries" existe
   Public: OUI ✅
```

## Après Configuration

Une fois le bucket configuré:

1. **Nouveaux scans**: Les photos seront automatiquement uploadées ✅
2. **Anciens scans**: Impossible de récupérer les photos (jamais uploadées)

## Vérification Finale

Scanner une plante test:
1. Prendre une photo
2. Scanner la plante
3. Sauvegarder
4. Ouvrir le journal
5. ✅ La photo devrait s'afficher!

## Si ça ne marche toujours pas

Vérifier les logs console du navigateur (F12):
- Chercher `[uploadPhoto]`
- Lire les messages d'erreur détaillés

---

**Documentation complète:** Voir `SUPABASE_STORAGE_SETUP.md`
