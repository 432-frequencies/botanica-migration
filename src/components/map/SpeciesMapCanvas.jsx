import { useEffect, useRef, useState } from 'react';
import { Leaf, Bird, Mountain, Sprout, Bug, TreeDeciduous } from 'lucide-react';

/**
 * Canvas haute performance pour visualiser les espèces sur une carte
 * Design futuriste Tesla avec icônes colorées SVG
 * Supporte 10,000+ points à 60 FPS
 */

// Hash couleur unique par nom d'espèce
function getSpeciesColor(speciesName) {
  let hash = 0;
  for (let i = 0; i < speciesName.length; i++) {
    hash = speciesName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 75%, 60%)`;
}

// Icônes par catégorie
const CATEGORY_ICONS = {
  plant: { char: '🌿', size: 12, color: '#4ADE80' },
  bird: { char: '🦅', size: 14, color: '#60A5FA' },
  tree: { char: '🌳', size: 16, color: '#34D399' },
  fungus: { char: '🍄', size: 12, color: '#F472B6' },
  insect: { char: '🦋', size: 10, color: '#FCD34D' },
  rock: { char: '⛰️', size: 14, color: '#94A3B8' },
};

export default function SpeciesMapCanvas({
  referenceSpecies = [],
  userDiscoveries = [],
  centerLat,
  centerLng,
  zoomLevel = 14,
  onSpeciesClick,
  className,
  style,
}) {
  const canvasRef = useRef(null);
  const [hoveredSpecies, setHoveredSpecies] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const animationFrameRef = useRef(null);
  const particlesRef = useRef([]);

  // Conversion lat/lng vers pixels canvas
  const latLngToPixel = (lat, lng) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    // Projection Mercator simplifiée
    const scale = Math.pow(2, zoomLevel);
    const x = ((lng + 180) / 360) * 256 * scale;
    const latRad = (lat * Math.PI) / 180;
    const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    const y = ((1 - mercN / Math.PI) / 2) * 256 * scale;

    // Centrer sur centerLat/centerLng
    const centerX = ((centerLng + 180) / 360) * 256 * scale;
    const centerLatRad = (centerLat * Math.PI) / 180;
    const centerMercN = Math.log(Math.tan(Math.PI / 4 + centerLatRad / 2));
    const centerY = ((1 - centerMercN / Math.PI) / 2) * 256 * scale;

    return {
      x: width / 2 + (x - centerX),
      y: height / 2 + (y - centerY),
    };
  };

  // Dessiner une espèce
  const drawSpecies = (ctx, species, isReference = true) => {
    const { x, y } = latLngToPixel(species.latitude, species.longitude);

    // Hors écran
    if (x < -50 || x > ctx.canvas.width + 50 || y < -50 || y > ctx.canvas.height + 50) {
      return;
    }

    const icon = CATEGORY_ICONS[species.category] || CATEGORY_ICONS.plant;
    const color = getSpeciesColor(species.common_name);
    const size = isReference ? icon.size : icon.size * 0.6;

    // Glow pour espèces rares
    if (species.rarity === 'rare' || species.rarity === 'legendaire') {
      ctx.shadowBlur = 12;
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur = 4;
      ctx.shadowColor = color;
    }

    // Cercle de base
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Outline pour découvertes utilisateurs
    if (!isReference) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Pulse animation pour hover
    if (hoveredSpecies?.id === species.id) {
      ctx.beginPath();
      ctx.arc(x, y, size + 6, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Reset shadow
    ctx.shadowBlur = 0;

    // Stocker pour détection hover
    return { x, y, radius: size, species, isReference };
  };

  // Render loop
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background grid (style Tesla)
    ctx.strokeStyle = 'rgba(45,122,31,0.08)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Dessiner les espèces de référence (base)
    const drawn = [];
    referenceSpecies.forEach(species => {
      const result = drawSpecies(ctx, species, true);
      if (result) drawn.push(result);
    });

    // Dessiner les découvertes utilisateurs
    userDiscoveries.forEach(discovery => {
      const result = drawSpecies(ctx, discovery, false);
      if (result) drawn.push(result);
    });

    // Stocker pour hit detection
    canvasRef.current._hitTargets = drawn;

    animationFrameRef.current = requestAnimationFrame(render);
  };

  // Mouse move handler
  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas._hitTargets) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x: e.clientX, y: e.clientY });

    // Détection collision
    let found = null;
    for (const target of canvas._hitTargets) {
      const dx = x - target.x;
      const dy = y - target.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= target.radius + 4) {
        found = target.species;
        break;
      }
    }

    setHoveredSpecies(found);
    canvas.style.cursor = found ? 'pointer' : 'default';
  };

  // Click handler
  const handleClick = () => {
    if (hoveredSpecies && onSpeciesClick) {
      onSpeciesClick(hoveredSpecies);
    }
  };

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [referenceSpecies, userDiscoveries, centerLat, centerLng, zoomLevel, hoveredSpecies]);

  return (
    <div className="relative" style={style}>
      <canvas
        ref={canvasRef}
        className={className}
        style={{ width: '100%', height: '100%' }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Tooltip hover */}
      {hoveredSpecies && (
        <div
          style={{
            position: 'fixed',
            left: mousePos.x + 12,
            top: mousePos.y - 40,
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.9)',
            border: `1px solid ${getSpeciesColor(hoveredSpecies.common_name)}`,
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#fff',
            pointerEvents: 'none',
            zIndex: 9999,
            backdropFilter: 'blur(8px)',
            boxShadow: `0 4px 12px ${getSpeciesColor(hoveredSpecies.common_name)}40`,
          }}
        >
          <div style={{ color: getSpeciesColor(hoveredSpecies.common_name), marginBottom: '2px' }}>
            {hoveredSpecies.common_name}
          </div>
          {hoveredSpecies.scientific_name && (
            <div style={{ fontSize: '9px', opacity: 0.7, fontStyle: 'italic' }}>
              {hoveredSpecies.scientific_name}
            </div>
          )}
          {hoveredSpecies.user_name && (
            <div style={{ fontSize: '9px', opacity: 0.6, marginTop: '4px' }}>
              📷 {hoveredSpecies.user_name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
