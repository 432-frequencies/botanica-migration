import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Sparkles, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useZoneLabel } from '@/lib/locationMeta';

/**
 * Animation de célébration quand on devient la référence locale d'une zone
 */
export default function ChampionCelebration({ zone, onClose }) {
  const [show, setShow] = useState(true);
  const { label: zoneName } = useZoneLabel(zone?.zone_id);

  useEffect(() => {
    if (!zone) return;

    // Confettis sobres inspirés du vivant
    const duration = 2200;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 10000,
      colors: ['#2EA80F', '#7ED957', '#FFE55C', '#C49A0A']
    };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    // Auto-close après 3s
    const timeout = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 300);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [zone, onClose]);

  if (!zone) return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Glow background */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at center, rgba(196,154,10,0.15) 0%, transparent 70%)',
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />

          {/* Main card */}
          <motion.div
            className="relative"
            initial={{ scale: 0.5, y: 100, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.5, y: -100, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 20,
              duration: 0.6
            }}
            style={{
              background: 'linear-gradient(135deg, rgba(196,154,10,0.95) 0%, rgba(255,215,0,0.85) 100%)',
              backdropFilter: 'blur(20px)',
              borderRadius: '24px',
              padding: '32px',
              boxShadow: '0 20px 60px rgba(196,154,10,0.5), 0 0 100px rgba(255,215,0,0.3)',
              border: '2px solid rgba(255,255,255,0.3)',
              maxWidth: '90vw',
              width: '400px',
            }}
          >
            {/* Sparkles decoration */}
            <motion.div
              className="absolute -top-8 -left-8"
              animate={{
                rotate: [0, 360],
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <Sparkles className="w-12 h-12" style={{ color: '#FFE55C' }} />
            </motion.div>

            <motion.div
              className="absolute -top-8 -right-8"
              animate={{
                rotate: [360, 0],
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              <Sparkles className="w-12 h-12" style={{ color: '#FFE55C' }} />
            </motion.div>

            {/* Crown icon */}
            <motion.div
              className="flex justify-center mb-4"
              initial={{ rotate: -30, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{
                delay: 0.3,
                type: "spring",
                stiffness: 300,
                damping: 15
              }}
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                style={{
                  background: 'linear-gradient(135deg, #FFE55C 0%, #FFD700 100%)',
                  borderRadius: '50%',
                  padding: '20px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                }}
              >
                <Compass className="w-16 h-16" style={{ color: '#1A1A1A' }} />
              </motion.div>
            </motion.div>

            {/* Title */}
            <motion.h2
              className="text-3xl font-black uppercase tracking-wider text-center mb-2"
              style={{ color: '#1A1A1A' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Référence locale
            </motion.h2>

            {/* Subtitle */}
            <motion.p
              className="text-sm font-bold text-center mb-4"
              style={{ color: 'rgba(0,0,0,0.7)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Tu apportes maintenant la documentation la plus complete dans {zoneName || zone.zone_id}
            </motion.p>

            {/* Trophy icon */}
            <motion.div
              className="flex justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
            >
              <Trophy className="w-8 h-8" style={{ color: '#1A1A1A' }} />
            </motion.div>

            {/* Shine effect */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                borderRadius: '24px',
              }}
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                repeatDelay: 1,
                ease: "easeInOut"
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
