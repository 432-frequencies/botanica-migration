import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { Upload, Play, CheckCircle, XCircle, AlertCircle, Loader, Camera, RefreshCw, Trash2 } from "lucide-react";

const G = "#39FF14";

const STATUS_ICON = {
  updated: <CheckCircle className="w-3.5 h-3.5" style={{ color: "#39C850" }} />,
  dry_run_ok: <CheckCircle className="w-3.5 h-3.5" style={{ color: "#39FF14" }} />,
  not_found: <XCircle className="w-3.5 h-3.5" style={{ color: "#FF4444" }} />,
  no_photo_found: <AlertCircle className="w-3.5 h-3.5" style={{ color: "#FFD700" }} />,
  skipped: <AlertCircle className="w-3.5 h-3.5" style={{ color: "rgba(232,224,208,0.3)" }} />,
};

function PhotoFixPanel() {
  const [running, setRunning] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [log, setLog] = useState([]);
  const [stats, setStats] = useState(null);

  const runBatch = async (offset = 0, accumulated = []) => {
    const res = await base44.functions.invoke("fixSpeciesPhotos", {
      batchSize: 20,
      offset,
      overwrite,
    });
    const data = res.data;
    const newLog = [...accumulated, ...data.results];
    setLog(newLog);
    setStats({ updated: newLog.filter(r => r.status === 'updated').length, failed: newLog.filter(r => r.status === 'no_photo_found').length, total: newLog.length });

    if (data.remaining > 0) {
      await new Promise(r => setTimeout(r, 500));
      await runBatch(data.nextOffset, newLog);
    } else {
      setRunning(false);
    }
  };

  const handleStart = async () => {
    setRunning(true);
    setLog([]);
    setStats(null);
    await runBatch(0, []);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Camera className="w-4 h-4" style={{ color: G }} />
        <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: G }}>Auto-Photos Wikipedia</h2>
      </div>
      <p className="text-[10px] mb-4" style={{ color: "rgba(232,224,208,0.4)" }}>
        Recherche automatique de photos cohérentes sur Wikipedia pour chaque espèce (nom latin + commun).
      </p>

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setOverwrite(!overwrite)} className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
          <div className="w-10 h-5 rounded-full relative transition-all" style={{ background: overwrite ? "rgba(255,100,0,0.3)" : "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.3)" }}>
            <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{ background: overwrite ? "#FF6400" : G, left: overwrite ? "calc(100% - 18px)" : "2px" }} />
          </div>
          <span style={{ color: overwrite ? "#FF6400" : "rgba(57,255,20,0.5)" }}>
            {overwrite ? "Écraser toutes les photos" : "Uniquement les photos manquantes"}
          </span>
        </button>
      </div>

      <button
        onClick={handleStart}
        disabled={running}
        className="w-full py-3 font-black uppercase tracking-widest text-sm transition-all mb-4"
        style={running
          ? { background: "rgba(57,255,20,0.05)", color: "rgba(57,255,20,0.2)", border: "1px solid rgba(57,255,20,0.1)" }
          : { background: G, color: "#050A05", boxShadow: "0 0 20px rgba(57,255,20,0.3)" }
        }
      >
        {running ? (
          <span className="flex items-center justify-center gap-2">
            <Loader className="w-4 h-4 animate-spin" /> Traitement en cours…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> Lancer la correction des photos
          </span>
        )}
      </button>

      {stats && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Mis à jour", value: stats.updated, color: "#39C850" },
            { label: "Sans photo", value: stats.failed, color: "#FFD700" },
            { label: "Traités", value: stats.total, color: G },
          ].map(s => (
            <div key={s.label} className="p-3 text-center" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.1)" }}>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[8px] uppercase tracking-widest mt-1" style={{ color: "rgba(232,224,208,0.4)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {log.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {log.map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ background: "rgba(57,255,20,0.03)", border: "1px solid rgba(57,255,20,0.07)" }}>
              {STATUS_ICON[r.status] || STATUS_ICON.skipped}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black truncate" style={{ color: "#E8E0D0" }}>{r.name}</p>
                {r.latin && <p className="text-[9px] italic truncate" style={{ color: "rgba(232,224,208,0.35)" }}>{r.latin}</p>}
              </div>
              {r.photo_url && <img src={r.photo_url} alt="" className="w-8 h-8 object-cover rounded-sm flex-shrink-0" />}
              <span className="text-[8px] uppercase tracking-wider flex-shrink-0" style={{ color: "rgba(57,255,20,0.4)" }}>
                {r.status.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CsvImportPanel() {
  const [csvContent, setCsvContent] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvContent(ev.target.result);
    reader.readAsText(file, "UTF-8");
  };

  const runImport = async () => {
    if (!csvContent.trim()) return;
    setLoading(true);
    setResults(null);
    const res = await base44.functions.invoke("importSpeciesPhotos", { csvContent, dryRun });
    setResults(res.data);
    setLoading(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Upload className="w-4 h-4" style={{ color: G }} />
        <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: G }}>Import CSV</h2>
      </div>
      <p className="text-[10px] mb-4" style={{ color: "rgba(232,224,208,0.4)" }}>
        Colonnes : Nom_Commun, Nom_Latin
      </p>

      <label className="flex flex-col items-center justify-center w-full py-8 mb-3 cursor-pointer rounded-none border-dashed border transition-all" style={{ borderColor: "rgba(57,255,20,0.25)", background: "rgba(57,255,20,0.03)" }}>
        <Upload className="w-6 h-6 mb-2" style={{ color: "rgba(57,255,20,0.4)" }} />
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: "rgba(57,255,20,0.5)" }}>Charger un fichier CSV</p>
        <input type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
      </label>

      <textarea
        value={csvContent}
        onChange={e => setCsvContent(e.target.value)}
        placeholder="…ou coller le contenu CSV ici"
        rows={5}
        className="w-full p-3 text-[11px] outline-none resize-none mb-3"
        style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.15)", color: "#E8E0D0", fontFamily: "monospace" }}
      />

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setDryRun(!dryRun)} className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
          <div className="w-10 h-5 rounded-full relative transition-all" style={{ background: dryRun ? "rgba(57,255,20,0.3)" : "rgba(57,255,20,0.06)", border: "1px solid rgba(57,255,20,0.3)" }}>
            <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all" style={{ background: G, left: dryRun ? "2px" : "calc(100% - 18px)" }} />
          </div>
          <span style={{ color: dryRun ? G : "rgba(57,255,20,0.4)" }}>{dryRun ? "Simulation" : "Mode réel"}</span>
        </button>
      </div>

      <button
        onClick={runImport}
        disabled={loading || !csvContent.trim()}
        className="w-full py-3 font-black uppercase tracking-widest text-sm transition-all mb-4"
        style={loading || !csvContent.trim()
          ? { background: "rgba(57,255,20,0.05)", color: "rgba(57,255,20,0.2)", border: "1px solid rgba(57,255,20,0.1)" }
          : { background: G, color: "#050A05", boxShadow: "0 0 20px rgba(57,255,20,0.3)" }
        }
      >
        {loading ? <span className="flex items-center justify-center gap-2"><Loader className="w-4 h-4 animate-spin" /> Traitement…</span>
          : <span className="flex items-center justify-center gap-2"><Play className="w-4 h-4" /> Lancer</span>}
      </button>

      {results && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Mis à jour", value: results.updated, color: "#39C850" },
              { label: "Introuvables", value: results.notFound, color: "#FF4444" },
              { label: "Sans photo", value: results.noPhoto, color: "#FFD700" },
            ].map(s => (
              <div key={s.label} className="p-3 text-center" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.1)" }}>
                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[8px] uppercase tracking-widest mt-1" style={{ color: "rgba(232,224,208,0.4)" }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {results.results?.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2" style={{ background: "rgba(57,255,20,0.03)", border: "1px solid rgba(57,255,20,0.07)" }}>
                {STATUS_ICON[r.status] || STATUS_ICON.skipped}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black truncate" style={{ color: "#E8E0D0" }}>{r.name}</p>
                  {r.latin && <p className="text-[9px] italic truncate" style={{ color: "rgba(232,224,208,0.35)" }}>{r.latin}</p>}
                </div>
                {r.photo_url && <img src={r.photo_url} alt="" className="w-8 h-8 object-cover rounded-sm flex-shrink-0" />}
                <span className="text-[8px] uppercase tracking-wider flex-shrink-0" style={{ color: "rgba(57,255,20,0.4)" }}>{r.status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const STEP_IDLE = "idle";
const STEP_RUNNING = "running";
const STEP_OK = "ok";
const STEP_ERR = "err";

function StepRow({ label, status, detail }) {
  const icon = status === STEP_IDLE ? "⏳" : status === STEP_RUNNING ? "🔄" : status === STEP_OK ? "✅" : "❌";
  return (
    <div className="flex items-start gap-3 px-3 py-3" style={{ background: "rgba(57,255,20,0.03)", border: "1px solid rgba(57,255,20,0.08)" }}>
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: status === STEP_ERR ? "#FF4444" : G }}>{label}</p>
        {detail && <p className="text-[10px] mt-0.5 break-all" style={{ color: "rgba(232,224,208,0.5)" }}>{detail}</p>}
      </div>
    </div>
  );
}

function ScanTestPanel() {
  const [steps, setSteps] = useState([
    { id: "image", label: "Étape 1 — Préparer l'image", status: STEP_IDLE, detail: null },
    { id: "identify", label: "Étape 2 — Identification", status: STEP_IDLE, detail: null },
    { id: "save", label: "Étape 3 — Sauvegarde", status: STEP_IDLE, detail: null },
  ]);
  const [running, setRunning] = useState(false);
  const [discoveryId, setDiscoveryId] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const setStep = (id, status, detail) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status, detail } : s));
  };

  const runTest = async () => {
    setRunning(true);
    setDiscoveryId(null);
    setSteps([
      { id: "image", label: "Étape 1 — Préparer l'image", status: STEP_IDLE, detail: null },
      { id: "identify", label: "Étape 2 — Identification", status: STEP_IDLE, detail: null },
      { id: "save", label: "Étape 3 — Sauvegarde", status: STEP_IDLE, detail: null },
    ]);

    // Étape 1 — Upload de la photo sélectionnée
    setStep("image", STEP_RUNNING, null);
    let imageUrl;
    try {
      if (!selectedFile) throw new Error("Aucune photo sélectionnée — choisissez une image ci-dessus");
      setStep("image", STEP_RUNNING, `Upload de "${selectedFile.name}" (~${Math.round(selectedFile.size / 1024)} KB)…`);
      const uploadRes = await base44.integrations.Core.UploadFile({ file: selectedFile });
      console.log("[AdminTest] UploadFile response:", uploadRes);
      imageUrl = uploadRes?.file_url;
      if (!imageUrl) throw new Error(`Upload échoué: ${JSON.stringify(uploadRes)}`);
      setStep("image", STEP_OK, `Image uploadée → ${imageUrl.substring(0, 60)}…`);
    } catch (e) {
      setStep("image", STEP_ERR, e.message);
      setRunning(false);
      return;
    }

    // Étape 2 — Identify avec l'URL publique
    setStep("identify", STEP_RUNNING, null);
    let identifyData;
    try {
      const identifyRes = await base44.functions.invoke("identifyPlant", { imageBase64: imageUrl, isAdminTest: true });
      console.log("[AdminTest] identifyPlant full res:", identifyRes);
      console.log("[AdminTest] identifyPlant res.data:", JSON.stringify(identifyRes?.data));
      identifyData = identifyRes?.data;
      if (identifyData?.error) {
        const detail = `${identifyData.error}${identifyData.reason ? ` — ${identifyData.reason}` : ""} | raw: ${JSON.stringify(identifyData)}`;
        setStep("identify", STEP_ERR, detail);
        setRunning(false);
        return;
      }
      if (!identifyData?.top_result) {
        setStep("identify", STEP_ERR, `Pas de top_result | raw: ${JSON.stringify(identifyData)}`);
        setRunning(false);
        return;
      }
      const top = identifyData.top_result;
      setStep("identify", STEP_OK, `Espèce identifiée — ${top.common_name} (${Math.round((top.confidence || 0) * 100)}% · ${top.rarity})`);
    } catch (e) {
      console.error("[AdminTest] identifyPlant exception:", e);
      setStep("identify", STEP_ERR, `Exception: ${e.message}`);
      setRunning(false);
      return;
    }

    // Étape 3 — Save
    setStep("save", STEP_RUNNING, null);
    try {
      const top = identifyData.top_result;
      let confidence = typeof top.confidence === "number" ? top.confidence : 0;
      if (confidence > 100) confidence = confidence / 100;
      if (confidence > 100) confidence = confidence % 100;
      confidence = Math.round(Math.min(100, Math.max(0, confidence)));

      const payload = {
        category: identifyData.category || "tree",
        common_name: top.common_name || "Espèce inconnue",
        scientific_name: top.scientific_name || "",
        family: top.family || "",
        rarity: top.rarity || "commune",
        description: top.description || "",
        edibility_details: top.edibility_details || "",
        medicinal_uses: top.medicinal_uses || "",
        anecdote: top.anecdote || "",
        habitat: top.habitat || "",
        behavior: top.behavior || "",
        photo_url: imageUrl,
        thumbnail_url: imageUrl,
        latitude: 48.8566,
        longitude: 2.3522,
        location_name: "Test — Paris",
        confidence,
        is_edible: top.is_edible === true,
        is_toxic: top.is_toxic === true,
        is_cannabis: top.is_cannabis === true,
        strain_type: top.strain_type || "",
      };
      console.log("[AdminTest] saveDiscovery payload:", JSON.stringify(payload));

      // Fetch natif pour voir le body brut de la réponse (diagnostic)
      const { appId, token, appBaseUrl } = appParams;
      const baseUrl = appBaseUrl || "https://base44.app";
      const url = `${baseUrl}/api/apps/${appId}/functions/saveDiscovery`;
      console.log("[AdminTest] fetch url:", url);

      const fetchRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const rawBody = await fetchRes.text();
      console.log("[AdminTest] saveDiscovery raw status:", fetchRes.status);
      console.log("[AdminTest] saveDiscovery raw body:", rawBody);

      if (!fetchRes.ok) {
        setStep("save", STEP_ERR, `HTTP ${fetchRes.status} — ${rawBody}`);
        setRunning(false);
        return;
      }

      const saveData = JSON.parse(rawBody);
      if (saveData?.error) {
        setStep("save", STEP_ERR, `${saveData.error} | raw: ${rawBody}`);
        setRunning(false);
        return;
      }
      const xp = saveData?.xp_earned || 10;
      const id = saveData?.discovery_id || saveData?.id;
      setDiscoveryId(id);
      setStep("save", STEP_OK, `Sauvegarde — +${xp} XP · Discovery ID: ${id || "n/a"}`);
    } catch (e) {
      console.error("[AdminTest] saveDiscovery exception:", e);
      setStep("save", STEP_ERR, `Exception: ${e.message}`);
    }

    setRunning(false);
  };

  const handleClean = async () => {
    if (!discoveryId) return;
    setCleaning(true);
    await base44.entities.PlantDiscovery.delete(discoveryId);
    setDiscoveryId(null);
    setCleaning(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">🧪</span>
        <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: G }}>Test Scan Complet</h2>
      </div>
      <p className="text-[10px] mb-4" style={{ color: "rgba(232,224,208,0.4)" }}>
        Exécute le flux complet : chargement image → identifyPlant → saveDiscovery
      </p>

      <label className="flex flex-col items-center justify-center w-full py-5 mb-3 cursor-pointer border-dashed border transition-all"
        style={{ borderColor: selectedFile ? "rgba(57,255,20,0.5)" : "rgba(57,255,20,0.2)", background: "rgba(57,255,20,0.03)" }}>
        <Camera className="w-5 h-5 mb-1.5" style={{ color: selectedFile ? G : "rgba(57,255,20,0.35)" }} />
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: selectedFile ? G : "rgba(57,255,20,0.4)" }}>
          {selectedFile ? selectedFile.name : "Choisir une photo à identifier"}
        </p>
        {selectedFile && (
          <p className="text-[9px] mt-0.5" style={{ color: "rgba(57,255,20,0.4)" }}>
            {Math.round(selectedFile.size / 1024)} KB
          </p>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={e => setSelectedFile(e.target.files[0] || null)} />
      </label>

      <button
        onClick={runTest}
        disabled={running || !selectedFile}
        className="w-full py-3 font-black uppercase tracking-widest text-sm transition-all mb-4"
        style={running || !selectedFile
          ? { background: "rgba(57,255,20,0.05)", color: "rgba(57,255,20,0.2)", border: "1px solid rgba(57,255,20,0.1)" }
          : { background: G, color: "#050A05", boxShadow: "0 0 20px rgba(57,255,20,0.3)" }
        }
      >
        {running
          ? <span className="flex items-center justify-center gap-2"><Loader className="w-4 h-4 animate-spin" /> Test en cours…</span>
          : <span className="flex items-center justify-center gap-2"><Play className="w-4 h-4" /> Lancer le test</span>
        }
      </button>

      <div className="space-y-2 mb-4">
        {steps.map(s => <StepRow key={s.id} label={s.label} status={s.status} detail={s.detail} />)}
      </div>

      {discoveryId && (
        <button
          onClick={handleClean}
          disabled={cleaning}
          className="w-full py-2.5 text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          style={{ border: "1px solid rgba(255,68,68,0.4)", color: "#FF4444", background: "rgba(255,68,68,0.06)" }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {cleaning ? "Nettoyage…" : "Nettoyer le test (supprimer la découverte)"}
        </button>
      )}
    </div>
  );
}

export default function AdminImport() {
  const [tab, setTab] = useState("photos");

  return (
    <div className="min-h-screen px-5 pt-12 pb-24" style={{ background: "#050A05", color: "#E8E0D0" }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: G, boxShadow: `0 0 6px ${G}` }} />
        <p className="text-[8px] tracking-[0.6em] uppercase font-black" style={{ color: "rgba(57,255,20,0.5)" }}>Admin</p>
      </div>
      <h1 className="text-3xl font-black uppercase leading-none mb-6" style={{ color: G, textShadow: "0 0 20px rgba(57,255,20,0.4)" }}>
        Import Tools
      </h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ id: "photos", label: "Auto-Photos" }, { id: "csv", label: "Import CSV" }, { id: "test", label: "🧪 Test Scan" }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-all"
            style={tab === t.id
              ? { background: G, color: "#050A05" }
              : { border: "1px solid rgba(57,255,20,0.2)", color: "rgba(57,255,20,0.45)" }
            }
          >{t.label}</button>
        ))}
      </div>

      {tab === "photos" && <PhotoFixPanel />}
      {tab === "csv" && <CsvImportPanel />}
      {tab === "test" && <ScanTestPanel />}
    </div>
  );
}