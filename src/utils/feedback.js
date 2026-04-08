/**
 * Système de feedback haptique et sonore niveau Tesla 2030
 * Fournit des retours immédiats et satisfaisants pour chaque interaction
 */

// ── Haptic Feedback ──────────────────────────────────────────────────────────

/**
 * Types de vibrations haptiques
 */
export const HapticType = {
  LIGHT: 'light',         // Tap léger (bouton, selection)
  MEDIUM: 'medium',       // Interaction standard
  HEAVY: 'heavy',         // Action importante
  SUCCESS: 'success',     // Succès, validation
  WARNING: 'warning',     // Alerte
  ERROR: 'error',         // Erreur
  SELECTION: 'selection', // Changement de sélection
  IMPACT: 'impact',       // Impact physique
  RIGID: 'rigid',         // Notification rigide
  SOFT: 'soft',          // Notification douce
};

/**
 * Déclenche un feedback haptique
 * Supporte iOS (Taptic Engine) et Android (Vibration API)
 */
export function triggerHaptic(type = HapticType.MEDIUM) {
  try {
    // iOS Taptic Engine (Safari/WKWebView)
    if (window.navigator?.vibrate) {
      const patterns = {
        [HapticType.LIGHT]: [10],
        [HapticType.MEDIUM]: [20],
        [HapticType.HEAVY]: [40],
        [HapticType.SUCCESS]: [10, 30, 10],
        [HapticType.WARNING]: [20, 50, 20],
        [HapticType.ERROR]: [30, 50, 30, 50, 30],
        [HapticType.SELECTION]: [5],
        [HapticType.IMPACT]: [50],
        [HapticType.RIGID]: [15, 10, 15],
        [HapticType.SOFT]: [8],
      };
      window.navigator.vibrate(patterns[type] || [20]);
    }

    // iOS Haptic Feedback API (si disponible via capacitor/cordova)
    if (window.Haptics?.impact) {
      const impactStyles = {
        [HapticType.LIGHT]: 'LIGHT',
        [HapticType.MEDIUM]: 'MEDIUM',
        [HapticType.HEAVY]: 'HEAVY',
        [HapticType.SELECTION]: 'LIGHT',
        [HapticType.SUCCESS]: 'MEDIUM',
        [HapticType.IMPACT]: 'HEAVY',
      };
      const style = impactStyles[type] || 'MEDIUM';
      window.Haptics.impact({ style });
    }
  } catch (e) {
    // Silently fail on unsupported devices
    console.debug('[Haptic] Not supported on this device');
  }
}

// ── Audio Feedback ───────────────────────────────────────────────────────────

let audioContext = null;
let masterGain = null;

/**
 * Initialise l'AudioContext (appelé au premier clic utilisateur)
 */
function initAudio() {
  if (audioContext) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.3; // Volume global à 30%
    masterGain.connect(audioContext.destination);
  } catch (e) {
    console.debug('[Audio] AudioContext not supported');
  }
}

/**
 * Joue un son synthétique moderne (style Tesla UI)
 */
export function playSound(type = 'click') {
  initAudio();
  if (!audioContext || !masterGain) return;

  try {
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(masterGain);

    // Définition des sons par type
    const sounds = {
      click: { freq: 800, type: 'sine', duration: 0.05, volume: 0.15 },
      hover: { freq: 600, type: 'sine', duration: 0.03, volume: 0.08 },
      success: { freq: [523, 659, 784], type: 'sine', duration: 0.15, volume: 0.2 },
      levelup: { freq: [392, 523, 659, 784], type: 'sine', duration: 0.5, volume: 0.25 },
      scan: { freq: 1200, type: 'square', duration: 0.08, volume: 0.12 },
      error: { freq: 200, type: 'sawtooth', duration: 0.2, volume: 0.18 },
      whoosh: { freq: [800, 400], type: 'sine', duration: 0.3, volume: 0.15 },
      notification: { freq: [659, 784], type: 'sine', duration: 0.12, volume: 0.18 },
    };

    const sound = sounds[type] || sounds.click;
    const freqs = Array.isArray(sound.freq) ? sound.freq : [sound.freq];

    osc.type = sound.type;
    gain.gain.value = sound.volume;

    // Animation de fréquence pour sons multi-notes
    if (freqs.length > 1) {
      osc.frequency.setValueAtTime(freqs[0], now);
      const stepDuration = sound.duration / freqs.length;
      freqs.forEach((freq, i) => {
        osc.frequency.setValueAtTime(freq, now + i * stepDuration);
      });
    } else {
      osc.frequency.value = freqs[0];
    }

    // Envelope ADSR pour un son naturel
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(sound.volume, now + 0.01); // Attack
    gain.gain.exponentialRampToValueAtTime(0.01, now + sound.duration); // Release

    osc.start(now);
    osc.stop(now + sound.duration);
  } catch (e) {
    console.debug('[Audio] Playback failed:', e);
  }
}

// ── Feedback Combinés ────────────────────────────────────────────────────────

/**
 * Feedback complet pour actions importantes
 */
export function feedback(type, options = {}) {
  const { haptic = true, sound = false } = options;

  const presets = {
    // Interactions de base
    tap: { hapticType: HapticType.LIGHT, soundType: 'click' },
    hover: { hapticType: HapticType.LIGHT, soundType: 'hover' },
    select: { hapticType: HapticType.SELECTION, soundType: 'click' },

    // Actions importantes
    scan: { hapticType: HapticType.MEDIUM, soundType: 'scan' },
    save: { hapticType: HapticType.SUCCESS, soundType: 'success' },
    delete: { hapticType: HapticType.WARNING, soundType: 'error' },

    // Célébrations
    levelup: { hapticType: HapticType.SUCCESS, soundType: 'levelup' },
    achievement: { hapticType: HapticType.SUCCESS, soundType: 'notification' },
    rare: { hapticType: HapticType.HEAVY, soundType: 'success' },
    legendary: { hapticType: HapticType.HEAVY, soundType: 'levelup' },

    // Transitions
    swipe: { hapticType: HapticType.LIGHT, soundType: 'whoosh' },
    open: { hapticType: HapticType.MEDIUM, soundType: 'whoosh' },
    close: { hapticType: HapticType.LIGHT, soundType: null },

    // États
    success: { hapticType: HapticType.SUCCESS, soundType: 'success' },
    error: { hapticType: HapticType.ERROR, soundType: 'error' },
    warning: { hapticType: HapticType.WARNING, soundType: null },
  };

  const preset = presets[type] || presets.tap;

  if (haptic && preset.hapticType) {
    triggerHaptic(preset.hapticType);
  }

  if (sound && preset.soundType) {
    playSound(preset.soundType);
  }
}

// ── Visual Feedback ──────────────────────────────────────────────────────────

/**
 * Ajoute un effet de ripple visuel au point de clic (Material Design)
 */
export function createRipple(event, color = 'rgba(255, 255, 255, 0.5)') {
  const button = event.currentTarget;
  const ripple = document.createElement('span');
  const diameter = Math.max(button.clientWidth, button.clientHeight);
  const radius = diameter / 2;

  const rect = button.getBoundingClientRect();
  ripple.style.width = ripple.style.height = `${diameter}px`;
  ripple.style.left = `${event.clientX - rect.left - radius}px`;
  ripple.style.top = `${event.clientY - rect.top - radius}px`;
  ripple.style.position = 'absolute';
  ripple.style.borderRadius = '50%';
  ripple.style.background = color;
  ripple.style.transform = 'scale(0)';
  ripple.style.animation = 'ripple 600ms ease-out';
  ripple.style.pointerEvents = 'none';

  // Injection CSS si pas déjà présent
  if (!document.getElementById('ripple-animation')) {
    const style = document.createElement('style');
    style.id = 'ripple-animation';
    style.textContent = `
      @keyframes ripple {
        to { transform: scale(2.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  button.style.position = button.style.position || 'relative';
  button.style.overflow = 'hidden';
  button.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
}

/**
 * Shake animation pour erreurs
 */
export function shakeElement(element) {
  if (!element) return;
  element.style.animation = 'shake 0.4s cubic-bezier(.36,.07,.19,.97)';

  if (!document.getElementById('shake-animation')) {
    const style = document.createElement('style');
    style.id = 'shake-animation';
    style.textContent = `
      @keyframes shake {
        10%, 90% { transform: translateX(-2px); }
        20%, 80% { transform: translateX(4px); }
        30%, 50%, 70% { transform: translateX(-6px); }
        40%, 60% { transform: translateX(6px); }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => {
    element.style.animation = '';
  }, 400);
}

// Export par défaut pour usage simple
export default {
  haptic: triggerHaptic,
  sound: playSound,
  feedback,
  ripple: createRipple,
  shake: shakeElement,
};
