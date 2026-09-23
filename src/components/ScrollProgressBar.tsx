import React, { useEffect, useState } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';

interface ScrollProgressBarProps {
  isRtl?: boolean;
}

/**
 * ScrollProgressBar
 * A subtle, fixed-position progress bar at the very top of the viewport.
 * Uses hardware-accelerated spring-smoothed scroll progress with RALOA's
 * signature cyan-to-purple brand gradient.
 */
export const ScrollProgressBar: React.FC<ScrollProgressBarProps> = ({ isRtl = false }) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 280,
    damping: 30,
    restDelta: 0.001
  });

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Only show when the user has started scrolling down (greater than 4px)
      setIsVisible(window.scrollY > 4);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

      {/* Active progress bar with RALOA signature cyan-to-purple gradient */}
      <motion.div
        className={`h-full w-full shadow-[0_0_10px_rgba(0,112,243,0.45)] ${
          isRtl
            ? 'bg-gradient-to-l from-[#00D2FF] via-[#0070F3] to-[#7C3AED]'
            : 'bg-gradient-to-r from-[#00D2FF] via-[#0070F3] to-[#7C3AED]'
        }`}
        style={{
          scaleX,
          transformOrigin: isRtl ? 'right' : 'left'
        }}
      />
    </div>
  );
};
