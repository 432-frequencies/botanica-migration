import { useState, useEffect, useRef } from "react";
import { supabase } from "@/api/supabaseClient";
import { ChevronLeft, ZoomIn, ZoomOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const G = "#2EA80F";
const gridSize = 40; // km par zone
const LAT_MIN = 42, LAT_MAX = 52, LNG_MIN = -6, LNG_MAX = 8;

function getZoneKey(lat, lng) {
  const gridLat = Math.floor((lat - LAT_MIN) / (LAT_MAX - LAT_MIN) * 10);
  const gridLng = Math.floor((lng - LNG_MIN) / (LNG_MAX - LNG_MIN) * 10);
  return `${gridLat}_${gridLng}`;
}

export default function AdminMap() {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zones, setZones] = useState({});
  const [selectedZone, setSelectedZone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState(false);
  const mapRef = useRef(null);
  const panStart = useRef(null);

  useEffect(() => {
    const loadZones = async () => {
      const { data: leaders } = await supabase.from('zone_leaders').select('*');
      const zoneMap = {};
      
      leaders.forEach((z) => {
        zoneMap[z.zone_id] = {
          leader: z.display_name,
          score: z.species_count,
          users: 1,
        };
      });
      
      setZones(zoneMap);
      setLoading(false);
    };
    
    loadZones();
  }, []);

  const handleMouseDown = (e) => {
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (panStart.current) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    panStart.current = null;
  };

  const renderZones = () => {
    const cells = [];
    const cols = Math.ceil((LNG_MAX - LNG_MIN) / gridSize * zoom);
    const rows = Math.ceil((LAT_MAX - LAT_MIN) / gridSize * zoom);
    const cellW = (200 / (LNG_MAX - LNG_MIN)) * zoom;
    const cellH = (200 / (LAT_MAX - LAT_MIN)) * zoom;

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const lat = LAT_MIN + (i / rows) * (LAT_MAX - LAT_MIN);
        const lng = LNG_MIN + (j / cols) * (LNG_MAX - LNG_MIN);
        const zoneId = getZoneKey(lat, lng);
        const zone = zones[zoneId];
        const isActive = zone && zone.score > 0;
        const intensity = isActive ? Math.min(1, zone.score / 30) : 0.2;

        cells.push(
          <div
            key={`${i}_${j}`}
            onClick={() => isActive && setSelectedZone({ zoneId, ...zone })}
            className="border cursor-pointer transition-colors"
            style={{
              position: "absolute",
              left: `${j * cellW + pan.x}px`,
              top: `${i * cellH + pan.y}px`,
              width: `${cellW}px`,
              height: `${cellH}px`,
              borderColor: `rgba(45,122,31,${isActive ? 0.5 : 0.1})`,
              background: isActive
                ? `rgba(46,168,15,${0.1 + intensity * 0.3})`
                : "rgba(10,15,10,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              color: isActive ? G : "rgba(45,122,31,0.3)",
              fontWeight: "bold",
            }}
          >
            {isActive && zone.leader.substring(0, 2).toUpperCase()}
          </div>
        );
      }
    }
    return cells;
  };

  const stats = {
    total: Object.keys(zones).length,
    active: Object.values(zones).filter((z) => z.score > 0).length,
    empty: Object.keys(zones).length - Object.values(zones).filter((z) => z.score > 0).length,
  };

  return (
    <div
      className="min-h-screen overflow-hidden flex flex-col"
      style={{ background: "var(--v1v-bg)" }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-5 py-4"
        style={{
          borderBottom: "1px solid rgba(45,122,31,0.2)",
          background: "var(--v1v-bg-overlay)",
        }}
      >
        <button
          onClick={() => navigate("/")}
          className="p-2 -ml-2"
          style={{ color: G }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1
            className="text-lg font-black uppercase tracking-[0.2em]"
            style={{ color: G }}
          >
            Zone Map
          </h1>
          <p className="text-xs mt-1" style={{ color: "rgba(226,234,224,0.5)" }}>
            Territoire france
          </p>
        </div>
      </header>

      {/* Map */}
      <div
        ref={mapRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ background: "rgba(8,14,8,0.8)" }}
      >
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {!loading && renderZones()}
        </div>

        {/* Zoom Controls */}
        <div
          className="absolute bottom-6 right-6 flex flex-col gap-2 z-20"
        >
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.2))}
            className="p-2.5 transition-colors"
            style={{
              background: `rgba(46,168,15,0.1)`,
              border: `1px solid ${G}`,
              color: G,
              borderRadius: "6px",
            }}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(Math.max(1, zoom - 0.2))}
            className="p-2.5 transition-colors"
            style={{
              background: `rgba(46,168,15,0.1)`,
              border: `1px solid ${G}`,
              color: G,
              borderRadius: "6px",
            }}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDebug(!debug)}
            className="text-[8px] px-2 py-1"
            style={{
              background: `rgba(46,168,15,${debug ? 0.3 : 0.1})`,
              color: G,
              borderRadius: "4px",
              border: `1px solid ${G}`,
            }}
          >
            DEBUG
          </button>
        </div>

        {/* Debug Panel */}
        {debug && (
          <div
            className="absolute top-6 left-6 p-4 text-xs font-mono z-20"
            style={{
              background: "rgba(8,14,8,0.95)",
              border: `1px solid ${G}`,
              borderRadius: "6px",
            }}
          >
            <p style={{ color: G }}>Zones Totales: {stats.total}</p>
            <p style={{ color: G }}>Actives: {stats.active}</p>
            <p style={{ color: "rgba(45,122,31,0.6)" }}>Vides: {stats.empty}</p>
            <p style={{ color: "rgba(226,234,224,0.5)" }}>Zoom: {zoom.toFixed(1)}</p>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedZone && (
        <div
          className="absolute bottom-0 left-0 right-0 p-5 z-30"
          style={{
            background: "var(--v1v-bg-overlay)",
            borderTop: "1px solid rgba(45,122,31,0.3)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2
              className="text-sm font-black uppercase tracking-[0.2em]"
              style={{ color: G }}
            >
              Zone {selectedZone.zoneId}
            </h2>
            <button
              onClick={() => setSelectedZone(null)}
              className="text-xs"
              style={{ color: "rgba(226,234,224,0.5)" }}
            >
              ✕
            </button>
          </div>
          <div className="text-xs space-y-1" style={{ color: "rgba(226,234,224,0.7)" }}>
            <p>Leader: <span style={{ color: G }}>{selectedZone.leader}</span></p>
            <p>Score: {selectedZone.score} espèces</p>
            <p>Utilisateurs: {selectedZone.users}</p>
          </div>
        </div>
      )}
    </div>
  );
}