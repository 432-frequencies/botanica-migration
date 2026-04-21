# 🚀 Guide de Déploiement iOS - Système Audio W1LD

## ⚡ Déploiement Rapide (5 minutes)

### 1. Build du frontend
```bash
# Depuis botanica-migration/
npm install
npm run build
```

### 2. Sync Capacitor iOS
```bash
npx cap sync ios
```

### 3. Ouvrir Xcode
```bash
npx cap open ios
```

### 4. Tester sur iPhone réel

Dans Xcode :
1. Sélectionner votre iPhone dans la liste des devices
2. Activer "Signing & Capabilities" → choisir votre Team
3. Build et run (Cmd + R)

### 5. Vérifier les permissions

Sur l'iPhone, lors du premier lancement audio :
- iOS demande : "W1LD utilise le microphone pour identifier les oiseaux et insectes par leurs sons."
- **Autoriser** ✅

---

## 🔧 Configuration Détaillée

### Variables d'environnement Vercel

Vérifier que ces variables sont bien configurées dans le dashboard Vercel :

```env
GEMINI_API_KEY=xxxxxxxxxxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxxxxxxxxxx
```

### Info.plist (déjà configuré ✅)

Le fichier `/ios/App/App/Info.plist` contient déjà :

```xml
<key>NSMicrophoneUsageDescription</key>
<string>W1LD utilise le microphone pour identifier les oiseaux et insectes par leurs sons.</string>
```

Pas besoin de modification !

### Build Configuration

**Vite** (vite.config.js) :
- Build chunking configuré ✅
- Output dans `/dist` ✅

**Capacitor** (capacitor.config.ts) :
- webDir: "dist" ✅
- iOS bundle ID: "com.w1ld.botanica" ✅

---

## 🧪 Tests à Effectuer

### Test 1 : Interface Audio

1. Ouvrir l'app sur iPhone
2. Aller sur la page d'accueil
3. Tap sur "Écoute du vivant" 🎵
4. Vérifier :
   - ✅ Contexte environnemental affiché (heure, saison, région)
   - ✅ 4 modes disponibles (Auto, Oiseau, Insecte, Amphibien)
   - ✅ Badge doré sur le mode suggéré
   - ✅ Hints de fréquences affichés

### Test 2 : Enregistrement

1. Tap sur le bouton micro (vert)
2. Parler ou faire du bruit
3. Vérifier :
   - ✅ Visualisation temps réel de la forme d'onde (vert)
   - ✅ Indicateur de qualité du signal (5 barres)
   - ✅ Label "excellent" / "bon" / "moyen" / "faible"
   - ✅ Timer qui augmente
   - ✅ Bouton stop (carré rouge) fonctionnel

### Test 3 : Analyse FFT

1. Enregistrer 10 secondes de bruit/parole
2. Tap sur stop
3. Vérifier :
   - ✅ Message "Analyse fréquentielle en cours..."
   - ✅ Processing indicator (point vert animé)
   - ✅ Bouton "Identifier" apparaît après analyse

### Test 4 : Identification

1. Tap sur "Identifier"
2. Attendre 2-4 secondes
3. Vérifier :
   - ✅ Résultat affiché avec espèce
   - ✅ Confiance + badge de rareté
   - ✅ Description + anecdote
   - ✅ Possibilité de sauvegarder

### Test 5 : Signal faible

1. Enregistrer dans un endroit très silencieux (presque pas de son)
2. Tap sur stop → "Identifier"
3. Vérifier :
   - ✅ Message "⚠️ Signal trop faible. Réessayez dans un endroit plus calme."
   - ✅ Pas d'envoi à l'API (vérifier logs Vercel)

---

## 🐛 Troubleshooting

### Problème : "Impossible d'accéder au micro"

**Cause** : Permissions refusées par l'utilisateur

**Solution** :
1. Ouvrir Réglages iOS
2. Descendre jusqu'à "W1LD"
3. Activer "Microphone" ✅
4. Relancer l'app

### Problème : "Erreur d'analyse"

**Cause** : Audio blob corrompu ou format non supporté

**Solution** :
1. Vérifier les logs console browser : `console.log(audioBlob.type)`
2. Formats supportés : audio/mp4, audio/webm, audio/ogg
3. Sur iOS, généralement audio/mp4 est utilisé

### Problème : Pas de contexte environnemental

**Cause** : GPS non autorisé ou hors connexion

**Solution** :
1. Vérifier que la localisation est activée pour W1LD
2. Réglages > Confidentialité > Localisation > W1LD > "Lors de l'utilisation"
3. Le contexte fonctionne hors ligne (pas besoin d'API météo)

### Problème : Gemini ne répond pas

**Cause** : API key invalide ou rate limit

**Solution** :
1. Vérifier GEMINI_API_KEY dans Vercel dashboard
2. Tester l'API key : https://aistudio.google.com/apikey
3. Vérifier les logs Vercel : `vercel logs`
4. Retry automatique 3x implémenté

### Problème : Visualisation ne s'affiche pas

**Cause** : Canvas ref non initialisé ou Web Audio API bloquée

**Solution** :
1. Vérifier que le navigateur supporte Web Audio API
2. Sur iOS, Web Audio est supporté nativement dans WKWebView ✅
3. Vérifier les logs console pour erreurs

---

## 📊 Monitoring

### Logs Vercel (Backend)

```bash
# Voir les logs en temps réel
vercel logs --follow

# Filtrer les logs audio
vercel logs | grep "[sound]"
```

**Ce qu'il faut voir** :
```
[identify-plant API][sound] Frequency analysis: { frequencies: "3420Hz (87%), ..." }
[identify-plant API][sound] Environmental context: { timeOfDay: {...}, season: {...} }
[identify-plant API][sound] Gemini response: { found: true, common_name: "..." }
```

### Console Browser (Frontend)

Sur iOS, activer Safari Web Inspector :
1. iPhone : Réglages > Safari > Avancé > Inspecteur web ✅
2. Mac : Safari > Préférences > Avancées > "Afficher le menu Développement"
3. Safari Mac > Développement > [Votre iPhone] > W1LD

**Ce qu'il faut voir** :
```javascript
Environmental context: { timeOfDay: {...}, season: {...}, region: {...} }
FFT analysis: { dominantFrequencies: [...], temporalPattern: {...} }
Signal quality: { strength: 14.2, quality: "excellent" }
```

---

## 🔄 Workflow de Développement

### Modification du code

```bash
# 1. Modifier le code source
vim src/components/identify/AudioCapture.jsx

# 2. Rebuild
npm run build

# 3. Sync iOS
npx cap sync ios

# 4. Rerun dans Xcode
# Xcode → Build (Cmd + R)
```

### Hot Reload (développement web)

```bash
# Lancer le dev server
npm run dev

# Ouvrir dans le navigateur
open http://localhost:5173

# Tester l'audio dans le browser (pas besoin d'iOS pour debug rapide)
```

**Note** : Le browser desktop n'a pas de GPS précis, le contexte sera moins précis.

---

## 📦 Déploiement Production

### 1. Build production

```bash
npm run build
npx cap sync ios
```

### 2. Archiver l'app (Xcode)

1. Product > Archive
2. Distribuer via App Store Connect
3. Uploader vers TestFlight

### 3. Déployer l'API (Vercel)

```bash
vercel --prod
```

**Ou via Git** :
```bash
git add .
git commit -m "feat: advanced audio identification with FFT analysis"
git push origin main
```

Vercel déploie automatiquement sur push vers `main` ✅

---

## ✅ Checklist Finale

Avant de considérer le système prêt pour production :

### Fonctionnalités
- [ ] ✅ Capture audio fonctionne sur iOS réel
- [ ] ✅ Les 4 modes sont fonctionnels
- [ ] ✅ Analyse FFT locale fonctionne
- [ ] ✅ Contexte environnemental s'affiche
- [ ] ✅ Suggestion automatique de mode fonctionne
- [ ] ✅ Indicateur qualité signal fonctionne
- [ ] ✅ Gemini reçoit le prompt enrichi
- [ ] ✅ Résultats sont cohérents avec le contexte

### Performance
- [ ] ✅ Analyse FFT < 1 sec
- [ ] ✅ Gemini répond en < 5 sec
- [ ] ✅ Total < 10 sec (hors enregistrement)
- [ ] ✅ Pas de freeze UI pendant FFT

### UX
- [ ] ✅ Messages d'erreur clairs
- [ ] ✅ Visualisation fluide (60fps)
- [ ] ✅ Design cohérent avec W1LD
- [ ] ✅ Permissions bien gérées

### Tests Réels
- [ ] Tester avec vrais chants d'oiseaux (YouTube/Xeno-canto)
- [ ] Tester avec insectes nocturnes (grillons, cigales)
- [ ] Tester avec amphibiens (grenouilles)
- [ ] Tester dans environnements bruités
- [ ] Tester dans environnements silencieux

---

## 🎉 C'est Prêt !

Votre système d'identification sonore avec analyse fréquentielle intelligente est maintenant opérationnel.

**Prochaines étapes** :
1. Tester sur iOS réel avec des sons variés
2. Collecter du feedback utilisateur
3. Affiner les seuils de qualité si besoin
4. Ajouter plus de types d'organismes (mammifères, etc.)

**Support** :
- Documentation complète : `AUDIO_IDENTIFICATION_SYSTEM.md`
- Logs : Vercel dashboard + Safari Web Inspector
- Code source : `src/utils/audio*.js` + `src/components/identify/AudioCapture.jsx`

---

**Happy Coding! 🚀**
**QI 145+ Team 🧠✨**
