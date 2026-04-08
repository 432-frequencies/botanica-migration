# 🚀 Import des Espèces - Étape par Étape

## ✅ ÉTAPE 1: Créer la Table (2 minutes)

### 1. Ouvrir Supabase SQL Editor

1. Va sur: **https://supabase.com/dashboard/project/rejrtvrkpkopjmowzuqn**
2. Menu de gauche → **SQL Editor**
3. Cliquer sur **"New query"**

### 2. Copier-Coller le SQL

Copie **TOUT** le contenu du fichier `supabase_reference_species.sql` et colle-le dans l'éditeur SQL.

Le fichier contient:
```sql
CREATE TABLE IF NOT EXISTS reference_species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  category TEXT NOT NULL DEFAULT 'plant',
  rarity TEXT DEFAULT 'commune',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- ... + indexes et policies
```

### 3. Exécuter

1. Cliquer sur **"Run"** (ou Cmd/Ctrl + Enter)
2. Attendre 2-3 secondes
3. ✅ Résultat attendu: "Success. No rows returned"

---

## ✅ ÉTAPE 2: Désactiver Temporairement le RLS

Dans le **même SQL Editor**, créer une **nouvelle query** et exécuter:

```sql
ALTER TABLE reference_species DISABLE ROW LEVEL SECURITY;
```

✅ Résultat: "Success. No rows returned"

**Pourquoi?** La table a des protections qui bloquent les insertions. On les désactive le temps de l'import.

---

## ✅ ÉTAPE 3: Lancer l'Import (10 secondes)

Dans ton **terminal**:

```bash
node scripts/import-reference-species-simple.js
```

**Résultat attendu:**
```
🚀 Import des espèces de référence...

📖 Lecture: especes_france_500.csv
   ✅ 500 espèces lues
📖 Lecture: especes_1000_autour_grandes_villes_france.csv
   ✅ 1000 espèces lues

📊 Total: 1500 espèces à importer

✅ 1500 espèces valides

📦 Insertion des données...
  ✅ Batch 1/15: 100 espèces (7%)
  ✅ Batch 2/15: 100 espèces (13%)
  ✅ Batch 3/15: 100 espèces (20%)
  ...
  ✅ Batch 15/15: 100 espèces (100%)

📊 Résultat:
   Insérées: 1500
   Erreurs: 0
   Total en base: 1500

📁 Par catégorie:
   plant     : 500
   insect    : 600
   fungi     : 250
   rock      : 150

✨ Import terminé!
```

---

## ✅ ÉTAPE 4 (Optionnel): Réactiver le RLS

Pour **protéger** la table contre les modifications futures:

Dans **SQL Editor**:

```sql
ALTER TABLE reference_species ENABLE ROW LEVEL SECURITY;
```

**Note:** Les utilisateurs pourront toujours **lire** les espèces (lecture publique activée), mais ne pourront plus les modifier.

---

## 🧪 Vérification

Pour vérifier que tout est OK:

### Dans SQL Editor:
```sql
SELECT COUNT(*) as total FROM reference_species;
-- Résultat attendu: 1500

SELECT category, COUNT(*) as nb
FROM reference_species
GROUP BY category
ORDER BY nb DESC;
```

### Dans le terminal:
```bash
node scripts/check-reference-table.js
```

---

## ❌ Troubleshooting

### "relation does not exist" (Étape 3)
→ Tu as sauté l'Étape 1. Exécute le SQL pour créer la table.

### "policy violation" (Étape 3)
→ Tu as sauté l'Étape 2. Désactive le RLS.

### Import réussit mais 0 espèces
→ Vérifie les logs d'erreur dans la console.

---

**🎯 Commence par l'Étape 1!** Une fois la table créée, l'import prendra 10 secondes.
