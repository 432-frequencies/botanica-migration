import { useState, useRef, useEffect } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";

export default function AudioCapture({ onCapture, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [location, setLocation] = useState(null);
  const [soundType, setSoundType] = useState("bird"); // "bird" | "insect"

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Get geolocation on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => console.log("Geolocation error:", err)
      );
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = "rgba(242, 237, 228, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "var(--v1v-green)";
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    animationFrameRef.current = requestAnimationFrame(drawWaveform);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup Web Audio API for visualization
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      source.connect(analyserRef.current);

      // Setup MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      setDuration(0);

      // Start visualization
      drawWaveform();

      // Start timer (max 60s for insects, 30s for birds)
      const maxDuration = soundType === "insect" ? 60 : 30;
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
      alert("Impossible d'accéder au microphone");
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
    audioChunksRef.current = [];
  };

  const handleConfirm = async () => {
    if (!audioBlob) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      onCapture({
        audioBase64: base64,
        mimeType: audioBlob.type,
        durationSeconds: duration,
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        soundType
      });
    };
    reader.readAsDataURL(audioBlob);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "var(--v1v-bg)" }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-5 flex items-center justify-between">
        <button onClick={onCancel} className="text-sm font-black uppercase tracking-wider" style={{ color: "var(--v1v-green)" }}>
          Annuler
        </button>
        <span className="text-xs tracking-[0.3em] uppercase" style={{ color: "var(--v1v-green-faint)" }}>
          {recording ? "Enregistrement..." : audioBlob ? "Prévisualisation" : "Prêt"}
        </span>
        <div className="w-16" />
      </div>

      {/* Sound type selector — only shown before recording */}
      {!recording && !audioBlob && (
        <div className="w-full px-6 mb-4 flex flex-col items-center gap-3">
          <div className="flex gap-3">
            <button
              onClick={() => setSoundType("bird")}
              className="flex-1 py-3 px-4 text-sm font-black uppercase tracking-wider transition-all"
              style={{
                background: soundType === "bird" ? "var(--v1v-green)" : "transparent",
                color: soundType === "bird" ? "var(--v1v-bg)" : "var(--v1v-green)",
                border: "1px solid var(--v1v-green)"
              }}
            >
              🦜 Oiseau
            </button>
            <button
              onClick={() => setSoundType("insect")}
              className="flex-1 py-3 px-4 text-sm font-black uppercase tracking-wider transition-all"
              style={{
                background: soundType === "insect" ? "var(--v1v-green)" : "transparent",
                color: soundType === "insect" ? "var(--v1v-bg)" : "var(--v1v-green)",
                border: "1px solid var(--v1v-green)"
              }}
            >
              🦗 Insecte
            </button>
          </div>
          <p className="text-[9px] tracking-[0.3em] uppercase text-center" style={{ color: "var(--v1v-fg-muted)" }}>
            {soundType === "bird"
              ? "Enregistre 10–30 secondes de chant"
              : "Enregistre 20–60 secondes, le soir de préférence"}
          </p>
        </div>
      )}

      {/* Waveform Canvas */}
      <div className="flex-1 flex items-center justify-center w-full px-6">
        <canvas
          ref={canvasRef}
          width={300}
          height={150}
          className="w-full max-w-md"
          style={{ border: "1px solid var(--v1v-green-ghost)", background: "var(--v1v-bg-card)" }}
        />
      </div>

      {/* Timer */}
      <div className="mb-8">
        <span className="text-4xl font-black" style={{ color: "var(--v1v-green)" }}>
          {duration}s
        </span>
        <span className="text-sm ml-2" style={{ color: "var(--v1v-green-faint)" }}>/ {soundType === "insect" ? "60" : "30"}s max</span>
      </div>

      {/* Controls */}
      <div className="pb-12 flex items-center gap-6">
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
              Identifier
            </button>
          </>
        )}
      </div>
    </div>
  );
}