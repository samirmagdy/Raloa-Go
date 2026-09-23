import { useState, useEffect, useRef } from 'react';
import { useScroll, useTransform, useSpring, MotionValue } from 'motion/react';

export interface ScrollProgressState {
  progress: number; // 0 to 1 normalized
  scrollY: number;
  direction: 'up' | 'down' | 'idle';
  isPastThreshold: boolean;
}

export interface UseScrollProgressOptions {
  threshold?: number;
  targetRef?: React.RefObject<HTMLElement | null>;
  offset?: any;
  smooth?: boolean;
}

/**
 * Custom hook to track scroll progress for both standard React state
 * and Framer Motion spring-damped MotionValues.
 */
export function useScrollProgress(options: UseScrollProgressOptions = {}) {
  const { threshold = 50, targetRef, offset = ['start start', 'end start'], smooth = true } = options;

  // React state for standard component logic
  const [scrollState, setScrollState] = useState<ScrollProgressState>({
    progress: 0,
    scrollY: 0,
    direction: 'idle',
    isPastThreshold: false
  });

  const lastScrollYRef = useRef(0);

  // Framer Motion native useScroll integration
  const { scrollYProgress, scrollY } = useScroll(
    targetRef ? { target: targetRef, offset } : {}
  );

  // Smooth spring damped progress value for cinematic transitions
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const progress = maxScroll > 0 ? Math.min(Math.max(currentY / maxScroll, 0), 1) : 0;
          const direction =
            currentY > lastScrollYRef.current
              ? 'down'
              : currentY < lastScrollYRef.current
              ? 'up'
              : 'idle';

          lastScrollYRef.current = currentY;

          setScrollState({
            progress,
            scrollY: currentY,
            direction,
            isPastThreshold: currentY > threshold
          });

          ticking = false;
        });

        ticking = true;
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return {
    ...scrollState,
    scrollYProgress,
    smoothProgress,
    scrollYMotion: scrollY
  };
}
