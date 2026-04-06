# ⚡ Quick Start - 5 minutes

## ✅ Ce qui est déjà fait

- ✅ Code 100% migré vers Supabase
- ✅ APIs backend créées (Gemini + iNaturalist)
- ✅ Variables d'environnement configurées
- ✅ Code déployé sur GitHub et Vercel

## 🚀 Ce qu'il vous reste à faire (5 minutes)

### 1. Supabase Database (2 min)

**Ouvrir** : https://supabase.com/dashboard → Votre projet

**SQL Editor** :

```sql
-- Copier-coller le contenu complet de supabase_schema.sql
-- Puis cliquer Run

-- Ensuite copier-coller le contenu de supabase_missing_tables.sql
-- Et cliquer Run
```

✅ Vous avez maintenant 6 tables créées

### 2. Supabase Storage (1 min)

**Storage** → **New bucket** :

- Nom : `discoveries`
- Public : ✅ **Cocher "Public bucket"**
- Cliquer **Create**

**Policies** :

Dans Storage → discoveries → Policies, créer 2 policies :

**Upload Policy :**
```sql
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'discoveries' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**Read Policy :**
```sql
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'discoveries');
```

✅ Bucket prêt !

### 3. Test de l'app (2 min)

```bash
npm run dev
```

**Parcours à tester :**

1. Aller sur http://localhost:5173/login
2. Créer un compte (email + password)
3. Compléter l'onboarding (5 étapes)
4. Scanner une plante avec la caméra
5. Voir le résultat Gemini
6. Aller sur /profile
7. Vérifier que la découverte est sauvegardée

✅ Si tout fonctionne, la migration est complète !

---

## 🎯 Checklist finale

- [ ] 6 tables SQL créées dans Supabase
- [ ] Bucket `discoveries` créé et public
- [ ] 2 policies RLS sur le bucket
- [ ] App tourne en local (`npm run dev`)
- [ ] Login/Signup fonctionnent
- [ ] Onboarding complet fonctionne
- [ ] Scan + identification fonctionnent
- [ ] Photo uploadée visible dans Storage
- [ ] Découverte sauvegardée dans profile
- [ ] Logout fonctionne

---

## 🐛 Problèmes courants

### Erreur "table does not exist"
→ Vérifier que vous avez bien exécuté les 2 fichiers SQL

### Erreur d'upload de photo
→ Vérifier que le bucket `discoveries` est bien **Public**
→ Vérifier que les 2 policies RLS sont créées

### Erreur Gemini "401 Unauthorized"
→ Vérifier `GEMINI_API_KEY` dans `.env.local`
→ Vérifier que la clé est valide sur Google Cloud Console

### Page blanche sur /login ou /home
→ Vérifier que `vercel.json` existe et contient la config SPA rewrite
→ Relancer `npm run dev`

---

## 📚 Documentation complète

Pour plus de détails :

- **Setup complet** : [`SETUP_SUPABASE.md`](./SETUP_SUPABASE.md)
- **Détails migration** : [`MIGRATION_COMPLETE.md`](./MIGRATION_COMPLETE.md)
- **iNaturalist** : [`INATURALIST_USAGE.md`](./INATURALIST_USAGE.md)
- **README** : [`README.md`](./README.md)

---

## 🎉 Prêt à déployer ?

Une fois que tout fonctionne en local :

1. Les changements sont déjà pushés sur GitHub
2. Vercel déploie automatiquement
3. Vérifier que les variables d'env sont sur Vercel
4. Tester l'URL de production

**C'est tout ! Votre app est live.** 🚀
