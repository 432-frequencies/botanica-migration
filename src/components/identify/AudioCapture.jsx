import { useState, useRef, useEffect } from "react";
import { Mic, Square, RotateCcw, Activity, Zap } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { processAudioBlob, visualizeAudioLevels, formatAnalysisForPrompt } from "@/utils/audioAnalysis";
import { collectEnvironmentalContext, suggestSoundType } from "@/utils/audioContext";

export default function AudioCapture({ onCapture, onCancel }) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [location, setLocation] = useState(null);
  const [soundType, setSoundType] = useState("auto"); // "auto" | "bird" | "insect" | "amphibian"
  const [inlineMessage, setInlineMessage] = useState(null);
  const [signalQuality, setSignalQuality] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [environmentalContext, setEnvironmentalContext] = useState(null);
  const [suggestedType, setSuggestedType] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const analysisResultRef = useRef(null);

  useEffect(() => {
    // Get geolocation and environmental context on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          };
          setLocation(coords);

          // Collect environmental context
          const context = await collectEnvironmentalContext(
            coords.latitude,
            coords.longitude,
            false // Don't fetch weather to keep it fast
          );
          setEnvironmentalContext(context);

          // Suggest optimal sound type
          const suggested = suggestSoundType(context);
          setSuggestedType(suggested);

          // Auto-set if not already set
          if (soundType === "auto") {
            setSoundType(suggested);
          }
        },
        (err) => console.log("Geolocation error:", err)
      );
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      streamRef.current?.getTracks?.().forEach((track) => track.stop());
    };
  }, []);

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported?.(type)) || "";
  };

  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Use our advanced visualization function
    visualizeAudioLevels(analyserRef.current, ctx, canvas.width, canvas.height);

    // Calculate real-time signal quality
    const bufferLength = analyserRef.current.frequencyBinCount;
    const timeDomainData = new Uint8Array(bufferLength);
    const frequencyData = new Uint8Array(bufferLength);

    analyserRef.current.getByteTimeDomainData(timeDomainData);
    analyserRef.current.getByteFrequencyData(frequencyData);

    // Calculate RMS for signal strength
    let sumSquares = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const normalized = (timeDomainData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / timeDomainData.length);
    const signalStrength = Math.round(rms * 100);

    // Update signal quality indicator
    let quality = "faible";
    if (signalStrength > 15) quality = "excellent";
    else if (signalStrength > 8) quality = "bon";
    else if (signalStrength > 3) quality = "moyen";

    setSignalQuality({ strength: signalStrength, quality });

    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  };

  const startRecording = async () => {
    try {
      setInlineMessage(null);
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setInlineMessage(t("audio.unavailable"));
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Setup Web Audio API for visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      // Setup MediaRecorder
      const mimeType = getSupportedMimeType();
      mediaRecorderRef.current = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blobType = mediaRecorderRef.current?.mimeType || mimeType || "audio/webm";
        const blob = new Blob(audioChunksRef.current, { type: blobType });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      setDuration(0);

      // Start visualization
      drawWaveform();

      // Start timer with adaptive max duration
      let maxDuration = 30;
      if (soundType === "insect") maxDuration = 60;
      else if (soundType === "amphibian") maxDuration = 45;
      else if (soundType === "auto") maxDuration = 40;

      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Microphone access error:", err);
      setInlineMessage(t("audio.micError"));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const handleRetry = () => {
    setAudioBlob(null);
    setDuration(0);
    setInlineMessage(null);
    audioChunksRef.current = [];
  };

  const handleConfirm = async () => {
    if (!audioBlob) return;

    setProcessing(true);
    setInlineMessage("Analyse fréquentielle en cours...");

    try {
      // Perform FFT analysis on the recorded audio
      const analysis = await processAudioBlob(audioBlob, soundType);
      analysisResultRef.current = analysis;

      // Check signal quality
      if (analysis.signalQuality.quality < 0.2) {
        setInlineMessage("⚠️ Signal trop faible. Réessayez dans un endroit plus calme.");
        setProcessing(false);
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(",")[1];

        // Package everything for the API
        onCapture({
          audioBase64: base64,
          mimeType: audioBlob.type,
          durationSeconds: duration,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
          soundType: soundType === "auto" ? "bird" : soundType, // Convert auto to bird for backend
          // New enriched data
          frequencyAnalysis: formatAnalysisForPrompt(analysis),
          environmentalContext: environmentalContext
        });
      };
      reader.readAsDataURL(audioBlob);

    } catch (error) {
      console.error("Audio analysis error:", error);
      setInlineMessage("Erreur d'analyse. Réessayez.");
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{
        background: "var(--v1v-bg)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)"
      }}
    >
      {/* Header */}
      <div className="relative z-10 w-full px-5 py-4 flex items-center justify-between flex-shrink-0">
        <button
          onClick={onCancel}
          className="text-sm font-black uppercase tracking-wider min-h-[44px] px-2"
          style={{ color: "var(--v1v-green)" }}
        >
          {t("common.cancel")}
        </button>
        <span className="text-xs tracking-[0.3em] uppercase" style={{ color: "var(--v1v-green-faint)" }}>
          {recording ? t("audio.recording") : audioBlob ? t("common.preview") : t("common.ready")}
        </span>
        <div className="w-16" />
      </div>

      {/* Sound type selector — only shown before recording */}
      {!recording && !audioBlob && (
        <div className="w-full px-6 py-4 flex flex-col items-center gap-3 flex-shrink-0">
          {/* Environmental context hint */}
          {environmentalContext && (
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-3 h-3" style={{ color: "var(--v1v-green-faint)" }} />
              <span className="text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--v1v-green-faint)" }}>
                {environmentalContext.timeOfDay.label} · {environmentalContext.season.label} · {environmentalContext.region.label}
              </span>
            </div>
          )}

          {/* Mode selector */}
          <div className="grid grid-cols-2 gap-2 w-full max-w-md">
            <button
              onClick={() => setSoundType("auto")}
              className="py-2 px-3 text-xs font-black uppercase tracking-wider transition-all relative"
              style={{
                background: soundType === "auto" ? "var(--v1v-green)" : "transparent",
                color: soundType === "auto" ? "var(--v1v-bg)" : "var(--v1v-green)",
                border: "1px solid var(--v1v-green)"
              }}
            >
              <Zap className="inline-block w-3 h-3 mr-1" />
              Auto
              {suggestedType === "auto" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "var(--v1v-amber)" }} />
              )}
            </button>
            <button
              onClick={() => setSoundType("bird")}
              className="py-2 px-3 text-xs font-black uppercase tracking-wider transition-all relative"
              style={{
                background: soundType === "bird" ? "var(--v1v-green)" : "transparent",
                color: soundType === "bird" ? "var(--v1v-bg)" : "var(--v1v-green)",
                border: "1px solid var(--v1v-green)"
              }}
            >
              🦜 Oiseau
              {suggestedType === "bird" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "var(--v1v-amber)" }} />
              )}
            </button>
            <button
              onClick={() => setSoundType("insect")}
              className="py-2 px-3 text-xs font-black uppercase tracking-wider transition-all relative"
              style={{
                background: soundType === "insect" ? "var(--v1v-green)" : "transparent",
                color: soundType === "insect" ? "var(--v1v-bg)" : "var(--v1v-green)",
                border: "1px solid var(--v1v-green)"
              }}
            >
              🦗 Insecte
              {suggestedType === "insect" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "var(--v1v-amber)" }} />
              )}
            </button>
            <button
              onClick={() => setSoundType("amphibian")}
              className="py-2 px-3 text-xs font-black uppercase tracking-wider transition-all relative"
              style={{
                background: soundType === "amphibian" ? "var(--v1v-green)" : "transparent",
                color: soundType === "amphibian" ? "var(--v1v-bg)" : "var(--v1v-green)",
                border: "1px solid var(--v1v-green)"
              }}
            >
              🐸 Amphibien
              {suggestedType === "amphibian" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: "var(--v1v-amber)" }} />
              )}
            </button>
          </div>

          {/* Hints */}
          <p className="text-[9px] tracking-[0.3em] uppercase text-center max-w-sm" style={{ color: "var(--v1v-fg-muted)" }}>
            {soundType === "bird" && "1-8 kHz · 10-30 sec"}
            {soundType === "insect" && "3-20 kHz · 20-60 sec"}
            {soundType === "amphibian" && "200Hz-3kHz · 15-45 sec"}
            {soundType === "auto" && "Spectre complet · 20-40 sec"}
          </p>

          {inlineMessage && (
            <p className="max-w-sm text-center text-[10px] leading-relaxed" style={{ color: "#E87A00" }}>
              {inlineMessage}
            </p>
          )}
        </div>
      )}

      {/* Waveform Canvas + Signal Quality */}
      <div className="flex-1 flex flex-col items-center justify-center w-full px-6 gap-3 min-h-0">
        <canvas
          ref={canvasRef}
          width={300}
          height={150}
          className="w-full max-w-md"
          style={{ border: "1px solid var(--v1v-green-ghost)", background: "var(--v1v-bg-card)" }}
        />

        {/* Real-time signal quality indicator */}
        {recording && signalQuality && (
          <div className="flex items-center gap-3">
            <span className="text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--v1v-fg-faint)" }}>
              Signal
            </span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((bar) => (
                <div
                  key={bar}
                  className="w-1 transition-all"
                  style={{
                    height: `${bar * 4}px`,
                    background: signalQuality.strength >= bar * 3
                      ? signalQuality.strength >= 15
                        ? "var(--v1v-green)"
                        : signalQuality.strength >= 8
                        ? "var(--v1v-amber)"
                        : "var(--v1v-coral)"
                      : "var(--v1v-green-ghost)"
                  }}
                />
              ))}
            </div>
            <span className="text-[9px] tracking-[0.3em] uppercase" style={{
              color: signalQuality.quality === "excellent" ? "var(--v1v-green)" :
                     signalQuality.quality === "bon" ? "var(--v1v-amber)" :
                     signalQuality.quality === "moyen" ? "var(--v1v-coral)" : "var(--v1v-danger)"
            }}>
              {signalQuality.quality}
            </span>
          </div>
        )}

        {/* Processing indicator */}
        {processing && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--v1v-green)" }} />
            <span className="text-[9px] tracking-[0.3em] uppercase" style={{ color: "var(--v1v-green)" }}>
              Analyse FFT...
            </span>
          </div>
        )}
      </div>

      {/* Timer */}
      <div className="py-4 flex-shrink-0">
        <span className="text-4xl font-black" style={{ color: "var(--v1v-green)" }}>
          {duration}s
        </span>
        <span className="text-sm ml-2" style={{ color: "var(--v1v-green-faint)" }}>
          / {soundType === "insect" ? "60" : soundType === "amphibian" ? "45" : soundType === "auto" ? "40" : "30"}s max
        </span>
      </div>

      {/* Controls */}
      <div className="py-6 flex items-center justify-center gap-6 flex-shrink-0">
        {!recording && !audioBlob && (
          <button
            onClick={startRecording}
            className="w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ background: "var(--v1v-green)" }}
          >
            <Mic className="w-10 h-10" style={{ color: "var(--v1v-bg)" }} />
          </button>
        )}

        {recording && (
          <button
            onClick={stopRecording}
            className="w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95"
            style={{ background: "var(--v1v-danger)" }}
          >
            <Square className="w-8 h-8" style={{ color: "#fff" }} />
          </button>
        )}

        {audioBlob && (
          <>
            <button
              onClick={handleRetry}
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95"
              style={{ background: "var(--v1v-green-ghost)", border: "1px solid var(--v1v-green-dim)" }}
            >
              <RotateCcw className="w-6 h-6" style={{ color: "var(--v1v-green)" }} />
            </button>

            <button
              onClick={handleConfirm}
              className="px-8 py-4 font-black uppercase text-sm tracking-[0.25em] transition-all active:scale-95"
              style={{ background: "var(--v1v-green)", color: "var(--v1v-bg)" }}
            >
              {t("audio.identify")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
