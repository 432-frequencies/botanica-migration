# 🎵 Système d'Identification Sonore W1LD - Architecture Complète

## 🎯 Vue d'ensemble

Le nouveau système d'identification sonore de W1LD utilise une approche **fréquentielle intelligente** combinant :
- Analyse FFT (Fast Fourier Transform) pour extraction des fréquences dominantes
- Filtrage adaptatif par bandes de fréquences selon le type d'organisme
- Contexte environnemental enrichi (GPS, heure, saison, météo)
- Prompt Gemini dynamique avec données bioacoustiques précises

## 🏗️ Architecture du Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. CAPTURE AUDIO (iOS/Web)                   │
│  AudioCapture.jsx → MediaRecorder → PCM 44.1kHz, mono, 16-bit  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              2. ANALYSE FRÉQUENTIELLE (Web Audio API)           │
│  audioAnalysis.js → FFT 4096 → Extraction pics → Patterns      │
│  - Fréquences dominantes (top 5)                               │
│  - Pattern temporel (émissions/sec, durée)                     │
│  - Qualité du signal (RMS, SNR)                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│            3. FILTRAGE FRÉQUENTIEL ADAPTATIF                    │
│  Bandpass filters selon contexte:                              │
│  🦜 Oiseaux:    1kHz - 8kHz                                    │
│  🦗 Insectes:   3kHz - 20kHz                                   │
│  🐸 Amphibiens: 200Hz - 3kHz                                   │
│  🦇 Mammifères: 50Hz - 2kHz                                    │
│  ⚡ Auto:       50Hz - 20kHz (spectre complet)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           4. CONTEXTE ENVIRONNEMENTAL (audioContext.js)         │
│  - Heure locale (jour/nuit/crépuscule)                         │
│  - Saison (reproduction, migration, hibernation)               │
│  - Région biogéographique (Europe, Méditerranée, etc.)        │
│  - Habitat probable (forêt, prairie, zones humides)           │
│  - Météo optionnelle (Open-Meteo API)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         5. IDENTIFICATION IA (Vercel + Gemini 2.5 Flash)        │
│  Prompt enrichi avec:                                           │
│  - Fréquences dominantes détectées                             │
│  - Pattern temporel analysé                                     │
│  - Contexte environnemental complet                            │
│  → Espèce + Confiance + Alternatives + Anecdote                │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Structure des Fichiers

### Nouveaux fichiers créés

```
botanica-migration/
├── src/
│   ├── utils/
│   │   ├── audioAnalysis.js        ⭐ NOUVEAU - Analyse FFT et filtrage
│   │   └── audioContext.js         ⭐ NOUVEAU - Contexte environnemental
│   ├── components/identify/
│   │   └── AudioCapture.jsx        ✏️ MODIFIÉ - UI améliorée + analyse temps réel
│   └── api/
│       └── identifySound.js        ✏️ MODIFIÉ - Envoi données enrichies
└── api/
    └── identify-plant.js           ✏️ MODIFIÉ - Prompt Gemini enrichi
```

## 🔬 Détails Techniques

### 1. Analyse Fréquentielle (audioAnalysis.js)

**Fonctions principales :**

#### `analyzeFrequencies(audioBuffer, mode)`
- Applique FFT (taille 4096) sur le signal audio
- Extrait les 5 fréquences dominantes dans la bande ciblée
- Calcule le pattern temporel (nombre d'émissions/sec, durée moyenne)
- Évalue la qualité du signal (RMS, pic, centroïde spectral)

**Sortie exemple :**
```javascript
{
  dominantFrequencies: [
    { frequency: 3420, amplitude: 0.87 },
    { frequency: 6840, amplitude: 0.65 },
    { frequency: 1710, amplitude: 0.43 }
  ],
  temporalPattern: {
    emissionCount: 12,
    emissionsPerSecond: 2.4,
    avgEmissionDuration: 180, // ms
    pattern: "régulier"
  },
  signalQuality: {
    rms: 0.142,
    peak: 0.823,
    signalStrength: 14.2,
    quality: 0.85,
    qualityLabel: "excellent"
  }
}
```

#### `applyBandpassFilter(audioContext, audioBuffer, lowFreq, highFreq)`
- Crée un filtre passe-bande avec BiquadFilters (highpass + lowpass)
- Filtre le signal dans la bande de fréquences ciblée
- Retourne un AudioBuffer filtré prêt pour l'analyse

#### `processAudioBlob(audioBlob, mode)`
- Fonction tout-en-un qui décode l'audio, applique le filtre, et analyse
- Mode 'auto', 'bird', 'insect', 'amphibian', 'mammal'
- Retourne l'analyse complète + métadonnées du filtre appliqué

### 2. Contexte Environnemental (audioContext.js)

**Fonctions principales :**

#### `getTimeOfDay(date)`
Détermine la période de la journée :
- `night` : Nuit profonde (nocturne)
- `dawn` : Aube (crépuscule matinal) - **pic d'activité oiseaux**
- `morning` : Matinée (diurne)
- `afternoon` : Après-midi (diurne)
- `dusk` : Crépuscule (vespéral) - **pic d'activité amphibiens/insectes**

#### `getSeason(date)`
Détermine la saison avec contexte biologique :
- `winter` : Hiver - migrations, hibernation
- `spring` : Printemps - **reproduction, chants nuptiaux intenses**
- `summer` : Été - jeunes éclos, chants territoriaux
- `autumn` : Automne - migrations, préparation hivernale

#### `getBiogeographicRegion(latitude, longitude)`
Classification régionale fine pour Europe/France :
- Nord France (océanique)
- Sud/Méditerranée (méridional)
- Est France (continental/alpin)
- Benelux, Ibérie, Alpes, Europe centrale, etc.

#### `collectEnvironmentalContext(lat, lon, includeWeather)`
Collecte tout le contexte en une seule fois :
```javascript
{
  timeOfDay: { category: "dawn", label: "Aube", hour: 6 },
  season: { season: "spring", label: "Printemps" },
  region: { region: "northern_france", label: "Nord de la France" },
  habitatHint: "Probable : bocage, forêt tempérée",
  weather: { temperature: 12, description: "Partiellement nuageux" }
}
```

#### `suggestSoundType(context)`
Suggère automatiquement le type de son optimal basé sur le contexte :
- Nuit → insectes ou amphibiens
- Aube/matin → oiseaux
- Printemps/été nuit → amphibiens

### 3. Interface Utilisateur (AudioCapture.jsx)

**Nouvelles fonctionnalités :**

1. **Sélecteur de mode intelligent** avec 4 options :
   - ⚡ **Auto** : Détection automatique (recommandé basé sur contexte)
   - 🦜 **Oiseau** : Filtrage 1-8 kHz, max 30 sec
   - 🦗 **Insecte** : Filtrage 3-20 kHz, max 60 sec
   - 🐸 **Amphibien** : Filtrage 200Hz-3kHz, max 45 sec

2. **Indicateur de contexte environnemental** :
   - Affiche heure · saison · région en temps réel
   - Point doré sur le mode suggéré automatiquement

3. **Qualité du signal en temps réel** :
   - 5 barres de niveau (comme réseau mobile)
   - Labels : "excellent" (vert) / "bon" (ambre) / "moyen" (corail) / "faible" (rouge)
   - Basé sur RMS du signal audio

4. **Visualisation de forme d'onde améliorée** :
   - Fond sombre #0A140A
   - Tracé en vert W1LD #3fa34d
   - Animation fluide 60fps

5. **Analyse FFT avant envoi** :
   - Message "Analyse fréquentielle en cours..."
   - Vérification qualité du signal
   - Rejet si signal < 20% (trop faible)

### 4. Backend Vercel (identify-plant.js)

**Modifications :**

#### Prompt Gemini enrichi
Le prompt dynamique inclut maintenant :

```
Contexte de l'enregistrement:
- Type demandé: bird
- Durée: 15s

Analyse fréquentielle (FFT):
- Fréquences dominantes détectées: 3420Hz (87%), 6840Hz (65%), 1710Hz (43%)
- Pattern temporel: 12 émissions détectées, 2.4/sec, durée moyenne 180ms
- Rythme: régulier
- Qualité du signal: excellent
- Intensité du signal: 14.2%
- Filtre appliqué: 1000-8000Hz (Oiseaux diurnes)

Contexte environnemental:
- Heure: 06:24 (Crépuscule matinal)
- Saison: Printemps (Période de reproduction - chants nuptiaux intenses)
- Région biogéographique: Nord de la France (Climat océanique, faune tempérée)
- Habitat probable: Probable : bocage, forêt tempérée, zones humides
- Météo: Partiellement nuageux, 12°C
```

**Instructions enrichies pour Gemini :**
- Utiliser les fréquences dominantes pour affiner l'ID
- Prendre en compte le contexte pour éliminer espèces improbables
- Exemple : nuit + été + sud + 2-4kHz = amphibiens ou orthoptères nocturnes
- Exemple : aube + printemps + 3-7kHz = passereaux en reproduction

## 🎨 Design System

### Couleurs utilisées
```css
--v1v-bg: #0d1b16              /* Fond principal */
--v1v-green: #3fa34d            /* Vert principal W1LD */
--v1v-green-faint: rgba(63, 163, 77, 0.48)
--v1v-green-ghost: rgba(63, 163, 77, 0.18)
--v1v-amber: #fbc02d            /* Indicateur jaune/orange */
--v1v-coral: #ff7043            /* Indicateur orange */
--v1v-danger: rgba(229, 57, 53, 0.95)  /* Rouge erreur */
```

### Icônes
- `Mic` : Bouton d'enregistrement
- `Square` : Bouton stop
- `RotateCcw` : Réessayer
- `Activity` : Contexte environnemental
- `Zap` : Mode auto

## 🚀 Flux Utilisateur

### Scénario typique

1. **Ouverture de l'écran audio**
   - GPS récupère la position → ~1 sec
   - Calcul du contexte environnemental → ~0.2 sec
   - Suggestion automatique du mode (badge doré)

2. **Configuration**
   - Utilisateur voit : "Aube · Printemps · Nord de la France"
   - Mode "Oiseau" suggéré automatiquement (badge doré)
   - Hint : "1-8 kHz · 10-30 sec"

3. **Enregistrement**
   - Tap sur le bouton micro (vert)
   - Visualisation temps réel de la forme d'onde
   - Indicateur de qualité : 5 barres qui montent/descendent
   - Label "excellent" / "bon" / "moyen" / "faible"
   - Timer avec durée max adaptée

4. **Analyse**
   - Stop automatique ou manuel
   - Message : "Analyse fréquentielle en cours..."
   - FFT appliqué sur l'audio → ~0.5 sec
   - Filtre bandpass appliqué
   - Extraction des 5 fréquences dominantes
   - Calcul du pattern temporel

5. **Vérification qualité**
   - Si signal < 20% : "⚠️ Signal trop faible. Réessayez dans un endroit plus calme."
   - Si OK : envoi à l'API

6. **Identification**
   - Payload envoyé avec audio + analyse FFT + contexte
   - Gemini analyse avec prompt enrichi → ~2-4 sec
   - Retour : espèce + confiance + alternatives + anecdote

7. **Résultat**
   - Affichage via `SoundResult.jsx` (existant)
   - Possibilité de sauvegarder dans le journal
   - Badge de rareté (commune/peu commune/rare/légendaire)

## 📊 Performances

### Temps de traitement

| Étape | Temps moyen | Notes |
|-------|-------------|-------|
| Capture GPS + contexte | ~1.2 sec | Au chargement de l'écran |
| Enregistrement | 10-60 sec | Selon le type et l'utilisateur |
| Analyse FFT + filtrage | ~0.5 sec | Local, Web Audio API |
| Upload audio (base64) | ~1-2 sec | Selon la connexion et la durée |
| Gemini identification | ~2-4 sec | API externe |
| **TOTAL** | ~15-70 sec | Dont ~4-8 sec de traitement IA |

### Optimisations

1. **Contexte pré-calculé** : GPS et contexte récupérés dès l'ouverture
2. **Analyse locale** : FFT et filtrage sur le device (pas de latence réseau)
3. **Compression audio** : Base64 avec codecs optimisés (opus/mp4)
4. **Cache météo** : Optionnel, peut être désactivé pour accélérer
5. **Gemini Flash** : Modèle le plus rapide (vs Pro)

## 🧪 Tests et Validation

### Checklist pré-déploiement

- [ ] **iOS réel** : Tester sur iPhone avec micro réel (pas simulateur)
- [ ] **Permissions** : Vérifier NSMicrophoneUsageDescription dans Info.plist ✅
- [ ] **Modes** : Tester les 4 modes (auto, bird, insect, amphibian)
- [ ] **Filtres** : Vérifier que les bandes de fréquences sont appliquées
- [ ] **Contexte** : Tester avec différentes heures/saisons/régions
- [ ] **Qualité signal** : Tester avec audio faible/fort/bruité
- [ ] **Gemini** : Vérifier que le prompt enrichi fonctionne
- [ ] **Fallback** : Tester avec audio vide ou invalide
- [ ] **UI** : Vérifier les indicateurs temps réel
- [ ] **Performance** : Mesurer le temps de traitement FFT

### Scénarios de test

#### Test 1 : Merle noir (Turdus merula) - matin printemps
- **Contexte** : 07:00, avril, nord France
- **Audio** : Chant territorial, 2-5 kHz, rythme régulier
- **Attendu** : Identification correcte, confiance > 70%

#### Test 2 : Criquet champêtre - soir été
- **Contexte** : 21:00, juillet, méditerranée
- **Audio** : Stridulation, 6-12 kHz, continu
- **Attendu** : Identification correcte, mode insecte suggéré

#### Test 3 : Grenouille verte - nuit printemps
- **Contexte** : 23:00, mai, zones humides
- **Audio** : Coassement, 500-2000 Hz, répétitif
- **Attendu** : Mode amphibien suggéré, identification correcte

#### Test 4 : Signal faible/bruité
- **Contexte** : n'importe
- **Audio** : RMS < 0.02, bruit ambiant élevé
- **Attendu** : Message "Signal trop faible", pas d'envoi API

## 🐛 Debugging

### Logs utiles

**Frontend (Console browser)** :
```javascript
// Dans AudioCapture.jsx
console.log("Environmental context:", environmentalContext);
console.log("FFT analysis:", analysisResultRef.current);
console.log("Signal quality:", signalQuality);
```

**Backend (Vercel logs)** :
```javascript
// Dans identify-plant.js
console.log('[identify-plant API][sound] Frequency analysis:', body.frequencyAnalysis);
console.log('[identify-plant API][sound] Environmental context:', body.environmentalContext);
console.log('[identify-plant API][sound] Gemini response:', rawResult);
```

### Erreurs courantes

| Erreur | Cause probable | Solution |
|--------|---------------|----------|
| "Signal trop faible" | Micro trop loin, environnement silencieux | Rapprocher, augmenter volume |
| "Impossible d'accéder au micro" | Permissions iOS refusées | Réactiver dans Réglages > W1LD |
| "Erreur d'analyse" | Blob audio corrompu | Vérifier format MIME supporté |
| "Identification audio impossible" | API Gemini timeout/erreur | Vérifier GEMINI_API_KEY, logs Vercel |
| "Région inconnue" | GPS non disponible | Activer localisation iOS |

## 🔐 Sécurité et Performance

### Environnement variables

```env
GEMINI_API_KEY=xxxxxxxxxxxxx    # Clé API Google Gemini
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxxxxxxxxxxxx
```

### Limites

- **Audio max** : 60 sec (insectes) / 45 sec (amphibiens) / 30 sec (oiseaux)
- **Taille max blob** : ~5-10 MB (selon compression)
- **Rate limit Gemini** : Géré côté API avec retry 3x
- **Daily limit** : Géré par user_profiles.daily_identifications_count

### Capacitor iOS

**Plugins utilisés** :
- `@capacitor/core` : Bridge iOS/JS
- Pas de plugin audio custom nécessaire (Web Audio API suffit)

**AVAudioEngine natif** : Non implémenté (optionnel)
- Le MediaRecorder web fonctionne nativement sur iOS via Capacitor
- Si besoin de qualité supérieure → créer plugin Capacitor custom

## 📚 Références

### APIs utilisées

- **Web Audio API** : https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **MediaRecorder API** : https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- **Gemini 2.5 Flash** : https://ai.google.dev/gemini-api/docs
- **Open-Meteo** : https://open-meteo.com/en/docs

### Bioacoustique

- **Xeno-canto** : Base de données de chants d'oiseaux (référence)
- **Orthoptera.speciesfile.org** : Base de données d'orthoptères
- **AmphibiaWeb** : Base de données d'amphibiens

## 🚀 Prochaines Améliorations

### Court terme
- [ ] Ajouter un spectrogramme visuel pendant l'enregistrement
- [ ] Implémenter le mode "mammifère" (actuellement défini mais pas dans l'UI)
- [ ] Cache des résultats d'identification (éviter duplicatas)
- [ ] Export audio + résultat (partage)

### Moyen terme
- [ ] Plugin Capacitor iOS custom avec AVAudioEngine pour meilleure qualité
- [ ] Noise reduction (filtrage bruit ambiant)
- [ ] Machine learning local (TensorFlow Lite) pour pré-filtrage
- [ ] Intégration avec bases de données bioacoustiques (Xeno-canto API)

### Long terme
- [ ] Mode "enregistrement continu" avec détection automatique
- [ ] Identification multiple (plusieurs espèces dans un enregistrement)
- [ ] Apprentissage personnalisé (correction utilisateur → amélioration modèle)
- [ ] Mode hors-ligne avec modèle embarqué

---

**Version** : 1.0.0
**Date** : 2026-04-21
**Auteur** : W1LD Engineering Team
**QI** : 145+ 🧠✨
