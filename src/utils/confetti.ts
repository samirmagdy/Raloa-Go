import confetti from 'canvas-confetti';

/**
 * Fires a celebratory multi-cannon confetti explosion
 * with RALOA brand palette colors (electric indigo, violet, cyan, emerald, amber).
 */
export function fireSiteLaunchConfetti() {
  const brandColors = ['#4F46E5', '#7C3AED', '#2563EB', '#06B6D4', '#10B981', '#F59E0B', '#EC4899'];

  // Center primary burst
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: brandColors,
    zIndex: 9999,
    disableForReducedMotion: true
  });

  // Left & Right celebratory cannons with slight stagger
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 60,
      origin: { x: 0.05, y: 0.65 },
      colors: brandColors,
      zIndex: 9999,
      disableForReducedMotion: true
    });

    confetti({
      particleCount: 50,
      angle: 120,
      spread: 60,
      origin: { x: 0.95, y: 0.65 },
      colors: brandColors,
      zIndex: 9999,
      disableForReducedMotion: true
    });
  }, 200);

  // Cascading star showers
  setTimeout(() => {
    confetti({
      particleCount: 35,
      spread: 100,
      origin: { y: 0.4 },
      shapes: ['star', 'circle'],
      colors: ['#F59E0B', '#EC4899', '#7C3AED', '#3B82F6'],
      zIndex: 9999,
      disableForReducedMotion: true
    });
  }, 450);
}
