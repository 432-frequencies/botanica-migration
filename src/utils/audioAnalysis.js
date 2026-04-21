/**
 * Audio Frequency Analysis System for W1LD
 * Implements FFT-based frequency analysis with adaptive filtering
 * for intelligent bioacoustic identification
 */

// Frequency band presets for different taxa
export const FREQUENCY_BANDS = {
  bird: {
    min: 1000,    // 1 kHz
    max: 8000,    // 8 kHz
    label: "Oiseaux diurnes",
    description: "Optimisé pour chants et cris d'oiseaux"
  },
  insect: {
    min: 3000,    // 3 kHz
    max: 20000,   // 20 kHz (limite audible humaine)
    label: "Insectes nocturnes",
    description: "Optimisé pour stridulations et bourdonnements"
  },
  amphibian: {
    min: 200,     // 200 Hz
    max: 3000,    // 3 kHz
    label: "Grenouilles/amphibiens",
    description: "Optimisé pour coassements"
  },
  mammal: {
    min: 50,      // 50 Hz
    max: 2000,    // 2 kHz
    label: "Mammifères",
    description: "Optimisé pour vocalisations de mammifères"
  },
  auto: {
    min: 50,      // Full spectrum
    max: 20000,
    label: "Auto (spectre complet)",
    description: "Détection automatique"
  }
};

/**
 * Analyzes audio data using FFT to extract frequency features
 * @param {AudioBuffer} audioBuffer - Web Audio API AudioBuffer
 * @param {string} mode - Sound type ('bird', 'insect', 'amphibian', 'mammal', 'auto')
 * @returns {Object} Frequency analysis results
 */
export function analyzeFrequencies(audioBuffer, mode = 'auto') {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Use mono
  const fftSize = 4096; // High resolution for frequency analysis
  const frequencyBand = FREQUENCY_BANDS[mode] || FREQUENCY_BANDS.auto;

  // Create offline audio context for FFT processing
  const offlineContext = new OfflineAudioContext(1, channelData.length, sampleRate);
  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  const analyser = offlineContext.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0.3;

  source.connect(analyser);
  analyser.connect(offlineContext.destination);

  // Get frequency data
  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(frequencyData);

  // Calculate frequency resolution
  const frequencyResolution = sampleRate / fftSize;

  // Extract dominant frequencies within the target band
  const dominantFrequencies = extractDominantFrequencies(
    frequencyData,
    frequencyResolution,
    frequencyBand.min,
    frequencyBand.max,
    5 // Top 5 peaks
  );

  // Analyze temporal patterns (rhythm/repetition)
  const temporalPattern = analyzeTemporalPattern(channelData, sampleRate);

  // Calculate signal quality metrics
  const signalQuality = calculateSignalQuality(channelData, frequencyData);

  return {
    dominantFrequencies,
    temporalPattern,
    signalQuality,
    frequencyBand: {
      min: frequencyBand.min,
      max: frequencyBand.max,
      label: frequencyBand.label
    },
    sampleRate,
    duration: audioBuffer.duration
  };
}

/**
 * Extract dominant frequency peaks from FFT data
 */
function extractDominantFrequencies(frequencyData, resolution, minFreq, maxFreq, topN = 5) {
  const peaks = [];
  const minBin = Math.floor(minFreq / resolution);
  const maxBin = Math.min(Math.ceil(maxFreq / resolution), frequencyData.length - 1);

  // Find local maxima (peaks)
  for (let i = minBin + 1; i < maxBin - 1; i++) {
    const current = frequencyData[i];
    const prev = frequencyData[i - 1];
    const next = frequencyData[i + 1];

    // Peak detection: current value higher than neighbors
    if (current > prev && current > next && current > 30) { // Threshold to filter noise
      const frequency = i * resolution;
      const amplitude = current / 255; // Normalize to 0-1
      peaks.push({ frequency: Math.round(frequency), amplitude });
    }
  }

  // Sort by amplitude and return top N
  peaks.sort((a, b) => b.amplitude - a.amplitude);
  return peaks.slice(0, topN);
}

/**
 * Analyze temporal patterns (rhythm, repetition rate)
 */
function analyzeTemporalPattern(channelData, sampleRate) {
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const hopSize = Math.floor(windowSize / 2);
  const energyWindows = [];

  // Calculate energy for each window
  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += Math.abs(channelData[i + j]);
    }
    energyWindows.push(energy / windowSize);
  }

  // Detect emissions (energy peaks above threshold)
  const threshold = Math.max(...energyWindows) * 0.4; // 40% of max
  let emissions = 0;
  let inEmission = false;
  const emissionDurations = [];
  let currentEmissionStart = 0;

  for (let i = 0; i < energyWindows.length; i++) {
    if (energyWindows[i] > threshold && !inEmission) {
      inEmission = true;
      currentEmissionStart = i;
      emissions++;
    } else if (energyWindows[i] <= threshold && inEmission) {
      inEmission = false;
      const duration = (i - currentEmissionStart) * hopSize / sampleRate * 1000; // ms
      emissionDurations.push(duration);
    }
  }

  const avgEmissionDuration = emissionDurations.length > 0
    ? Math.round(emissionDurations.reduce((a, b) => a + b, 0) / emissionDurations.length)
    : 0;

  const totalDuration = channelData.length / sampleRate;
  const emissionsPerSecond = emissions / totalDuration;

  return {
    emissionCount: emissions,
    emissionsPerSecond: Math.round(emissionsPerSecond * 100) / 100,
    avgEmissionDuration, // milliseconds
    pattern: categorizePattern(emissionsPerSecond)
  };
}

/**
 * Categorize temporal pattern based on emission rate
 */
function categorizePattern(rate) {
  if (rate < 0.5) return "isolé"; // Isolated calls
  if (rate < 2) return "espacé"; // Spaced calls
  if (rate < 5) return "régulier"; // Regular rhythm
  if (rate < 10) return "rapide"; // Fast rhythm
  return "continu"; // Continuous
}

/**
 * Calculate signal quality metrics
 */
function calculateSignalQuality(channelData, frequencyData) {
  // Calculate RMS (Root Mean Square) for signal strength
  let sumSquares = 0;
  for (let i = 0; i < channelData.length; i++) {
    sumSquares += channelData[i] * channelData[i];
  }
  const rms = Math.sqrt(sumSquares / channelData.length);

  // Calculate peak amplitude
  const peak = Math.max(...Array.from(channelData).map(Math.abs));

  // Calculate spectral centroid (brightness)
  let weightedSum = 0;
  let sum = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    weightedSum += i * frequencyData[i];
    sum += frequencyData[i];
  }
  const spectralCentroid = sum > 0 ? weightedSum / sum : 0;

  // Signal to noise ratio estimate (simplified)
  const signalStrength = rms * 100;

  // Quality score (0-1)
  let quality = 0;
  if (signalStrength > 1) quality += 0.4;
  if (peak > 0.1) quality += 0.3;
  if (spectralCentroid > 10) quality += 0.3;

  return {
    rms: Math.round(rms * 1000) / 1000,
    peak: Math.round(peak * 1000) / 1000,
    signalStrength: Math.round(signalStrength * 10) / 10,
    spectralCentroid: Math.round(spectralCentroid),
    quality: Math.round(quality * 100) / 100,
    qualityLabel: quality > 0.7 ? "excellent" : quality > 0.4 ? "bon" : quality > 0.2 ? "moyen" : "faible"
  };
}

/**
 * Apply bandpass filter to audio data
 * @param {AudioContext} audioContext
 * @param {AudioBuffer} audioBuffer
 * @param {number} lowFreq - Low frequency cutoff (Hz)
 * @param {number} highFreq - High frequency cutoff (Hz)
 * @returns {Promise<AudioBuffer>} Filtered audio buffer
 */
export async function applyBandpassFilter(audioContext, audioBuffer, lowFreq, highFreq) {
  const offlineContext = new OfflineAudioContext(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;

  // Create bandpass filter using lowpass + highpass
  const lowpass = offlineContext.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = highFreq;
  lowpass.Q.value = 1;

  const highpass = offlineContext.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = lowFreq;
  highpass.Q.value = 1;

  // Connect: source -> highpass -> lowpass -> destination
  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(offlineContext.destination);

  source.start();

  return await offlineContext.startRendering();
}

/**
 * Process audio blob and extract all analysis features
 * @param {Blob} audioBlob
 * @param {string} mode - Sound type
 * @returns {Promise<Object>} Complete analysis results
 */
export async function processAudioBlob(audioBlob, mode = 'auto') {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Get frequency band for the mode
  const frequencyBand = FREQUENCY_BANDS[mode] || FREQUENCY_BANDS.auto;

  // Apply bandpass filter
  const filteredBuffer = await applyBandpassFilter(
    audioContext,
    audioBuffer,
    frequencyBand.min,
    frequencyBand.max
  );

  // Analyze frequencies
  const analysis = analyzeFrequencies(filteredBuffer, mode);

  // Close context to free resources
  await audioContext.close();

  return {
    ...analysis,
    filterApplied: {
      low: frequencyBand.min,
      high: frequencyBand.max,
      label: frequencyBand.label
    }
  };
}

/**
 * Real-time visualization of audio levels
 * @param {AnalyserNode} analyser
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 */
export function visualizeAudioLevels(analyser, ctx, width, height) {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  analyser.getByteTimeDomainData(dataArray);

  // Clear canvas with dark background
  ctx.fillStyle = "rgba(10, 20, 10, 0.3)";
  ctx.fillRect(0, 0, width, height);

  // Draw waveform in W1LD green
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#3fa34d";
  ctx.beginPath();

  const sliceWidth = width / bufferLength;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * height) / 2;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    x += sliceWidth;
  }

  ctx.lineTo(width, height / 2);
  ctx.stroke();
}

/**
 * Format analysis results for Gemini prompt
 */
export function formatAnalysisForPrompt(analysis) {
  const freqs = analysis.dominantFrequencies
    .map(f => `${f.frequency}Hz (${Math.round(f.amplitude * 100)}%)`)
    .join(", ");

  return {
    frequencies: freqs,
    pattern: `${analysis.temporalPattern.emissionCount} émissions détectées, ${analysis.temporalPattern.emissionsPerSecond}/sec, durée moyenne ${analysis.temporalPattern.avgEmissionDuration}ms`,
    rhythm: analysis.temporalPattern.pattern,
    quality: analysis.signalQuality.qualityLabel,
    signalStrength: `${analysis.signalQuality.signalStrength}%`,
    filterApplied: `${analysis.frequencyBand.min}-${analysis.frequencyBand.max}Hz (${analysis.frequencyBand.label})`
  };
}
