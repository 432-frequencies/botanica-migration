# 📦 Guide d'Import des Espèces de Référence

## État Actuel

✅ CSV préparés (1500 espèces)
✅ Table `reference_species` créée
✅ Script d'import prêt
❌ **Blocage:** Policy RLS empêche les insertions

## Problème Identifié

La table `reference_species` a une policy RLS qui **bloque toutes les insertions** pour protéger les données:

```sql
CREATE POLICY "Admin seulement pour modifications"
USING (false)  -- ← Refuse TOUT
```

## ✅ SOLUTION: 2 Étapes (1 minute)

### Étape 1: Désactiver Temporairement le RLS

Dans **Supabase SQL Editor**:

1. Aller sur: https://supabase.com/dashboard/project/rejrtvrkpkopjmowzuqn
2. Menu gauche → **SQL Editor**
3. New query
4. Coller et exécuter:

```sql
ALTER TABLE reference_species DISABLE ROW LEVEL SECURITY;
```

5. ✅ Résultat: "Success. No rows returned"

### Étape 2: Lancer l'Import

Dans le terminal:

```bash
node scripts/import-reference-species-simple.js
```

**Durée:** ~5-10 secondes pour 1500 espèces

**Résultat attendu:**
```
✅ 1500 espèces valides
📦 Insertion des données...
  ✅ Batch 1/15: 100 espèces (7%)
  ✅ Batch 2/15: 100 espèces (13%)
  ...
  ✅ Batch 15/15: 100 espèces (100%)

📊 Résultat:
   Insérées: 1500
   Total en base: 1500

📁 Par catégorie:
   plant     : 500
   insect    : 600
   fungi     : 250
   rock      : 150
```

### Étape 3: Réactiver le RLS (Optionnel)

Si tu veux **protéger** la table contre les modifications futures:

```sql
ALTER TABLE reference_species ENABLE ROW LEVEL SECURITY;
```

**Note:** Les utilisateurs pourront toujours **lire** les espèces (policy SELECT publique), mais ne pourront plus les modifier.

---

## Vérification

Après l'import, vérifie que les espèces sont bien là:

```sql
SELECT category, COUNT(*) as total
FROM reference_species
GROUP BY category
ORDER BY total DESC;
```

**OU dans le terminal:**

```bash
node scripts/check-reference-table.js
```

---

## 🗺️ Utilisation dans l'App

Une fois importées, les espèces apparaîtront dans:

- **Zone Explorer** → Affiche les espèces de référence autour de toi
- **Carte territoriale** → Superposition avec les découvertes utilisateurs
- **Stats** → Diversité locale vs. base de données

Les espèces de référence sont **read-only** et servent de base scientifique pour comparer avec les découvertes des utilisateurs.

---

## Troubleshooting

### Erreur: "table does not exist"

→ Exécute d'abord: `supabase_reference_species.sql` dans SQL Editor

### Erreur: "policy violation"

→ Le RLS est encore actif, désactive-le (Étape 1)

### Import réussit mais table vide

→ Vérifie les logs pour les erreurs de validation (coordonnées invalides, etc.)

---

**Prêt?** Exécute l'Étape 1 puis l'Étape 2 ! ⚡
