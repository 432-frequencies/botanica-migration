# 🔴 SOLUTION: Rendre le Bucket "discoveries" PUBLIC

## Problème Identifié

✅ Le bucket "discoveries" existe
❌ Mais il n'est **PAS public**

**Conséquence:** Les URLs générées sont des "signed URLs" qui **expirent après quelques jours**. C'est pour ça que les photos disparaissent!

## URLs Actuelles (PROBLÈME)
```
https://...supabase.co/storage/v1/object/sign/discoveries/...?token=eyJ...
                                        ^^^^
                                     Signed URL = EXPIRE
```

## URLs Après Fix (SOLUTION)
```
https://...supabase.co/storage/v1/object/public/discoveries/...
                                        ^^^^^^
                                     Public URL = PERMANENT
```

---

## ✅ SOLUTION: 30 Secondes

### Étape 1: Aller dans Storage

1. https://supabase.com/dashboard/project/rejrtvrkpkopjmowzuqn
2. Menu gauche → **Storage**
3. Cliquer sur le bucket **"discoveries"**

### Étape 2: Rendre Public

1. Cliquer sur l'icône **Settings** (⚙️) du bucket
2. Dans la section "Bucket Settings"
3. Cocher **"Public bucket"** ✅
4. Cliquer **"Save"**

**OU via SQL:**

```sql
UPDATE storage.buckets
SET public = true
WHERE name = 'discoveries';
```

### Étape 3: Vérifier

Exécuter ce script:
```bash
node scripts/check-db-photos.js
```

**Résultat attendu:**
```
✅ Le bucket est configuré comme PUBLIC
```

---

## Après le Fix

### ✅ Avantages
- Les nouvelles photos auront des URLs **permanentes**
- Les photos ne disparaîtront plus jamais
- Chargement plus rapide (pas de vérification de token)

### ⚠️ Anciennes Photos

Les anciennes photos avec signed URLs expirées sont **perdues**. Il faut:
- Re-scanner les espèces importantes
- OU régénérer les URLs (plus complexe)

---

## Test Final

Après avoir rendu le bucket public:

1. **Scanner une nouvelle plante** dans l'app
2. **Ouvrir la console** du navigateur (F12)
3. **Chercher** `[uploadPhoto]`
4. **Vérifier** que l'URL contient `/object/public/` (pas `/sign/`)
5. **Ouvrir le journal** → La photo devrait s'afficher ✅

---

**Une fois fait, les photos seront 100% stables et permanentes!**
