# 🌿 Botanica - W1LD

Application mobile d'identification de plantes, arbres, champignons, oiseaux, insectes et roches avec IA.

## 🚀 Stack Technique

- **Frontend** : React + Vite
- **Backend** : Vercel Serverless Functions
- **Database** : Supabase (Postgres)
- **Storage** : Supabase Storage
- **Auth** : Supabase Auth
- **AI** : Google Gemini (gemini-1.5-flash)
- **Data enrichment** : iNaturalist API

## ✅ Migration Status

**La migration vers Supabase est 100% terminée.**

Voir [`MIGRATION_COMPLETE.md`](./MIGRATION_COMPLETE.md) pour les détails.

## 📦 Installation

### 1. Clone le repo

```bash
git clone https://github.com/432-frequencies/botanica-migration.git
cd botanica-migration
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configuration des variables d'environnement

Créer un fichier `.env.local` :

```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

### 4. Configuration Supabase

**📖 Lire et suivre [`SETUP_SUPABASE.md`](./SETUP_SUPABASE.md)**

Ce fichier contient :
- Création des tables SQL
- Configuration du bucket Storage
- Policies RLS
- Checklist complète

### 5. Lancer l'app en local

```bash
npm run dev
```

L'app sera disponible sur `http://localhost:5173`

## 📱 Features

### MVP (implémenté)

✅ **Authentification**
- Signup/Login avec email + mot de passe
- Session persistante
- Logout

✅ **Onboarding**
- 5 étapes guidées
- Premier scan optionnel
- Géolocalisation optionnelle

✅ **Identification IA**
- Scan photo avec caméra
- Identification via Gemini
- 6 catégories : plant, tree, fungus, bird, insect, rock
- Détection de rareté, toxicité, comestibilité

✅ **Collection**
- Historique des scans
- Système d'XP et de niveaux
- Points par découverte

✅ **Profil**
- Stats personnelles
- Niveau et progression
- Liste des découvertes

### En développement

🚧 **iNaturalist Integration**
- Photos réelles des espèces
- Observations géolocalisées
- API prête, UI à intégrer

🚧 **Leaderboard**
- Classement global
- Zones territoriales
- Table créée, UI à faire

🚧 **Challenges hebdomadaires**
- Défis communautaires
- Table créée, logic à implémenter

🚧 **Badges & Achievements**
- Système de déblocage
- Table créée, UI à faire

## 🗂️ Structure du projet

```
botanica-migration/
├── api/                      # Vercel Serverless Functions
│   ├── identify-plant.js     # Identification Gemini
│   └── inaturalist.js        # iNaturalist API
├── src/
│   ├── api/                  # API clients
│   │   ├── identifyPlant.js
│   │   ├── saveDiscovery.js
│   │   ├── uploadPhoto.js
│   │   ├── getUserProfile.js
│   │   └── inaturalist.js
│   ├── lib/
│   │   ├── AuthContext.jsx   # Supabase Auth
│   │   └── supabaseClient.js
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Onboarding.jsx
│   │   ├── Home.jsx
│   │   └── Profile.jsx
│   └── components/
├── supabase_schema.sql       # Tables principales
├── supabase_missing_tables.sql
├── SETUP_SUPABASE.md         # Guide de configuration
├── MIGRATION_COMPLETE.md     # Détails de la migration
├── INATURALIST_USAGE.md      # Guide iNaturalist
└── README.md                 # Ce fichier
```

## 🧪 Tests

### Parcours utilisateur complet

1. Aller sur `/login`
2. Créer un compte
3. Compléter l'onboarding
4. Scanner une plante
5. Voir le résultat
6. Aller sur `/profile`
7. Vérifier que la découverte est sauvegardée

### Test iNaturalist

```javascript
import { searchTaxon, getTaxonPhotos } from '@/api/inaturalist';

const taxon = await searchTaxon('Quercus robur');
const photos = await getTaxonPhotos(taxon.taxon.id, 6);
console.log(photos);
```

## 📊 Rate Limits

### Gemini API
- Selon votre quota Google Cloud
- Modèle utilisé : `gemini-1.5-flash`

### iNaturalist API
- Max 60 requêtes/minute
- Max 10 000 requêtes/jour
- API publique (gratuite)

### Supabase Free Tier
- 500 MB database
- 1 GB storage
- 2 GB bandwidth/mois

## 🚢 Déploiement

### Vercel (recommandé)

1. Pusher le code sur GitHub
2. Connecter le repo à Vercel
3. Configurer les variables d'environnement :
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Deploy !

### Configuration Supabase

Suivre [`SETUP_SUPABASE.md`](./SETUP_SUPABASE.md)

## 💰 Coûts

### Free Tier (pour commencer)
- ✅ Vercel Hobby : Gratuit
- ✅ Supabase Free : Gratuit
- ✅ iNaturalist : Gratuit

### Payant
- **Gemini API** : ~$5-20/mois selon usage

### Si vous scalez
- Supabase Pro : $25/mois
- Vercel Pro : $20/mois

## 📝 Documentation

- [`SETUP_SUPABASE.md`](./SETUP_SUPABASE.md) : Configuration Supabase complète
- [`MIGRATION_COMPLETE.md`](./MIGRATION_COMPLETE.md) : Détails de la migration
- [`INATURALIST_USAGE.md`](./INATURALIST_USAGE.md) : Guide d'utilisation iNaturalist

## 🐛 Debug

### Erreurs Gemini
- Vérifier `GEMINI_API_KEY`
- Vérifier le quota Google Cloud

### Erreurs Supabase
- Vérifier que les tables existent
- Vérifier les RLS policies
- Vérifier le bucket Storage

### Erreurs d'upload
- Vérifier que le bucket `discoveries` est public
- Vérifier les policies Storage

## 📞 Support

- GitHub Issues : https://github.com/432-frequencies/botanica-migration/issues
- Documentation Supabase : https://supabase.com/docs
- Documentation Gemini : https://ai.google.dev/docs

## 📄 License

Propriétaire - Tous droits réservés

## 👏 Credits

- **Gemini API** : Google
- **iNaturalist** : Community science platform
- **Supabase** : Open source Firebase alternative
- **Vercel** : Deployment platform

---

**🎉 Migration terminée avec succès !**

Pour commencer, suivez [`SETUP_SUPABASE.md`](./SETUP_SUPABASE.md)
