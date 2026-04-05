# Migration Log — Base44 → Supabase

**Date de début :** 2026-04-05
**Branche :** `migrate-off-base44`
**Objectif :** Supprimer toute dépendance à `@base44/sdk` et remplacer par Supabase + API routes Vercel.

---

## ÉTAPE 1 — Inventaire (TERMINÉE)

### Dépendances Base44

| Package | Rôle |
|---|---|
| `@base44/sdk` ^0.8.24 | Client principal (auth, entities, integrations) |
| `@base44/vite-plugin` ^1.0.6 | Plugin Vite (HMR notifier, visual edit agent) |

---

### Fichiers impactés

#### Couche API / Config (3 fichiers)

| Fichier | Usage |
|---|---|
| `src/api/base44Client.js` | `createClient()` — point d'entrée unique du SDK |
| `src/lib/AuthContext.jsx` | `base44.auth.me()`, `logout()`, `redirectToLogin()`, `createAxiosClient` |
| `src/lib/app-params.js` | Lecture des params Base44 depuis URL/localStorage |

#### Frontend — Pages (15 fichiers)

| Fichier | Usages |
|---|---|
| `src/pages/Home.jsx` | `functions.invoke` × 4, entities implicites |
| `src/pages/Onboarding.jsx` | `functions.invoke` × 3 |
| `src/pages/Profile.jsx` | `functions.invoke` × 1 |
| `src/pages/Collection.jsx` | `functions.invoke` × 1 |
| `src/pages/TerritorialMap.jsx` | `functions.invoke` × 1 |
| `src/pages/NightSky.jsx` | `functions.invoke` × 1 |
| `src/pages/AncientCalendar.jsx` | `functions.invoke` × 1 |
| `src/pages/Pricing.jsx` | `functions.invoke` × 1 (Stripe) |
| `src/pages/AdminImport.jsx` | `functions.invoke` × 3 |
| `src/pages/AdminSecurity.jsx` | `base44.auth.me()`, `entities.UserTrustScore` |
| `src/pages/Badges.jsx` | entities |
| `src/pages/Friends.jsx` | entities |
| `src/pages/Leaderboard.jsx` | entities |
| `src/pages/KnowledgeMap.jsx` | entities |
| `src/pages/AdminMap.jsx` | entities |

#### Frontend — Composants (10 fichiers)

| Fichier | Usages |
|---|---|
| `src/components/astronomy/ConstellationModal.jsx` | `functions.invoke` × 1 |
| `src/components/home/CommunityFeed.jsx` | entities |
| `src/components/home/CurrentZoneStatus.jsx` | entities |
| `src/components/home/HomeMapWidget.jsx` | entities |
| `src/components/home/LocalZoneWidget.jsx` | entities |
| `src/components/collection/LearnMoreModal.jsx` | entities |
| `src/components/knowledge/KnowledgeDetailModal.jsx` | entities |
| `src/components/profile/SeasonCard.jsx` | entities |
| `src/components/profile/ZoneCard.jsx` | entities |
| `src/components/shared/BenefitsPanel.jsx` | entities |

#### Frontend — Utilitaires (1 fichier)

| Fichier | Usages |
|---|---|
| `src/utils/syncQueue.js` | `functions.invoke` × 2 (identifyPlant, saveDiscovery) |

#### Backend — Fonctions (20 fichiers dans `base44/functions/`)

| Fonction | Complexité | Dépendances |
|---|---|---|
| `identifyPlant` | Haute | auth, LLM (×5), entities |
| `saveDiscovery` | Haute | auth, entities (×6), cache (×4), asServiceRole |
| `discoverKnowledge` | Haute | auth, entities (×5) |
| `getUserProfile` | Moyenne | auth, entities (×4) |
| `completeOnboarding` | Moyenne | auth, entities (×3) |
| `updateZoneLeaders` | Moyenne | auth, entities (×3) |
| `endSeason` | Moyenne | auth, entities (×4) |
| `unlockKnowledge` | Moyenne | auth, entities (×3) |
| `identifySound` | Moyenne | auth, LLM (×2) |
| `fetchSpeciesPhoto` | Faible | auth, entities (×2) |
| `fixSpeciesPhotos` | Faible | auth, entities (×2) |
| `importSpeciesPhotos` | Faible | auth, entities |
| `recategorizeFungi` | Faible | auth, entities |
| `getNearbyKnowledge` | Faible | auth, entities (×2) |
| `getAstronomyData` | Faible | auth, API externe |
| `getAncientCalendarData` | Faible | auth, entities (×2) |
| `getVisibleConstellations` | Faible | auth |
| `getConstellationChart` | Faible | auth |
| `createCheckout` | Faible | auth, Stripe |
| `stripeWebhook` | Faible | Stripe, entities |

---

### Entités Base44 → Tables Supabase

| Entité Base44 | Table Supabase future | Priorité |
|---|---|---|
| `UserProfile` | `user_profiles` | CRITIQUE |
| `PlantDiscovery` | `plant_discoveries` | CRITIQUE |
| `UserTrustScore` | `user_trust_scores` | CRITIQUE |
| `ZoneLeader` | `zone_leaders` | IMPORTANT |
| `UserKnowledgeProgress` | `user_knowledge_progress` | IMPORTANT |
| `AncientKnowledge` | `ancient_knowledge` | IMPORTANT |
| `Season` | `seasons` | IMPORTANT |
| `SeasonHistory` | `season_history` | IMPORTANT |
| `Achievement` | `achievements` | SECONDAIRE |
| `WeeklyChallenge` | `weekly_challenges` | SECONDAIRE |
| `ChallengeProgress` | `challenge_progress` | SECONDAIRE |
| `Constellation` | `constellations` | SECONDAIRE |
| `SolarEvent` | `solar_events` | SECONDAIRE |
| `LunarCalendar` | `lunar_calendar` | SECONDAIRE |

---

### Mapping Base44 → Remplacement

| Base44 | Remplacement |
|---|---|
| `base44.auth.me()` | `supabase.auth.getUser()` |
| `base44.auth.logout()` | `supabase.auth.signOut()` |
| `base44.auth.redirectToLogin()` | Redirect vers `/login` + Supabase Auth UI |
| `base44.entities.X.filter()` | `supabase.from('x').select()` |
| `base44.entities.X.create()` | `supabase.from('x').insert()` |
| `base44.entities.X.update()` | `supabase.from('x').update()` |
| `base44.asServiceRole.*` | Supabase service role key dans API routes |
| `base44.functions.invoke()` | `fetch('/api/xxx')` vers Vercel API routes |
| `base44.integrations.Core.InvokeLLM()` | Appel direct OpenAI/Anthropic dans API route |
| `base44.cache.get/set()` | Redis (Upstash) ou Supabase table |
| `@base44/vite-plugin` | Supprimer (aucun équivalent nécessaire) |
| `createAxiosClient` (Base44) | `axios` direct ou `fetch` natif |

---

## Priorités

### CRITIQUE (bloque le fonctionnement dès le début)
- `base44.auth.*` — toute l'app est inaccessible sans auth
- `src/api/base44Client.js` — point d'entrée unique
- `src/lib/AuthContext.jsx` — contexte auth global
- `src/lib/app-params.js` — params de session

### IMPORTANT (fonctionnalités principales)
- `saveDiscovery` — cœur du gameplay
- `identifyPlant` — fonctionnalité principale
- `getUserProfile` — données utilisateur
- Entités: `UserProfile`, `PlantDiscovery`, `UserTrustScore`

### SECONDAIRE (peut attendre)
- `getConstellationChart`, `getVisibleConstellations`
- `getAstronomyData`, `getAncientCalendarData`
- `getNearbyKnowledge`
- `endSeason`, `updateZoneLeaders`
- `createCheckout`, `stripeWebhook`
- Entités cosmétiques / challenges

---

## Risques techniques

| Risque | Impact | Mitigation |
|---|---|---|
| Schema de données Base44 inconnu | Haut | Lire toutes les fonctions avant de créer les tables Supabase |
| `base44.asServiceRole` sur entités protégées | Haut | Utiliser service_role key Supabase côté serveur uniquement |
| `base44.cache` (saveDiscovery) | Moyen | Remplacer par Redis Upstash ou colonne Supabase |
| `base44.integrations.Core.InvokeLLM` | Moyen | Choisir un provider LLM (OpenAI/Anthropic) et câbler directement |
| Anti-cheat dans identifyPlant | Moyen | Logique métier à extraire et tester |
| Token auth dans localStorage (`base44_*`) | Faible | Nettoyer lors de la migration auth |
| `@base44/vite-plugin` (HMR, visual edit) | Faible | Simplement supprimer le plugin |

---

## Dépendances bloquantes

```
Auth (Supabase)
  └→ base44Client.js + AuthContext.jsx
       └→ toutes les pages (via useAuth)
            └→ functions.invoke (nécessite token valide)
                 └→ API routes Vercel
                      └→ Supabase DB (tables créées)
```

**Conclusion :** On ne peut pas migrer les fonctions sans avoir d'abord migré l'auth. Et on ne peut pas migrer l'auth sans avoir configuré Supabase.

---

## ÉTAPE 2 — Plan de migration (proposé, en attente de validation)

### Lot 0 — Setup infrastructure (PRÉREQUIS, hors code)
- Créer projet Supabase
- Configurer variables d'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- Installer `@supabase/supabase-js`
- Activer Supabase Auth (email/password ou magic link)

### Lot 1 — Couche d'abstraction (2 fichiers)
- Créer `src/api/supabaseClient.js` (remplace `base44Client.js`)
- Mettre à jour `src/lib/AuthContext.jsx` (remplace `base44.auth.*` par Supabase auth)
- **Résultat :** l'app se lance, auth fonctionne, le reste est cassé mais visible

### Lot 2 — Entités critiques dans Supabase (3 fichiers max)
- Créer tables `user_profiles`, `plant_discoveries`, `user_trust_scores` dans Supabase
- Créer `src/api/entities.js` — wrapper générique `supabase.from()`
- Migrer les pages qui utilisent ces entités directement (`AdminSecurity`, simple queries)

### Lot 3 — API routes (1 fonction à la fois)
Ordre recommandé :
1. `getUserProfile` (simple, read-only)
2. `identifyPlant` (LLM — choisir provider)
3. `saveDiscovery` (plus complexe, anti-cheat)
4. `completeOnboarding`
5. Reste des fonctions

### Lot 4 — Fonctions secondaires
- Astronomie, calendrier, knowledge, constellations

### Lot 5 — Nettoyage
- Supprimer `@base44/sdk`, `@base44/vite-plugin`
- Supprimer `base44/` directory
- Nettoyer `vite.config.js`
- Nettoyer `package.json`

---

## Journal des modifications

| Date | Étape | Fichiers modifiés | Notes |
|---|---|---|---|
| 2026-04-05 | Inventaire | — | Étape 1 terminée, aucune modification |
| 2026-04-05 | Lot 1 — Auth Supabase | `src/api/supabaseClient.js` (créé), `src/lib/AuthContext.jsx` (réécrit) | AuthContext utilise Supabase. Interface préservée. Pages avec `base44.auth.me()` direct non migrées. |
