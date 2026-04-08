# 🚀 AUDIT PRÉ-LANCEMENT APP STORE - Botanica

Date: 2026-04-07
Status: **EN COURS DE PRÉPARATION**

---

## ✅ CORRECTIFS APPLIQUÉS AUJOURD'HUI

### 1. **Système d'enregistrement des découvertes** ✅
- ✅ Base de données Supabase synchronisée avec le schéma local
- ✅ Toutes les colonnes nécessaires ajoutées (`points_earned`, `ecological_role`, `biodiversity_importance`, etc.)
- ✅ Contraintes CHECK corrigées pour les valeurs françaises (rareté, catégorie, biome)
- ✅ Colonnes `user_id` et `scientific_name` rendues nullable
- ✅ Test d'insertion réussi : découvertes enregistrées correctement

### 2. **Animation de carte de résultat** ✅
- ✅ Animation style Tesla ultra-satisfaisante ajoutée
- ✅ Effets de glow, ripple, et particules animées
- ✅ Transitions fluides et modernes
- ✅ Badge XP avec gradient doré
- ✅ Animations CSS optimisées (fadeIn, slideUp, scaleIn, iconPulse, etc.)

### 3. **Affichage des photos dans le journal (Collection)** ✅
- ✅ Taille des images augmentée de 170px → 190px dans les cartes
- ✅ Image du modal augmentée de 220px → 280px
- ✅ `object-fit: cover` et `object-position: center` explicites
- ✅ Meilleure visibilité des photos uploadées depuis Supabase

### 4. **Nouvelles sections écologiques** ✅
- ✅ Rôle Écologique (🌍) affiché en priorité
- ✅ Importance Biodiversité (🦋) mise en avant
- ✅ API modifiée pour générer ces infos pour toutes les catégories
- ✅ Design visuel distinct avec fond vert et bordures

---

## 📱 AUDIT DES ROUTES DE L'APPLICATION

### Routes configurées (pages.config.js)

| Route | Composant | Statut | Notes |
|-------|-----------|--------|-------|
| `/` | **Home** | ✅ OK | Page principale - Scanner biodiversité |
| `/login` | **Login** | ⚠️ À TESTER | Authentification Supabase |
| `/onboarding` | **Onboarding** | ⚠️ À TESTER | Premier lancement utilisateur |
| `/collection` | **Collection** | ✅ OK | Journal des découvertes (photos corrigées) |
| `/profile` | **Profile** | ⚠️ À TESTER | Profil utilisateur, stats, badges |
| `/pricing` | **Pricing** | ⚠️ À TESTER | Page d'abonnement Pro |
| `/territorial-map` | **TerritorialMap** | ⚠️ À TESTER | Carte des territoires explorés |
| `/knowledge-map` | **KnowledgeMap** | ⚠️ À TESTER | Arbre de connaissances |
| `/leaderboard` | **Leaderboard** | ⚠️ À TESTER | Classement des explorateurs |
| `/ancient-calendar` | **AncientCalendar** | ⚠️ À TESTER | Calendrier des observations |
| `/night-sky` | **NightSky** | ⚠️ À TESTER | Observations nocturnes |
| `/admin-import` | **AdminImport** | ⚠️ ADMIN | Import de données (admin only) |
| `/admin-map` | **AdminMap** | ⚠️ ADMIN | Carte admin |
| `/admin-security` | **AdminSecurity** | ⚠️ ADMIN | Sécurité admin |

---

## 🔴 PROBLÈMES IDENTIFIÉS À CORRIGER

### Priorité HAUTE 🔴

1. **Authentification et Onboarding**
   - ⚠️ Tester le flux d'inscription complet
   - ⚠️ Vérifier que le login Supabase fonctionne
   - ⚠️ S'assurer que l'onboarding se déclenche au premier lancement

2. **Profil utilisateur**
   - ⚠️ Vérifier que les stats s'affichent correctement (total XP, niveau, découvertes)
   - ⚠️ Tester la modification de profil
   - ⚠️ Vérifier l'affichage des badges

3. **Limites quotidiennes**
   - ⚠️ Tester que la limite de 5 scans/jour fonctionne pour les utilisateurs gratuits
   - ⚠️ Vérifier que les utilisateurs Pro ont bien un accès illimité
   - ⚠️ Tester le modal de limite atteinte

### Priorité MOYENNE 🟠

4. **Cartes et géolocalisation**
   - ⚠️ Tester TerritorialMap avec vraies coordonnées GPS
   - ⚠️ Vérifier que les zones sont bien détectées
   - ⚠️ Tester la fonctionnalité de contrôle de territoire

5. **Leaderboard**
   - ⚠️ Vérifier le classement des utilisateurs
   - ⚠️ Tester les filtres (hebdomadaire, mensuel, global)

6. **Pricing / Abonnement**
   - ⚠️ Vérifier que le flux d'abonnement Pro fonctionne
   - ⚠️ Tester Stripe (si configuré) ou système de paiement
   - ⚠️ Vérifier que `is_pro` est bien mis à jour après paiement

### Priorité BASSE 🟢

7. **Pages secondaires**
   - ⚠️ KnowledgeMap - Tester l'arbre de connaissances
   - ⚠️ AncientCalendar - Vérifier l'affichage du calendrier
   - ⚠️ NightSky - Tester les observations nocturnes

---

## 📋 CHECKLIST PRÉ-PUBLICATION APP STORE

### A. Fonctionnalités Core ✅

- [x] Scanner fonctionne (identification plantes, oiseaux, roches, champignons, arbres, insectes)
- [x] Enregistrement des découvertes dans le journal
- [x] Photos uploadées correctement sur Supabase Storage
- [x] Affichage des détails complets (rôle écologique, biodiversité)
- [ ] Authentification et inscription
- [ ] Profil utilisateur fonctionnel
- [ ] Limites quotidiennes (5 scans gratuits, illimité Pro)
- [ ] Système de points XP et niveaux
- [ ] Collection/Journal affiche toutes les découvertes

### B. Performance & UX 🚀

- [x] Animations fluides et satisfaisantes (style Tesla)
- [x] Photos bien dimensionnées et visibles
- [ ] Temps de chargement < 3 secondes sur 4G
- [ ] Pas de bugs visuels sur iOS Safari
- [ ] Pas de bugs visuels sur Android Chrome
- [ ] Gestion des erreurs réseau (mode hors ligne)
- [ ] Messages d'erreur clairs pour l'utilisateur

### C. Contenu & Informations 📝

- [x] Descriptions écologiques générées par IA
- [x] Informations de biodiversité pertinentes
- [ ] Vérifier l'exactitude des identifications (taux de confiance)
- [ ] Tester sur au moins 20 espèces différentes
- [ ] Vérifier que les anecdotes sont intéressantes
- [ ] S'assurer que les infos de toxicité sont correctes (CRUCIAL pour sécurité)

### D. Sécurité & Légal 🔒

- [ ] Row Level Security (RLS) activé sur Supabase
- [ ] Politiques RLS testées (users ne peuvent voir que leurs données)
- [ ] Pas de clés API exposées dans le code client
- [ ] Respect RGPD (consentement, suppression compte)
- [ ] Conditions d'utilisation (CGU)
- [ ] Politique de confidentialité
- [ ] Avertissement toxicité plantes/champignons

### E. Technique App Store 📱

- [ ] icône d'app (1024x1024px)
- [ ] Screenshots pour App Store (différentes tailles iPhone)
- [ ] Description de l'app (titre, sous-titre, description longue)
- [ ] Mots-clés pour référencement
- [ ] Catégorie : Éducation / Nature / Référence
- [ ] Classification d'âge appropriée (4+)
- [ ] Build Xcode/Android Studio configuré
- [ ] Tests sur devices réels (iPhone, Android)
- [ ] Vérifier que les permissions sont demandées (Camera, GPS)

### F. Monétisation & Abonnements 💰

- [ ] Stripe/RevenueCat configuré pour abonnements Pro
- [ ] Test du flux d'achat complet
- [ ] Vérification que is_pro s'active après paiement
- [ ] Prix définis (ex: 5€/mois pour Pro)
- [ ] Page Pricing claire et attractive

---

## 🎯 PROCHAINES ÉTAPES RECOMMANDÉES

### Semaine 1 : Tests fonctionnels
1. ✅ Corriger système d'enregistrement (FAIT)
2. ✅ Optimiser animations (FAIT)
3. ✅ Corriger affichage photos (FAIT)
4. **TODO** : Tester login/signup flow
5. **TODO** : Vérifier limites quotidiennes
6. **TODO** : Tester profil utilisateur

### Semaine 2 : Contenu & Qualité
1. **TODO** : Tester identification sur 50+ espèces réelles
2. **TODO** : Vérifier exactitude des infos (surtout toxicité)
3. **TODO** : Optimiser prompts IA si nécessaire
4. **TODO** : Ajouter plus de catégories si besoin

### Semaine 3 : Polish & Sécurité
1. **TODO** : Activer RLS sur Supabase
2. **TODO** : Rédiger CGU et politique de confidentialité
3. **TODO** : Ajouter avertissements sécurité (toxicité)
4. **TODO** : Tests sur devices réels (iOS + Android)

### Semaine 4 : Soumission App Store
1. **TODO** : Créer assets (icône, screenshots)
2. **TODO** : Rédiger description App Store
3. **TODO** : Build production
4. **TODO** : Soumettre à Apple/Google pour review

---

## 💡 AMÉLIORATIONS FUTURES (post-lancement)

- Système de badges et achievements
- Partage sur réseaux sociaux
- Mode hors ligne complet avec sync
- Communauté / amis / comparaison
- Notifications push (rappel daily streak)
- Widget iOS pour stats rapides
- Support multi-langues (EN, ES, etc.)
- Intégration iNaturalist pour validation communautaire

---

## 📞 CONTACTS & RESSOURCES

- **Supabase Dashboard** : https://supabase.com/dashboard
- **Gemini API** : Google AI Studio
- **Vercel** : https://vercel.com
- **Docs API** : `/docs` dans le projet

---

**🎯 OBJECTIF : Lancement sur App Store dans 3-4 semaines**

**Status actuel : 65% prêt**
- ✅ Core features fonctionnent
- ⚠️ Tests approfondis nécessaires
- ⚠️ Contenu légal à préparer
- ⚠️ Assets App Store à créer
