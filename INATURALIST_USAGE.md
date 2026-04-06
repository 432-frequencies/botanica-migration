# Utilisation de l'API iNaturalist

## Installation

Les fichiers sont déjà créés :
- Backend : `/api/inaturalist.js`
- Frontend : `/src/api/inaturalist.js`

## 3 Endpoints disponibles

### 1. Rechercher une espèce par nom scientifique

```javascript
import { searchTaxon } from '@/api/inaturalist';

const result = await searchTaxon('Quercus robur');
console.log(result.taxon);
// { id: 123, name: "Quercus robur", preferred_common_name: "Chêne pédonculé", ... }
```

### 2. Obtenir des photos réelles d'une espèce

```javascript
import { getTaxonPhotos } from '@/api/inaturalist';

const result = await getTaxonPhotos(123, 8); // taxonId, limit
console.log(result.photos);
// [
//   {
//     photo_url: "https://...",
//     thumbnail_url: "https://...",
//     observer: "john_doe",
//     observed_on: "2024-03-15",
//     place_guess: "Paris, France",
//     license: "cc-by-nc",
//     attribution: "(c) John Doe, some rights reserved"
//   },
//   ...
// ]
```

### 3. Observations à proximité (géolocalisation)

```javascript
import { getNearbyObservations } from '@/api/inaturalist';

const result = await getNearbyObservations(48.8566, 2.3522, 50, 10);
// lat, lng, radius (km), limit
console.log(result.observations);
// [
//   {
//     taxon_name: "Quercus robur",
//     common_name: "Chêne pédonculé",
//     photo_url: "https://...",
//     observer: "jane_smith",
//     observed_on: "2024-03-20",
//     place_guess: "Bois de Boulogne"
//   },
//   ...
// ]
```

## Intégration avec Gemini

Après identification avec Gemini, enrichissez avec iNaturalist :

```javascript
import { identifyPlant } from '@/api/identifyPlant';
import { searchTaxon, getTaxonPhotos } from '@/api/inaturalist';

// 1. Identifier avec Gemini
const result = await identifyPlant({ imageBase64 });

// 2. Enrichir avec photos réelles d'iNaturalist
const taxon = await searchTaxon(result.top_result.scientific_name);
if (taxon?.taxon?.id) {
  const photos = await getTaxonPhotos(taxon.taxon.id, 6);
  // Afficher les photos réelles dans l'UI
}
```

## Rate Limits

iNaturalist demande :
- **Max 60 requêtes/minute**
- **Max 10 000 requêtes/jour**

→ Mettez en cache les résultats côté client quand possible

## Licences des photos

Les photos iNaturalist ont différentes licences :
- `cc-by` : Attribution requise
- `cc-by-nc` : Attribution + usage non commercial
- `all-rights-reserved` : Tous droits réservés

→ Toujours afficher `attribution` sous les photos

## Exemple d'UI

```jsx
// Après identification Gemini
const [photos, setPhotos] = useState([]);

useEffect(() => {
  async function loadPhotos() {
    const taxon = await searchTaxon(plant.scientific_name);
    if (taxon?.taxon?.id) {
      const result = await getTaxonPhotos(taxon.taxon.id, 6);
      setPhotos(result.photos);
    }
  }
  loadPhotos();
}, [plant]);

return (
  <div>
    <h3>Photos réelles de cette espèce :</h3>
    <div className="photo-grid">
      {photos.map(photo => (
        <div key={photo.photo_url}>
          <img src={photo.photo_url} alt={plant.common_name} />
          <small>{photo.attribution}</small>
        </div>
      ))}
    </div>
  </div>
);
```
