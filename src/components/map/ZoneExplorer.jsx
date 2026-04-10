import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Users, Database, MapPin, Plus, Minus, Filter } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import { getTaxonPhotos, searchTaxon } from '@/api/inaturalist';
import { useZoneLabel } from '@/lib/locationMeta';
import SpeciesMapCanvas from './SpeciesMapCanvas';
import { feedback } from '@/utils/feedback';
import { normalizeSpeciesCategory } from '@/lib/species';
import { resolveDisplayName } from '@/lib/displayName';
import { getReferenceFallbackLabel, isReferenceSpeciesSuspicious, repairReferenceSpeciesRecord } from '@/lib/referenceTaxonomy';
import BlockErrorBoundary from '@/components/shared/BlockErrorBoundary';

/**
 * Explorateur de zone
 * Affiche références locales + observations des utilisateurs
 */

const ZONE_RADIUS_KM = 2; // Rayon de recherche en km
const PHOTO_CACHE_PREFIX = 'w1ld-reference-photo:v2:';
const photoCache = new Map();

function upgradeReferencePhotoUrl(value) {
  const nextUrl = normalizeRemoteImageUrl(value);
  if (!nextUrl) return null;
  return nextUrl.replace(/\/(square|small|medium)\.(jpe?g|png|webp)(\?|$)/i, '/large.$2$3');
}

function isRemoteImageUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function normalizeRemoteImageUrl(value) {
  if (!isRemoteImageUrl(value)) return null;
  return value.replace(/^http:\/\//i, 'https://');
}

function resolveSpeciesPhotoUrl(species) {
  if (!species) return null;
  return (
    upgradeReferencePhotoUrl(species.photo_url) ||
    upgradeReferencePhotoUrl(species.image_url) ||
    upgradeReferencePhotoUrl(species.thumbnail_url) ||
    (isRemoteImageUrl(species.description) ? upgradeReferencePhotoUrl(species.description) : null)
  );
}

function normalizeReferenceKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function getReferencePhotoLookup(referenceList = []) {
  const nextMap = new Map();

  for (const species of referenceList) {
    const photoUrl = resolveSpeciesPhotoUrl(species);
    const scientificKey = normalizeReferenceKey(species?.scientific_name);
    const commonKey = normalizeReferenceKey(species?.common_name);

    if (!photoUrl) continue;
    if (scientificKey && !nextMap.has(scientificKey)) nextMap.set(scientificKey, photoUrl);
    if (commonKey && !nextMap.has(commonKey)) nextMap.set(commonKey, photoUrl);
  }

  return nextMap;
}

function getReferenceScore(species) {
  return (
    (species?.photo_url ? 4 : 0) +
    (!species?.is_suspicious ? 2 : 0) +
    (species?.reference_patched ? 1 : 0)
  );
}

function dedupeReferenceSpecies(referenceList = []) {
  const bestEntries = new Map();

  for (const species of referenceList) {
    const latKey = Number(species?.latitude || 0).toFixed(4);
    const lngKey = Number(species?.longitude || 0).toFixed(4);
    const taxonKey = normalizeReferenceKey(species?.scientific_name || species?.common_name || species?.id);
    const dedupeKey = `${latKey}:${lngKey}:${taxonKey}`;
    const previous = bestEntries.get(dedupeKey);

    if (!previous || getReferenceScore(species) > getReferenceScore(previous)) {
      bestEntries.set(dedupeKey, species);
    }
  }

  return [...bestEntries.values()];
}

function getPhotoCacheKey(species) {
  return String(species?.scientific_name || species?.common_name || species?.id || '')
    .trim()
    .toLowerCase();
}

function readPhotoCache(species) {
  const cacheKey = getPhotoCacheKey(species);
  if (!cacheKey) return null;

  const memoryValue = photoCache.get(cacheKey);
  if (memoryValue) return memoryValue;

  try {
    const stored = localStorage.getItem(`${PHOTO_CACHE_PREFIX}${cacheKey}`);
    if (!stored) return null;
    photoCache.set(cacheKey, stored);
    return stored;
  } catch {
    return null;
  }
}

function writePhotoCache(species, photoUrl) {
  const cacheKey = getPhotoCacheKey(species);
  if (!cacheKey || !photoUrl) return;
  photoCache.set(cacheKey, photoUrl);
  try {
    localStorage.setItem(`${PHOTO_CACHE_PREFIX}${cacheKey}`, photoUrl);
  } catch {}
}

async function resolveDynamicSpeciesPhoto(species) {
  const searchLabel = species?.scientific_name || species?.common_name;
  if (!searchLabel) return null;

  const taxonResult = await searchTaxon(searchLabel);
  const taxon = taxonResult?.taxon;
  if (!taxon?.id) return null;

  const photoResult = await getTaxonPhotos(taxon.id, 1);
  const nextPhoto = upgradeReferencePhotoUrl(photoResult?.photos?.[0]?.photo_url || photoResult?.photos?.[0]?.thumbnail_url);

  return {
    photo_url: nextPhoto || null,
    scientific_name: taxon.name || species?.scientific_name || null,
    common_name: taxon.preferred_common_name || species?.common_name || getReferenceFallbackLabel(species),
    category: normalizeSpeciesCategory(species?.category, {
      ...species,
      scientific_name: taxon.name || species?.scientific_name || null,
      common_name: taxon.preferred_common_name || species?.common_name || null,
    }),
  };
}

export default function ZoneExplorer({ zone, onClose, userEmail }) {
  const zoneId = zone?.zone_id ?? null;
  const [referenceSpecies, setReferenceSpecies] = useState([]);
  const [userDiscoveries, setUserDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [stats, setStats] = useState({ ref: 0, users: 0, uniqueUsers: 0 });
  const [zoomLevel, setZoomLevel] = useState(15);
  const [showOnlyMyDiscoveries, setShowOnlyMyDiscoveries] = useState(false);
  const [showListPanel, setShowListPanel] = useState(null); // 'reference', 'discoveries', ou null
  const { label: zoneName } = useZoneLabel(zoneId);

  // Calculer centre de la zone (même logique que ZoneDetailPanel)
  const ZONE_SIZE_DEG = 0.0045; // Une zone = 0.0045° (~500m)
  const [zLat, zLng] = zoneId ? zoneId.split('_').map(Number) : [0, 0];
  const centerLat = (zLat + 0.5) * ZONE_SIZE_DEG;
  const centerLng = (zLng + 0.5) * ZONE_SIZE_DEG;

  // Debug: monitor zoom level changes
  useEffect(() => {
    console.log('[ZoneExplorer] Zoom level changed to:', zoomLevel);
  }, [zoomLevel]);

  // Charger les données
  useEffect(() => {
    if (!zoneId) return;
    loadZoneData();
  }, [zoneId]);

  useEffect(() => {
    if (!selectedSpecies || selectedSpecies.user_name || resolveSpeciesPhotoUrl(selectedSpecies)) return;

    let cancelled = false;

    void (async () => {
      try {
        const dynamicSpecies = await resolveDynamicSpeciesPhoto(selectedSpecies);
        if (cancelled || !dynamicSpecies?.photo_url) return;

        writePhotoCache(selectedSpecies, dynamicSpecies.photo_url);
        setSelectedSpecies((prev) => (
          prev?.id === selectedSpecies.id
            ? {
                ...prev,
                ...dynamicSpecies,
                photo_url: dynamicSpecies.photo_url,
                common_name: dynamicSpecies.common_name || prev.common_name,
                scientific_name: dynamicSpecies.scientific_name || prev.scientific_name,
                category: dynamicSpecies.category || prev.category,
                is_suspicious: false,
              }
            : prev
        ));
        setReferenceSpecies((prev) => prev.map((entry) => (
          entry.id === selectedSpecies.id
            ? {
                ...entry,
                ...dynamicSpecies,
                photo_url: dynamicSpecies.photo_url,
                common_name: dynamicSpecies.common_name || entry.common_name,
                scientific_name: dynamicSpecies.scientific_name || entry.scientific_name,
                category: dynamicSpecies.category || entry.category,
                is_suspicious: false,
              }
            : entry
        )));
      } catch (photoError) {
        console.warn('[ZoneExplorer] Selected species photo fallback failed:', photoError?.message || photoError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSpecies]);

  // Support scroll wheel pour zoom
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY;
        if (delta < 0 && zoomLevel < 18) {
          // Zoom in
          setZoomLevel(z => Math.min(z + 1, 18));
          feedback('tap', { haptic: true, sound: false });
        } else if (delta > 0 && zoomLevel > 10) {
          // Zoom out
          setZoomLevel(z => Math.max(z - 1, 10));
          feedback('tap', { haptic: true, sound: false });
        }
      }
    };

    const container = document.querySelector('[data-zone-explorer]');
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [zoomLevel]);

  const loadZoneData = async () => {
    setLoading(true);

    try {
      if (!zoneId) {
        setReferenceSpecies([]);
        setUserDiscoveries([]);
        setStats({ ref: 0, users: 0, uniqueUsers: 0 });
        return;
      }
      console.log('[ZoneExplorer] Loading zone:', zoneId);
      console.log('[ZoneExplorer] Center calculated:', { centerLat, centerLng });

      // Calculer les limites géographiques (rayon 2km)
      const latDelta = ZONE_RADIUS_KM / 111; // 1 degré lat ≈ 111 km
      const lngDelta = ZONE_RADIUS_KM / (111 * Math.cos(centerLat * Math.PI / 180));

      const bounds = {
        latMin: centerLat - latDelta,
        latMax: centerLat + latDelta,
        lngMin: centerLng - lngDelta,
        lngMax: centerLng + lngDelta,
      };

      console.log('[ZoneExplorer] Query bounds:', bounds);

      // 1. Charger espèces de référence
      const { data: refData, error: refError } = await supabase
        .from('reference_species')
        .select('*')
        .gte('latitude', bounds.latMin)
        .lte('latitude', bounds.latMax)
        .gte('longitude', bounds.lngMin)
        .lte('longitude', bounds.lngMax);

      if (refError) {
        console.error('[ZoneExplorer] Erreur reference_species:', refError);
      }

      // 2. Charger découvertes utilisateurs
      const { data: discData, error: discError } = await supabase
        .from('plant_discoveries')
        .select('*')
        .gte('latitude', bounds.latMin)
        .lte('latitude', bounds.latMax)
        .gte('longitude', bounds.lngMin)
        .lte('longitude', bounds.lngMax)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (discError) {
        console.error('[ZoneExplorer] Erreur discoveries:', discError);
      }

      console.log('[ZoneExplorer] Raw data:', {
        refCount: refData?.length || 0,
        discCount: discData?.length || 0,
        sampleDisc: discData?.[0],
      });

      const referencePhotoLookup = getReferencePhotoLookup(refData || []);

      const normalizedReferenceSpecies = dedupeReferenceSpecies((refData || []).map((species) => {
        const repairedSpecies = repairReferenceSpeciesRecord(species);
        const sharedPhoto =
          referencePhotoLookup.get(normalizeReferenceKey(repairedSpecies.scientific_name)) ||
          referencePhotoLookup.get(normalizeReferenceKey(repairedSpecies.common_name)) ||
          null;
        const photoUrl = resolveSpeciesPhotoUrl(repairedSpecies) || sharedPhoto || readPhotoCache(repairedSpecies);
        const isSuspicious = isReferenceSpeciesSuspicious(repairedSpecies);

        return {
          ...repairedSpecies,
          common_name: repairedSpecies.common_name || getReferenceFallbackLabel(species),
          photo_url: photoUrl,
          category: normalizeSpeciesCategory(repairedSpecies.category, repairedSpecies),
          rarity: repairedSpecies.rarity || 'commune',
          is_suspicious: isSuspicious,
        };
      })).filter((species) => !(species.is_suspicious && !species.photo_url));

      const discoveryEmails = [...new Set((discData || []).map((entry) => entry.user_email).filter(Boolean))];
      const displayNameMap = new Map();

      if (discoveryEmails.length > 0) {
        const { data: discoveryProfiles, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_email, display_name')
          .in('user_email', discoveryEmails);

        if (profileError) {
          console.warn('[ZoneExplorer] Impossible de charger les noms publics:', profileError.message);
        } else {
          for (const profile of discoveryProfiles || []) {
            displayNameMap.set(
              profile.user_email,
              resolveDisplayName({
                displayName: profile.display_name,
                email: profile.user_email,
              }),
            );
          }
        }
      }

      // Formatter les découvertes avec vrai nom public
      const formattedDiscoveries = (discData || []).map(d => ({
        id: d.id,
        common_name: d.common_name,
        scientific_name: d.scientific_name,
        latitude: d.latitude,
        longitude: d.longitude,
        category: normalizeSpeciesCategory(d.category, d),
        rarity: d.rarity || 'commune',
        photo_url: normalizeRemoteImageUrl(d.photo_url || d.thumbnail_url), // Utiliser photo ou thumbnail
        user_name: displayNameMap.get(d.user_email) || resolveDisplayName({ email: d.user_email, fallback: 'Agent W1LD' }),
        user_email: d.user_email,
        created_at: d.created_at,
      }));

      setReferenceSpecies(normalizedReferenceSpecies);
      setUserDiscoveries(formattedDiscoveries);

      // Calculer stats
      const uniqueUsers = new Set(formattedDiscoveries.map(d => d.user_email)).size;
      const stats = {
        ref: normalizedReferenceSpecies.length,
        users: formattedDiscoveries.length,
        uniqueUsers,
      };
      setStats(stats);

      console.log('[ZoneExplorer] Stats calculated:', stats);
      console.log('[ZoneExplorer] Formatted discoveries sample:', formattedDiscoveries.slice(0, 2));

      const missingPhotos = [...normalizedReferenceSpecies]
        .map((species) => ({
          ...species,
          distance: calculateDistance(centerLat, centerLng, species.latitude, species.longitude),
        }))
        .filter((species) => !species.photo_url && (species.scientific_name || species.common_name))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 60);

      if (missingPhotos.length > 0) {
        void (async () => {
          for (const species of missingPhotos) {
            try {
              const dynamicSpecies = await resolveDynamicSpeciesPhoto(species);
              if (!dynamicSpecies?.photo_url) continue;
              writePhotoCache(species, dynamicSpecies.photo_url);
              setReferenceSpecies((prev) =>
                prev.map((entry) => (
                  entry.id === species.id
                    ? {
                        ...entry,
                        ...dynamicSpecies,
                        photo_url: dynamicSpecies.photo_url,
                        common_name: dynamicSpecies.common_name || entry.common_name,
                        scientific_name: dynamicSpecies.scientific_name || entry.scientific_name,
                        category: dynamicSpecies.category || entry.category,
                        is_suspicious: false,
                      }
                    : entry
                )),
              );
            } catch (photoError) {
              console.warn('[ZoneExplorer] Dynamic photo fallback failed:', species.scientific_name || species.common_name, photoError?.message || photoError);
            }
          }
        })();
      }
    } catch (err) {
      console.error('[ZoneExplorer] Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeciesClick = (species) => {
    feedback('tap', { haptic: true, sound: false });
    setShowListPanel(null);
    setSelectedSpecies(species);
  };

  const handleZoomIn = () => {
    console.log('[ZoneExplorer] Zoom in clicked, current:', zoomLevel);
    if (zoomLevel < 18) {
      feedback('tap', { haptic: true, sound: false });
      setZoomLevel(z => {
        const newZoom = Math.min(z + 1, 18);
        console.log('[ZoneExplorer] New zoom level:', newZoom);
        return newZoom;
      });
    }
  };

  const handleZoomOut = () => {
    console.log('[ZoneExplorer] Zoom out clicked, current:', zoomLevel);
    console.log('[ZoneExplorer] Checking condition: zoomLevel > 10 =', zoomLevel > 10);

    if (zoomLevel > 10) {
      console.log('[ZoneExplorer] Inside zoom out branch - should decrease zoom');
      feedback('tap', { haptic: true, sound: false });
      setZoomLevel(z => {
        const newZoom = Math.max(z - 1, 10);
        console.log('[ZoneExplorer] Setting new zoom level:', newZoom, 'from:', z);
        return newZoom;
      });
      console.log('[ZoneExplorer] After setZoomLevel call');
    } else {
      // Au niveau de zoom minimum, "zoom out" ferme l'explorateur
      console.log('[ZoneExplorer] At min zoom, closing explorer');
      feedback('tap', { haptic: true, sound: false });
      onClose();
    }
    console.log('[ZoneExplorer] handleZoomOut completed');
  };

  const toggleMyDiscoveries = () => {
    feedback('tap', { haptic: true, sound: false });
    setShowOnlyMyDiscoveries(prev => !prev);
  };

  // Calculer la distance entre deux coordonnées (formule Haversine)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const nextLat1 = Number(lat1);
    const nextLon1 = Number(lon1);
    const nextLat2 = Number(lat2);
    const nextLon2 = Number(lon2);
    if (![nextLat1, nextLon1, nextLat2, nextLon2].every(Number.isFinite)) {
      return Number.POSITIVE_INFINITY;
    }
    const R = 6371; // Rayon de la Terre en km
    const dLat = (nextLat2 - nextLat1) * Math.PI / 180;
    const dLon = (nextLon2 - nextLon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(nextLat1 * Math.PI / 180) * Math.cos(nextLat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Retourner en mètres
  };

  // Filtrer les découvertes selon le mode (DOIT être déclaré AVANT sortedUserDiscoveries)
  const filteredDiscoveries = showOnlyMyDiscoveries
    ? userDiscoveries.filter(d => d.user_email === userEmail)
    : userDiscoveries;

  // Trier les espèces par distance
  const sortedReferenceSpecies = [...referenceSpecies]
    .map(species => ({
      ...species,
      distance: calculateDistance(centerLat, centerLng, species.latitude, species.longitude)
    }))
    .sort((a, b) => a.distance - b.distance);

  const sortedUserDiscoveries = [...filteredDiscoveries]
    .map(discovery => ({
      ...discovery,
      distance: calculateDistance(centerLat, centerLng, discovery.latitude, discovery.longitude)
    }))
    .sort((a, b) => a.distance - b.distance);

  // Stats filtrées
  const displayStats = showOnlyMyDiscoveries
    ? {
        ref: stats.ref,
        users: filteredDiscoveries.length,
        uniqueUsers: filteredDiscoveries.length > 0 ? 1 : 0,
      }
    : stats;

  const selectedSpeciesPhoto = resolveSpeciesPhotoUrl(selectedSpecies);
  const selectedSpeciesCommonName = selectedSpecies
    ? (selectedSpecies.common_name || getReferenceFallbackLabel(selectedSpecies))
    : null;

  if (!zoneId) return null;

  return createPortal(
    <div
      data-zone-explorer
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #111711 0%, #0d110d 45%, #0a0d0a 100%)',
      }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-5 py-4"
        style={{
          background: 'linear-gradient(180deg, rgba(20,26,18,0.97) 0%, rgba(16,21,15,0.86) 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(125,160,90,0.18)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p
              className="text-[8px] font-black uppercase tracking-[0.5em] mb-1"
              style={{ color: 'rgba(125,160,90,0.52)' }}
            >
              Atlas local
            </p>
            <h1
              className="text-xl font-black uppercase tracking-wider"
              style={{ color: 'var(--v1v-green)' }}
            >
              {zoneName || zoneId}
            </h1>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
            }}
          >
            <X className="w-5 h-5" style={{ color: 'var(--v1v-fg-muted)' }} />
          </button>
        </div>

        {/* Stats bar - CLIQUABLES */}
        {!loading && (
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => {
                feedback('tap', { haptic: true, sound: false });
                setShowListPanel(showListPanel === 'reference' ? null : 'reference');
              }}
              className="text-left transition-all active:scale-95"
              style={{
                background: showListPanel === 'reference' ? 'rgba(45,122,31,0.2)' : 'rgba(45,122,31,0.1)',
                border: `2px solid ${showListPanel === 'reference' ? 'rgba(45,122,31,0.5)' : 'rgba(45,122,31,0.3)'}`,
                borderRadius: '8px',
                padding: '8px',
              }}
            >
              <Database className="w-3 h-3 mb-1" style={{ color: 'var(--v1v-green)' }} />
              <div className="text-lg font-black" style={{ color: 'var(--v1v-green)' }}>
                {displayStats.ref}
              </div>
              <div className="text-[8px] uppercase tracking-wider" style={{ color: 'rgba(45,122,31,0.6)' }}>
                Référence
              </div>
            </button>

            <button
              onClick={() => {
                feedback('tap', { haptic: true, sound: false });
                setShowListPanel(showListPanel === 'discoveries' ? null : 'discoveries');
              }}
              className="text-left transition-all active:scale-95"
              style={{
                background: showListPanel === 'discoveries' ? 'rgba(111,143,161,0.18)' : 'rgba(111,143,161,0.08)',
                border: `2px solid ${showListPanel === 'discoveries' ? 'rgba(111,143,161,0.42)' : 'rgba(111,143,161,0.24)'}`,
                borderRadius: '8px',
                padding: '8px',
              }}
            >
              <Sparkles className="w-3 h-3 mb-1" style={{ color: 'var(--v1v-blue)' }} />
              <div className="text-lg font-black" style={{ color: 'var(--v1v-blue)' }}>
                {displayStats.users}
              </div>
              <div className="text-[8px] uppercase tracking-wider" style={{ color: 'var(--v1v-blue-muted)' }}>
                {showOnlyMyDiscoveries ? 'Mes Scans' : 'Découvertes'}
              </div>
            </button>

            <div
              style={{
                background: 'rgba(196,154,10,0.1)',
                border: '1px solid rgba(196,154,10,0.3)',
                borderRadius: '8px',
                padding: '8px',
              }}
            >
              <Users className="w-3 h-3 mb-1" style={{ color: 'var(--v1v-amber)' }} />
              <div className="text-lg font-black" style={{ color: 'var(--v1v-amber)' }}>
                {displayStats.uniqueUsers}
              </div>
              <div className="text-[8px] uppercase tracking-wider" style={{ color: 'rgba(181,138,82,0.66)' }}>
                Explorateurs
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Carte Canvas */}
      <div className="flex-1 relative" style={{ background: 'linear-gradient(180deg, #141914 0%, #0d110d 100%)' }}>
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="w-16 h-16 rounded-full border-4 animate-spin mb-4"
              style={{
                borderColor: 'var(--v1v-green)',
                borderTopColor: 'transparent',
              }}
            />
            <p
              className="text-xs uppercase tracking-[0.3em] font-black"
              style={{ color: 'rgba(45,122,31,0.5)' }}
            >
              Scan en cours...
            </p>
          </div>
        ) : (
          <SpeciesMapCanvas
            referenceSpecies={referenceSpecies}
            userDiscoveries={filteredDiscoveries}
            centerLat={centerLat}
            centerLng={centerLng}
            zoomLevel={zoomLevel}
            onSpeciesClick={handleSpeciesClick}
            style={{ width: '100%', height: '100%' }}
          />
        )}

        {/* Contrôles Zoom + Filtre */}
        {!loading && (
          <>
            {/* Boutons Zoom (coin supérieur droit) */}
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button
                onClick={handleZoomIn}
                disabled={zoomLevel >= 18}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                style={{
                  background: zoomLevel >= 18 ? 'rgba(255,255,255,0.03)' : 'rgba(45,122,31,0.15)',
                  border: `1px solid ${zoomLevel >= 18 ? 'rgba(255,255,255,0.05)' : 'rgba(45,122,31,0.4)'}`,
                  borderRadius: '8px',
                  backdropFilter: 'blur(12px)',
                  opacity: zoomLevel >= 18 ? 0.4 : 1,
                  cursor: zoomLevel >= 18 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Plus className="w-5 h-5" style={{ color: 'var(--v1v-green)' }} />
              </button>

              <button
                onClick={handleZoomOut}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                style={{
                  background: zoomLevel <= 10 ? 'rgba(220,50,50,0.15)' : 'rgba(45,122,31,0.15)',
                  border: `1px solid ${zoomLevel <= 10 ? 'rgba(220,50,50,0.4)' : 'rgba(45,122,31,0.4)'}`,
                  borderRadius: '8px',
                  backdropFilter: 'blur(12px)',
                  opacity: 1,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title={zoomLevel <= 10 ? 'Retour à la zone' : 'Dézoomer'}
              >
                {zoomLevel <= 10 ? (
                  <X className="w-5 h-5" style={{ color: '#FF6B6B' }} />
                ) : (
                  <Minus className="w-5 h-5" style={{ color: 'var(--v1v-green)' }} />
                )}
              </button>

              {/* Indicateur niveau de zoom */}
              <div
                className="px-2 py-1 text-center"
                style={{
                  background: 'rgba(0,0,0,0.85)',
                  border: '1px solid rgba(45,122,31,0.3)',
                  borderRadius: '6px',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <span className="text-[10px] font-black" style={{ color: 'var(--v1v-green)' }}>
                  {zoomLevel}
                </span>
              </div>
            </div>

            {/* Bouton Filtre (coin supérieur gauche) */}
            <div className="absolute top-4 left-4">
              <button
                onClick={toggleMyDiscoveries}
                className="min-h-[44px] px-4 flex items-center gap-2"
                style={{
                  background: showOnlyMyDiscoveries ? 'rgba(111,143,161,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${showOnlyMyDiscoveries ? 'rgba(111,143,161,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '8px',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.2s ease',
                }}
              >
                <Filter
                  className="w-4 h-4"
                  style={{ color: showOnlyMyDiscoveries ? 'var(--v1v-blue)' : 'rgba(255,255,255,0.7)' }}
                />
                <span
                  className="text-[10px] font-black uppercase tracking-wider"
                  style={{ color: showOnlyMyDiscoveries ? 'var(--v1v-blue)' : 'rgba(255,255,255,0.7)' }}
                >
                  Mes découvertes
                </span>
              </button>
            </div>
          </>
        )}

        {/* Liste d'espèces (panel slidable) */}
        {!loading && showListPanel && (
          <div
            className="absolute bottom-4 left-4 right-4"
            style={{
              background: 'rgba(0,0,0,0.95)',
              backdropFilter: 'blur(20px)',
              border: '2px solid rgba(45,122,31,0.4)',
              borderRadius: '16px',
              maxHeight: '50vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-3 border-b"
              style={{ borderColor: 'rgba(45,122,31,0.3)' }}
            >
              <div className="flex items-center gap-2">
                {showListPanel === 'reference' ? (
                  <>
                    <Database className="w-4 h-4" style={{ color: 'var(--v1v-green)' }} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--v1v-green)' }}>
                      Références à proximité
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--v1v-blue)' }} />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: 'var(--v1v-blue)' }}>
                      Découvertes
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  feedback('tap', { haptic: true, sound: false });
                  setShowListPanel(null);
                }}
                className="min-w-[32px] min-h-[32px] flex items-center justify-center"
              >
                <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
              </button>
            </div>

            {/* Liste scrollable */}
            <div className="overflow-y-auto p-2" style={{ maxHeight: 'calc(50vh - 60px)' }}>
              {showListPanel === 'reference' ? (
                sortedReferenceSpecies.length > 0 ? (
                  <div className="space-y-2">
                    {sortedReferenceSpecies.map((species) => (
                      (() => {
                        const speciesLabel = species.common_name || getReferenceFallbackLabel(species);
                        return (
                      <button
                        key={species.id}
                        onClick={() => {
                          feedback('tap', { haptic: true, sound: false });
                          handleSpeciesClick(species);
                          setShowListPanel(null);
                        }}
                        className="w-full text-left transition-all active:scale-98"
                        style={{
                          background: 'rgba(45,122,31,0.08)',
                          border: '1px solid rgba(45,122,31,0.2)',
                          borderRadius: '10px',
                          overflow: 'hidden',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Photo thumbnail */}
                          {species.photo_url ? (
                            <div
                              className="flex-shrink-0"
                              style={{
                                width: 72,
                                height: 72,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: 'rgba(45,122,31,0.1)',
                                border: '1px solid rgba(45,122,31,0.18)',
                              }}
                            >
                              <img
                                src={species.photo_url}
                                alt={speciesLabel}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">🌿</div>';
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              className="flex-shrink-0 flex items-center justify-center"
                              style={{
                                width: 72,
                                height: 72,
                                borderRadius: '8px',
                                background: 'rgba(45,122,31,0.15)',
                                fontSize: '24px',
                                border: '1px solid rgba(45,122,31,0.18)',
                              }}
                            >
                              🌿
                            </div>
                          )}

                          {/* Info section */}
                          <div className="flex-1 min-w-0 py-2">
                            <p className="text-[11px] font-black truncate" style={{ color: 'var(--v1v-green)' }}>
                              {speciesLabel}
                            </p>
                            {species.scientific_name && (
                              <p className="text-[9px] italic mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                {species.scientific_name}
                              </p>
                            )}
                          </div>

                          {/* Distance */}
                          <div className="flex-shrink-0 text-right pr-3">
                            <MapPin className="w-3 h-3 mb-0.5 inline" style={{ color: 'rgba(45,122,31,0.6)' }} />
                            <p className="text-[9px] font-black" style={{ color: 'rgba(45,122,31,0.8)' }}>
                              {species.distance < 1000
                                ? `${Math.round(species.distance)}m`
                                : `${(species.distance / 1000).toFixed(1)}km`}
                            </p>
                          </div>
                        </div>
                      </button>
                        );
                      })()
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[10px] py-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Aucune espèce de référence dans cette zone
                  </p>
                )
              ) : (
                sortedUserDiscoveries.length > 0 ? (
                  <div className="space-y-2">
                    {sortedUserDiscoveries.map((discovery) => (
                      <button
                        key={discovery.id}
                        onClick={() => {
                          feedback('tap', { haptic: true, sound: false });
                          handleSpeciesClick(discovery);
                          setShowListPanel(null);
                        }}
                        className="w-full text-left transition-all active:scale-98"
                        style={{
                          background: 'rgba(111,143,161,0.08)',
                          border: '1px solid rgba(111,143,161,0.18)',
                          borderRadius: '10px',
                          overflow: 'hidden',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {/* Photo thumbnail */}
                          {discovery.photo_url ? (
                            <div
                              className="flex-shrink-0"
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: 'rgba(111,143,161,0.1)',
                              }}
                            >
                              <img
                                src={discovery.photo_url}
                                alt={discovery.common_name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.parentElement.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;">📷</div>';
                                }}
                              />
                            </div>
                          ) : (
                            <div
                              className="flex-shrink-0 flex items-center justify-center"
                              style={{
                                width: 56,
                                height: 56,
                                borderRadius: '8px',
                                background: 'rgba(111,143,161,0.15)',
                                fontSize: '24px',
                              }}
                            >
                              📷
                            </div>
                          )}

                          {/* Info section */}
                          <div className="flex-1 min-w-0 py-2">
                            <p className="text-[11px] font-black truncate" style={{ color: 'var(--v1v-blue)' }}>
                              {discovery.common_name}
                            </p>
                            {discovery.user_name && (
                              <p className="text-[9px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                📷 {discovery.user_name}
                              </p>
                            )}
                          </div>

                          {/* Distance */}
                          <div className="flex-shrink-0 text-right pr-3">
                            <MapPin className="w-3 h-3 mb-0.5 inline" style={{ color: 'var(--v1v-blue-muted)' }} />
                            <p className="text-[9px] font-black" style={{ color: 'var(--v1v-blue)' }}>
                              {discovery.distance < 1000
                                ? `${Math.round(discovery.distance)}m`
                                : `${(discovery.distance / 1000).toFixed(1)}km`}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[10px] py-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {showOnlyMyDiscoveries
                      ? 'Vous n\'avez pas encore scanné dans cette zone'
                      : 'Aucune découverte dans cette zone'}
                  </p>
                )
              )}
            </div>
          </div>
        )}

        {/* Légende - cachée si panel ouvert */}
        {!loading && !showListPanel && (
          <div
            className="absolute bottom-4 left-4 right-4"
            style={{
              background: 'rgba(18,22,18,0.88)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(125,160,90,0.22)',
              borderRadius: '12px',
              padding: '12px',
            }}
          >
            <p
              className="text-[8px] font-black uppercase tracking-[0.4em] mb-2"
              style={{ color: 'rgba(125,160,90,0.6)' }}
            >
              Repères
            </p>
            <div className="flex gap-4 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--v1v-green)',
                  }}
                />
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>Références</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--v1v-blue)',
                    border: '2px solid rgba(255,255,255,0.8)',
                  }}
                />
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>Observations</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Species detail panel */}
      {selectedSpecies && (
        <BlockErrorBoundary label="Fiche espèce indisponible">
          <div
            className="absolute inset-0 z-30 flex items-end"
            style={{
              background: 'rgba(7,10,7,0.42)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setSelectedSpecies(null)}
          >
            <div
              className="w-full mx-3 mb-3 overflow-hidden"
              style={{
                background: 'linear-gradient(180deg, rgba(19,24,18,0.97) 0%, rgba(13,17,13,0.97) 100%)',
                backdropFilter: 'blur(24px)',
                border: `1px solid ${selectedSpecies.user_name ? 'rgba(111,143,161,0.28)' : 'rgba(125,160,90,0.24)'}`,
                borderRadius: '22px',
                boxShadow: selectedSpecies.user_name ? '0 18px 50px rgba(111,143,161,0.12)' : '0 18px 50px rgba(125,160,90,0.12)',
                maxHeight: '72vh',
                overflowY: 'auto',
              }}
              onClick={(event) => event.stopPropagation()}
            >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4" style={{ background: 'rgba(17,22,17,0.94)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.32em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {selectedSpecies.user_name ? 'Observation terrain' : 'Référence locale'}
                </p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mt-1" style={{ color: selectedSpecies.user_name ? 'var(--v1v-blue)' : 'var(--v1v-green)' }}>
                  {selectedSpecies.user_name ? selectedSpecies.user_name : zoneName || zoneId}
                </p>
              </div>
              <button
                onClick={() => setSelectedSpecies(null)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '50%',
                }}
              >
                <X className="w-4 h-4" style={{ color: 'var(--v1v-fg-muted)' }} />
              </button>
            </div>

            <div className="px-5 py-5">
              <h3
                className="font-black uppercase tracking-[0.06em]"
                style={{
                  color: selectedSpecies.user_name ? 'var(--v1v-blue)' : 'var(--v1v-green)',
                  fontSize: 24,
                  lineHeight: 1.05,
                }}
              >
                {selectedSpeciesCommonName}
              </h3>
              {selectedSpecies.scientific_name && (
                <p className="text-sm italic mt-2 mb-4" style={{ color: 'rgba(255,255,255,0.52)' }}>
                  {selectedSpecies.scientific_name}
                </p>
              )}
              {selectedSpeciesPhoto ? (
                <div
                  className="mb-4 overflow-hidden"
                  style={{
                    borderRadius: '16px',
                    border: `1px solid ${selectedSpecies.user_name ? 'rgba(111,143,161,0.24)' : 'rgba(125,160,90,0.24)'}`,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.02) 100%)',
                    aspectRatio: '4 / 3',
                  }}
                >
                  <img
                    src={selectedSpeciesPhoto}
                    alt={selectedSpeciesCommonName}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center',
                      display: 'block',
                      background: 'rgba(8,10,8,0.55)',
                    }}
                  />
                </div>
              ) : (
                <div
                  className="mb-4 flex items-center justify-center"
                  style={{
                    height: 180,
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    color: 'rgba(255,255,255,0.34)',
                    fontSize: 14,
                    textTransform: 'uppercase',
                    letterSpacing: '0.28em',
                    fontWeight: 900,
                  }}
                >
                  Recherche d'image...
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span
                  className="px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em]"
                  style={{
                    background: selectedSpecies.user_name ? 'rgba(111,143,161,0.14)' : 'rgba(125,160,90,0.14)',
                    border: `1px solid ${selectedSpecies.user_name ? 'rgba(111,143,161,0.25)' : 'rgba(125,160,90,0.25)'}`,
                    color: selectedSpecies.user_name ? 'var(--v1v-blue)' : 'var(--v1v-green)',
                  }}
                >
                  {selectedSpecies.user_name ? 'Observation terrain' : 'Référence locale'}
                </span>
                {!selectedSpecies.user_name && selectedSpeciesPhoto && (
                  <span
                    className="px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em]"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.55)',
                    }}
                  >
                    Photo synchronisée
                  </span>
                )}
              </div>

              <div
                className="flex items-center gap-2 py-2 px-3 mb-3"
                style={{
                    background: 'rgba(125,160,90,0.08)',
                    border: '1px solid rgba(125,160,90,0.22)',
                    borderRadius: '10px',
                  }}
                >
                <MapPin className="w-4 h-4" style={{ color: 'var(--v1v-green)' }} />
                <div>
                  <p className="text-[10px] font-black" style={{ color: 'var(--v1v-green)' }}>
                    {(() => {
                      const dist = calculateDistance(centerLat, centerLng, selectedSpecies.latitude, selectedSpecies.longitude);
                      if (!Number.isFinite(dist)) return 'position inconnue';
                      return dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;
                    })()}
                  </p>
                  <p className="text-[8px]" style={{ color: 'rgba(125,160,90,0.62)' }}>
                    depuis le coeur de la zone
                  </p>
                </div>
              </div>

              {selectedSpecies.user_name && (
                <div
                  className="flex items-center gap-2 py-2 px-3 mb-3"
                  style={{
                    background: 'rgba(111,143,161,0.1)',
                    border: '1px solid rgba(111,143,161,0.3)',
                    borderRadius: '10px',
                  }}
                >
                  <Users className="w-3 h-3" style={{ color: 'var(--v1v-blue)' }} />
                  <span className="text-[10px] font-bold" style={{ color: 'var(--v1v-blue)' }}>
                    Découvert par {selectedSpecies.user_name}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 text-[10px]">
                <MapPin className="w-3 h-3" style={{ color: 'rgba(45,122,31,0.6)' }} />
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {selectedSpecies.latitude.toFixed(5)}, {selectedSpecies.longitude.toFixed(5)}
                </span>
              </div>
            </div>
            </div>
          </div>
        </BlockErrorBoundary>
      )}
    </div>,
    document.body
  );
}
