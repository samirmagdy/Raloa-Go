import { useState } from 'react';
import { useMotionValueEvent, useScroll, useSpring } from 'motion/react';

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

  useMotionValueEvent(scrollY, 'change', (currentY) => {
    const previousY = scrollY.getPrevious() ?? currentY;
    const direction = currentY > previousY ? 'down' : currentY < previousY ? 'up' : 'idle';
    setScrollState((previous) => ({
      ...previous,
      scrollY: currentY,
      direction,
      isPastThreshold: currentY > threshold
    }));
  });

  useMotionValueEvent(scrollYProgress, 'change', (progress) => {
    setScrollState((previous) => ({ ...previous, progress }));
  });

  return {
    ...scrollState,
    scrollYProgress,
    smoothProgress,
    scrollYMotion: scrollY
  };
}
