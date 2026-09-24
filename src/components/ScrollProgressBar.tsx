import React, { useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react';

interface ScrollProgressBarProps {
  isRtl?: boolean;
}

/**
 * ScrollProgressBar
 * A subtle, fixed-position progress bar at the very top of the viewport.
 * Uses hardware-accelerated spring-smoothed scroll progress with the primary
 * indigo brand token.
 */
export const ScrollProgressBar: React.FC<ScrollProgressBarProps> = ({ isRtl = false }) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 280,
    damping: 30,
    restDelta: 0.001
  });

  const [isVisible, setIsVisible] = useState(false);

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    setIsVisible(progress > 0.002);
  });

  return (
    <div
      id="scroll-progress-bar"
      className={`fixed top-0 left-0 right-0 z-50 h-[3px] pointer-events-none overflow-hidden transition-opacity duration-300 print:hidden ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden="true"
    >
      {/* Background track: ultra-subtle transparent tint */}
      <div className="absolute inset-0 bg-slate-200/40 backdrop-blur-xs" />

      {/* Active progress bar uses one accent so it does not compete with the hero. */}
      <motion.div
        className="h-full w-full bg-indigo-600 dark:bg-indigo-400 shadow-[0_0_10px_rgba(91,92,246,0.35)]"
        style={{
          scaleX,
          transformOrigin: isRtl ? 'right' : 'left'
        }}
      />
    </div>
  );
};
