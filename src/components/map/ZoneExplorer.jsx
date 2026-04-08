import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Users, Database, Zap, MapPin, ChevronRight, Plus, Minus, Filter } from 'lucide-react';
import { supabase } from '@/api/supabaseClient';
import SpeciesMapCanvas from './SpeciesMapCanvas';
import { feedback } from '@/utils/feedback';

/**
 * Explorateur de zone ultra-futuriste (style Tesla 2030)
 * Affiche espèces de référence + découvertes utilisateurs
 */

const ZONE_RADIUS_KM = 2; // Rayon de recherche en km

export default function ZoneExplorer({ zone, onClose, userEmail }) {
  const [referenceSpecies, setReferenceSpecies] = useState([]);
  const [userDiscoveries, setUserDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSpecies, setSelectedSpecies] = useState(null);
  const [stats, setStats] = useState({ ref: 0, users: 0, uniqueUsers: 0 });
  const [zoomLevel, setZoomLevel] = useState(15);
  const [showOnlyMyDiscoveries, setShowOnlyMyDiscoveries] = useState(false);

  // Calculer centre de la zone
  const ZONE_DEG = 0.0045;
  const [zLat, zLng] = zone.zone_id.split('_').map(Number);
  const centerLat = (zLat + 0.5) * ZONE_DEG;
  const centerLng = (zLng + 0.5) * ZONE_DEG;

  // Charger les données
  useEffect(() => {
    loadZoneData();
  }, [zone.zone_id]);

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
      // Calculer les limites géographiques (rayon 2km)
      const latDelta = ZONE_RADIUS_KM / 111; // 1 degré lat ≈ 111 km
      const lngDelta = ZONE_RADIUS_KM / (111 * Math.cos(centerLat * Math.PI / 180));

      const bounds = {
        latMin: centerLat - latDelta,
        latMax: centerLat + latDelta,
        lngMin: centerLng - lngDelta,
        lngMax: centerLng + lngDelta,
      };

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
        .select('*, user_profiles(display_name)')
        .gte('latitude', bounds.latMin)
        .lte('latitude', bounds.latMax)
        .gte('longitude', bounds.lngMin)
        .lte('longitude', bounds.lngMax)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (discError) {
        console.error('[ZoneExplorer] Erreur discoveries:', discError);
      }

      // Formatter les découvertes avec nom utilisateur
      const formattedDiscoveries = (discData || []).map(d => ({
        id: d.id,
        common_name: d.common_name,
        scientific_name: d.scientific_name,
        latitude: d.latitude,
        longitude: d.longitude,
        category: d.category || 'plant',
        rarity: d.rarity || 'commune',
        user_name: d.user_profiles?.display_name || d.user_email?.split('@')[0] || 'Anonyme',
        user_email: d.user_email,
        created_at: d.created_at,
      }));

      setReferenceSpecies(refData || []);
      setUserDiscoveries(formattedDiscoveries);

      // Calculer stats
      const uniqueUsers = new Set(formattedDiscoveries.map(d => d.user_email)).size;
      setStats({
        ref: refData?.length || 0,
        users: formattedDiscoveries.length,
        uniqueUsers,
      });
    } catch (err) {
      console.error('[ZoneExplorer] Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSpeciesClick = (species) => {
    feedback('tap', { haptic: true, sound: false });
    setSelectedSpecies(species);
  };

  const handleZoomIn = () => {
    if (zoomLevel < 18) {
      feedback('tap', { haptic: true, sound: false });
      setZoomLevel(z => Math.min(z + 1, 18));
    }
  };

  const handleZoomOut = () => {
    if (zoomLevel > 10) {
      feedback('tap', { haptic: true, sound: false });
      setZoomLevel(z => Math.max(z - 1, 10));
    }
  };

  const toggleMyDiscoveries = () => {
    feedback('tap', { haptic: true, sound: false });
    setShowOnlyMyDiscoveries(prev => !prev);
  };

  // Filtrer les découvertes selon le mode
  const filteredDiscoveries = showOnlyMyDiscoveries
    ? userDiscoveries.filter(d => d.user_email === userEmail)
    : userDiscoveries;

  // Stats filtrées
  const displayStats = showOnlyMyDiscoveries
    ? {
        ref: stats.ref,
        users: filteredDiscoveries.length,
        uniqueUsers: filteredDiscoveries.length > 0 ? 1 : 0,
      }
    : stats;

  return createPortal(
    <div
      data-zone-explorer
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{
        background: 'linear-gradient(180deg, #000000 0%, #0A0A0A 100%)',
      }}
    >
      {/* Header futuriste */}
      <div
        className="flex-shrink-0 px-5 py-4"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 100%)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(45,122,31,0.2)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p
              className="text-[8px] font-black uppercase tracking-[0.5em] mb-1"
              style={{ color: 'rgba(45,122,31,0.5)' }}
            >
              Exploration Zone
            </p>
            <h1
              className="text-xl font-black uppercase tracking-wider"
              style={{ color: 'var(--v1v-green)' }}
            >
              {zone.zone_id}
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

        {/* Stats bar */}
        {!loading && (
          <div className="grid grid-cols-3 gap-2">
            <div
              style={{
                background: 'rgba(45,122,31,0.1)',
                border: '1px solid rgba(45,122,31,0.3)',
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
            </div>

            <div
              style={{
                background: 'rgba(59,125,232,0.1)',
                border: '1px solid rgba(59,125,232,0.3)',
                borderRadius: '8px',
                padding: '8px',
              }}
            >
              <Sparkles className="w-3 h-3 mb-1" style={{ color: '#3B7DE8' }} />
              <div className="text-lg font-black" style={{ color: '#3B7DE8' }}>
                {displayStats.users}
              </div>
              <div className="text-[8px] uppercase tracking-wider" style={{ color: 'rgba(59,125,232,0.6)' }}>
                {showOnlyMyDiscoveries ? 'Mes Scans' : 'Découvertes'}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(196,154,10,0.1)',
                border: '1px solid rgba(196,154,10,0.3)',
                borderRadius: '8px',
                padding: '8px',
              }}
            >
              <Users className="w-3 h-3 mb-1" style={{ color: '#C49A0A' }} />
              <div className="text-lg font-black" style={{ color: '#C49A0A' }}>
                {displayStats.uniqueUsers}
              </div>
              <div className="text-[8px] uppercase tracking-wider" style={{ color: 'rgba(196,154,10,0.6)' }}>
                Explorateurs
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Carte Canvas */}
      <div className="flex-1 relative" style={{ background: '#0A0A0A' }}>
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
                disabled={zoomLevel <= 10}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center"
                style={{
                  background: zoomLevel <= 10 ? 'rgba(255,255,255,0.03)' : 'rgba(45,122,31,0.15)',
                  border: `1px solid ${zoomLevel <= 10 ? 'rgba(255,255,255,0.05)' : 'rgba(45,122,31,0.4)'}`,
                  borderRadius: '8px',
                  backdropFilter: 'blur(12px)',
                  opacity: zoomLevel <= 10 ? 0.4 : 1,
                  cursor: zoomLevel <= 10 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Minus className="w-5 h-5" style={{ color: 'var(--v1v-green)' }} />
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
                  background: showOnlyMyDiscoveries ? 'rgba(59,125,232,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${showOnlyMyDiscoveries ? 'rgba(59,125,232,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '8px',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.2s ease',
                }}
              >
                <Filter
                  className="w-4 h-4"
                  style={{ color: showOnlyMyDiscoveries ? '#3B7DE8' : 'rgba(255,255,255,0.7)' }}
                />
                <span
                  className="text-[10px] font-black uppercase tracking-wider"
                  style={{ color: showOnlyMyDiscoveries ? '#3B7DE8' : 'rgba(255,255,255,0.7)' }}
                >
                  Mes découvertes
                </span>
              </button>
            </div>
          </>
        )}

        {/* Légende */}
        {!loading && (
          <div
            className="absolute bottom-4 left-4 right-4"
            style={{
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(45,122,31,0.3)',
              borderRadius: '12px',
              padding: '12px',
            }}
          >
            <p
              className="text-[8px] font-black uppercase tracking-[0.4em] mb-2"
              style={{ color: 'rgba(45,122,31,0.6)' }}
            >
              Légende
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
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>Base données</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#3B7DE8',
                    border: '2px solid rgba(255,255,255,0.8)',
                  }}
                />
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>Utilisateurs</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Species detail panel */}
      {selectedSpecies && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            background: 'rgba(0,0,0,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(45,122,31,0.3)',
            borderRadius: '20px 20px 0 0',
            padding: '20px',
            maxHeight: '40vh',
            overflowY: 'auto',
          }}
        >
          <button
            onClick={() => setSelectedSpecies(null)}
            className="absolute top-3 right-3 min-w-[36px] min-h-[36px] flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '50%',
            }}
          >
            <X className="w-4 h-4" style={{ color: 'var(--v1v-fg-muted)' }} />
          </button>

          <h3
            className="text-lg font-black uppercase tracking-wide mb-1"
            style={{ color: 'var(--v1v-green)' }}
          >
            {selectedSpecies.common_name}
          </h3>
          {selectedSpecies.scientific_name && (
            <p className="text-xs italic mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {selectedSpecies.scientific_name}
            </p>
          )}

          {selectedSpecies.user_name && (
            <div
              className="flex items-center gap-2 py-2 px-3 mb-3"
              style={{
                background: 'rgba(59,125,232,0.1)',
                border: '1px solid rgba(59,125,232,0.3)',
                borderRadius: '8px',
              }}
            >
              <Users className="w-3 h-3" style={{ color: '#3B7DE8' }} />
              <span className="text-[10px] font-bold" style={{ color: '#3B7DE8' }}>
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
      )}
    </div>,
    document.body
  );
}
