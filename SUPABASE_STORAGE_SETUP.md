# 📷 Configuration Supabase Storage - Photos W1LD

## 🚨 Problème : Photos Invisibles dans le Journal

Si les photos ne s'affichent pas, c'est probablement parce que le **bucket Supabase Storage n'est pas configuré**.

---

## ✅ Solution en 5 Minutes

### 1️⃣ Créer le Bucket "discoveries"

1. Aller sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sélectionner votre projet
3. Menu de gauche → **Storage**
4. Cliquer **"New bucket"**
5. Nom du bucket : `discoveries`
6. **✅ COCHER "Public bucket"** (très important !)
7. Cliquer **"Create bucket"**

### 2️⃣ Configurer les Policies (Upload)

Aller dans **Storage** → **discoveries** → **Policies**

Créer une policy **INSERT** :
```
Name: Allow authenticated users to upload
Policy:
  (bucket_id = 'discoveries') AND (auth.role() = 'authenticated')

Allowed operations: INSERT
```

SQL direct :
```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'discoveries');
```

### 3️⃣ Configurer les Policies (Read)

Créer une policy **SELECT** :
```
Name: Public read access
Policy:
  bucket_id = 'discoveries'

Allowed operations: SELECT
```

SQL direct :
```sql
CREATE POLICY "Public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'discoveries');
```

### 4️⃣ Vérifier la Configuration

Exécuter le script de diagnostic :
```bash
node scripts/diagnose-photos.js
```

**Résultat attendu** :
```
✅ Bucket "discoveries" existe
   Public: OUI ✅
✅ Upload réussi: test-xxxxx.png
```

### 5️⃣ Tester dans l'App

1. Scanner une plante
2. Sauvegarder
3. Aller dans le journal
4. Ouvrir la fiche de la plante
5. ✅ La photo devrait s'afficher !

---

## 🔧 Dépannage

### Problème : Bucket n'existe pas

**Symptôme** : `❌ Bucket "discoveries" N'EXISTE PAS !`

**Solution** : Suivre l'étape 1 ci-dessus

### Problème : Bucket pas public

**Symptôme** : `Public: NON ❌`

**Solution** :
1. Storage → discoveries → Settings
2. Cliquer **"Make public"**

### Problème : Upload échoue (403 Forbidden)

**Symptôme** : `❌ Upload échoué: policy`

**Solution** : Configurer les policies (étapes 2 et 3)

### Problème : Photos toujours pas visibles

**Vérifications** :
1. Console browser (F12) : Chercher erreurs `uploadPhoto`
2. Vérifier que `photo_url` est rempli dans la DB :
   ```sql
   SELECT id, common_name, photo_url
   FROM plant_discoveries
   WHERE photo_url IS NOT NULL
   LIMIT 5;
   ```
3. Tester l'URL manuellement dans le navigateur

---

## 📊 Structure Complète

### Bucket Configuration
```
Name: discoveries
Public: ✅ Yes
File size limit: 5 MB (recommandé)
Allowed MIME types: image/* (recommandé)
```

### Policies
```
1. INSERT (authenticated users)
2. SELECT (public read)
3. UPDATE (owner only) - optionnel
4. DELETE (owner only) - optionnel
```

### Dossier Structure
```
discoveries/
├── <user_id>/
│   ├── 1234567890.jpg
│   ├── 1234567891.jpg
│   └── ...
```

---

## 🧪 Test Manuel

### Test 1 : Upload via API
```javascript
// Dans la console browser (F12)
const { data, error } = await supabase
  .storage
  .from('discoveries')
  .upload('test.txt', new Blob(['test']), { contentType: 'text/plain' });

console.log(data, error);
```

### Test 2 : Lire URL publique
```javascript
const { data } = supabase
  .storage
  .from('discoveries')
  .getPublicUrl('test.txt');

console.log(data.publicUrl);
```

### Test 3 : Ouvrir URL dans navigateur
Copier l'URL et l'ouvrir dans un nouvel onglet.
Si ça fonctionne → Configuration OK ✅

---

## 📝 Checklist Complète

- [ ] Bucket "discoveries" créé
- [ ] Bucket configuré comme **public**
- [ ] Policy INSERT créée (authenticated)
- [ ] Policy SELECT créée (public)
- [ ] Script diagnostic exécuté sans erreur
- [ ] Test upload réussi
- [ ] URL publique accessible dans navigateur
- [ ] Photo visible dans l'app après scan

---

## 🚀 Si Tout est OK

Après configuration, les **prochains scans** auront automatiquement des photos !

**Pour les anciens scans sans photo** :
- Impossible de récupérer (photos jamais uploadées)
- Solution : Re-scanner les espèces importantes

---

**Temps requis** : 5 minutes
**Difficulté** : Facile ⭐
**Impact** : Critique 🔥

Une fois configuré, tu n'auras **plus jamais** à y retoucher !
