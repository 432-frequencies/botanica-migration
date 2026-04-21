import { createApiUrl } from "@/lib/app-config";

const FALLBACK_SPOTS = [
  {
    name: "Espace vert proche",
    distanceMeters: 420,
    speciesCount: 18,
    habitatLabel: "repère à vérifier",
    opportunity: "Active la localisation pour révéler les jardins, bois et parcs les plus proches.",
  },
  {
    name: "Bois ou jardin à explorer",
    distanceMeters: 820,
    speciesCount: 24,
    habitatLabel: "milieu naturel proche",
    opportunity: "Cherche une lisière, un alignement d’arbres ou un square calme pour démarrer.",
  },
];

function hasValidCoords(coords) {
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function coordSeed(coords) {
  const lat = Number(coords?.lat) || 0;
  const lng = Number(coords?.lng) || 0;
  return Math.abs(Math.round((lat * 9973) + (lng * 3761)));
}

function localFallbackSpots(coords) {
  if (!hasValidCoords(coords)) return FALLBACK_SPOTS;
  const seed = coordSeed(coords);
  return [
    {
      name: "Espace vert proche",
      distanceMeters: 260 + (seed % 360),
      speciesCount: 16 + (seed % 22),
      habitatLabel: "repère à vérifier",
      opportunity: "Ta position est prise en compte. On cherche le jardin, parc ou bois le plus pertinent autour de toi.",
    },
    {
      name: "Lisière ou jardin à explorer",
      distanceMeters: 740 + (seed % 640),
      speciesCount: 22 + (seed % 18),
      habitatLabel: "milieu vivant proche",
      opportunity: "Un bon point de départ si le réseau met trop longtemps à synchroniser les lieux exacts.",
    },
  ];
}

export async function getNearbySpots({ coords } = {}) {
  if (!hasValidCoords(coords)) return FALLBACK_SPOTS;

  try {
    const params = new URLSearchParams({
      lat: String(coords.lat),
      lng: String(coords.lng),
      radius: "9000",
    });
    const response = await fetch(createApiUrl(`/api/nearby-spots?${params.toString()}`));
    if (!response.ok) throw new Error(`nearby-spots ${response.status}`);
    const payload = await response.json();
    const spots = Array.isArray(payload?.spots) ? payload.spots : [];
    return spots.length ? spots : localFallbackSpots(coords);
  } catch {
    return localFallbackSpots(coords);
  }
}
