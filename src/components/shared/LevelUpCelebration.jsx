import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Zap, TrendingUp } from "lucide-react";
import { feedback } from "@/utils/feedback";

/**
 * Célébration de niveau ultra-premium (style Tesla 2030)
 * Animation immersive avec confettis, son, haptique
 */
export default function LevelUpCelebration({ level, label, xp, onClose }) {
  const [phase, setPhase] = useState('enter'); // enter -> celebrate -> exit
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    // Génération des particules de célébration
    const particleCount = 40;
    const newParticles = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: -10 + Math.random() * 20,
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      delay: Math.random() * 0.5,
      duration: Math.random() * 2 + 3,
      color: ['#39B814', '#FFD700', '#fff', '#7C3AED'][Math.floor(Math.random() * 4)],
    }));
    setParticles(newParticles);

    // Séquence de feedback multi-sensoriel
    feedback('levelup', { haptic: true, sound: true });

    setTimeout(() => feedback('success', { haptic: true, sound: false }), 300);
    setTimeout(() => feedback('success', { haptic: true, sound: false }), 600);

    // Phase celebrate
    setTimeout(() => setPhase('celebrate'), 100);

    // Auto-fermeture après 3.5s
    const timer = setTimeout(() => {
      setPhase('exit');
      setTimeout(onClose, 400);
    }, 3500);

    return () => clearTimeout(timer);
  }, [onClose]);

  const animations = {
    enter: { opacity: 0, scale: 0.8 },
    celebrate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 1.1 },
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #000000 0%, #0A0A0A 50%, #000000 100%)',
        animation: 'fadeIn 0.3s ease-out',
      }}
      onClick={() => {
        setPhase('exit');
        setTimeout(onClose, 400);
      }}
    >
      {/* Gradient animé de fond */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, rgba(57,184,20,0.2) 0%, transparent 70%)',
          animation: 'pulseGlow 2s ease-in-out infinite',
        }}
      />

      {/* Cercles concentriques animés */}
      <div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          border: '1px solid rgba(57,184,20,0.3)',
          animation: 'rippleOut 2s ease-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          border: '1px solid rgba(57,184,20,0.2)',
          animation: 'rippleOut 2s ease-out infinite 0.3s',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          border: '1px solid rgba(57,184,20,0.1)',
          animation: 'rippleOut 2s ease-out infinite 0.6s',
        }}
      />

      {/* Particules de célébration */}
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            borderRadius: '50%',
            opacity: 0.8,
            animation: `floatDown ${p.duration}s ${p.delay}s ease-out forwards`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}

      {/* Contenu principal */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          animation: `scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
          opacity: animations[phase].opacity,
          transform: `scale(${animations[phase].scale})`,
          transition: 'opacity 0.3s, transform 0.3s',
        }}
      >
        {/* Badge de niveau géant */}
        <div
          style={{
            width: '180px',
            height: '180px',
            margin: '0 auto 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, rgba(57,184,20,0.15), rgba(57,184,20,0.05))',
            border: '3px solid #39B814',
            borderRadius: '50%',
            boxShadow: '0 0 60px rgba(57,184,20,0.4), inset 0 0 40px rgba(57,184,20,0.1)',
            position: 'relative',
            animation: 'rotateBorder 3s linear infinite',
          }}
        >
          {/* Icône */}
          <TrendingUp
            className="mb-2"
            style={{
              width: 48,
              height: 48,
              color: '#39B814',
              filter: 'drop-shadow(0 0 12px rgba(57,184,20,0.6))',
              animation: 'bounce 1s ease-in-out infinite',
            }}
          />

          {/* Niveau */}
          <div
            style={{
              fontSize: '56px',
              fontWeight: 900,
              color: '#fff',
              textShadow: '0 0 20px rgba(57,184,20,0.5)',
              lineHeight: 1,
            }}
          >
            {level}
          </div>
        </div>

        {/* Titre LEVEL UP */}
        <h1
          style={{
            fontSize: '48px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: '#39B814',
            textAlign: 'center',
            marginBottom: '16px',
            textShadow: '0 0 30px rgba(57,184,20,0.5)',
            animation: 'slideUpFade 0.6s ease-out 0.2s backwards',
          }}
        >
          Level UP!
        </h1>

        {/* Nom du niveau */}
        <p
          style={{
            fontSize: '28px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#fff',
            textAlign: 'center',
            marginBottom: '32px',
            opacity: 0.9,
            animation: 'slideUpFade 0.6s ease-out 0.4s backwards',
          }}
        >
          {label}
        </p>

        {/* XP Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 32px',
            background: 'linear-gradient(135deg, rgba(57,184,20,0.2), rgba(57,184,20,0.1))',
            border: '2px solid rgba(57,184,20,0.4)',
            borderRadius: '60px',
            marginBottom: '40px',
            animation: 'slideUpFade 0.6s ease-out 0.6s backwards',
          }}
        >
          <Zap style={{ width: 24, height: 24, color: '#39B814' }} />
          <span
            style={{
              fontSize: '32px',
              fontWeight: 900,
              color: '#39B814',
              letterSpacing: '0.05em',
            }}
          >
            +{xp} XP
          </span>
        </div>

        {/* Message de félicitations */}
        <p
          style={{
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '0.3em',
            color: 'rgba(255,255,255,0.4)',
            textAlign: 'center',
            animation: 'slideUpFade 0.6s ease-out 0.8s backwards',
          }}
        >
          Continue ton exploration
        </p>

        {/* Tap to continue hint */}
        <p
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: 'rgba(255,255,255,0.25)',
            textAlign: 'center',
            marginTop: '24px',
            animation: 'fadeInOut 2s ease-in-out infinite',
          }}
        >
          Tap pour continuer
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rippleOut {
          0% { transform: scale(0.5); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes floatDown {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes rotateBorder {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>,
    document.body
  );
}
