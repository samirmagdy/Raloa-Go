import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { Theme } from '../utils/theme';

interface CustomCursorProps {
  theme?: Theme;
}

export const CustomCursor: React.FC<CustomCursorProps> = ({ theme = 'light' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(true);

  // Exact mouse coordinate motion values (centered)
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Smooth spring physics for the trailing follower ring
  const springConfig = { stiffness: 320, damping: 26, mass: 0.45 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  useEffect(() => {
    // Only enable on pointer-accurate desktop devices
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(pointer: fine)');
    setIsTouchDevice(!mediaQuery.matches);

    const handlePointerChange = (e: MediaQueryListEvent) => {
      setIsTouchDevice(!e.matches);
    };

    mediaQuery.addEventListener('change', handlePointerChange);

    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);

      if (!isVisible) setIsVisible(true);

      // Check whether hovered target is an interactive element
      const target = e.target as Element | null;
      if (target) {
        const isInteractive = Boolean(
          target.closest(
            'a, button, input, select, textarea, [role="button"], label, .cursor-pointer, [data-cursor-interactive]'
          )
        );
        setIsHovered(isInteractive);
      }
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    document.documentElement.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      mediaQuery.removeEventListener('change', handlePointerChange);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.documentElement.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isVisible, mouseX, mouseY]);

  // If touch device or mouse hasn't moved into viewport yet, don't render
  if (isTouchDevice || !isVisible) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <div
      id="custom-interactive-cursor"
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden print:hidden"
      aria-hidden="true"
    >
      {/* 1. Trailing Spring Follower Halo */}
      <motion.div
        style={{
          x: smoothX,
          y: smoothY,
          translateX: '-50%',
          translateY: '-50%'
        }}
        animate={{
          scale: isClicking ? 0.8 : isHovered ? 1.75 : 1,
          opacity: isHovered ? 0.9 : 0.65
        }}
        transition={{
          scale: { type: 'spring', stiffness: 350, damping: 25 },
          opacity: { duration: 0.15 }
        }}
        className={`w-9 h-9 rounded-full border transition-colors duration-150 flex items-center justify-center ${
          isHovered
            ? isDark
              ? 'border-indigo-400 bg-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.35)]'
              : 'border-indigo-600 bg-indigo-500/15 shadow-[0_0_16px_rgba(99,102,241,0.25)]'
            : isDark
            ? 'border-slate-400/50 bg-slate-400/5'
            : 'border-slate-800/40 bg-slate-800/5'
        }`}
      />

      {/* 2. Direct Precise Center Micro-Dot */}
      <motion.div
        style={{
          x: mouseX,
          y: mouseY,
          translateX: '-50%',
          translateY: '-50%'
        }}
        animate={{
          scale: isClicking ? 1.4 : isHovered ? 0 : 1,
          opacity: isHovered ? 0 : 1
        }}
        transition={{
          scale: { type: 'spring', stiffness: 450, damping: 28 },
          opacity: { duration: 0.1 }
        }}
        className={`w-2 h-2 rounded-full ${
          isDark
            ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]'
            : 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]'
        }`}
      />
    </div>
  );
};
