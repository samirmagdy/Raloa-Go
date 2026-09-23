import React, { useEffect, useRef, useState } from 'react';

interface FadeInSectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  delayClass?: string;
  threshold?: number;
  rootMargin?: string;
}

/**
 * Reusable wrapper that triggers a subtle fade-in and upward glide
 * animation using Tailwind CSS classes as sections scroll into the viewport.
 */
export const FadeInSection: React.FC<FadeInSectionProps> = ({
  children,
  className = '',
  id,
  delayClass = '',
  threshold = 0.08,
  rootMargin = '0px 0px -40px 0px'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If IntersectionObserver is not available, default to visible immediately
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Once the section has faded in, unobserve to preserve memory and prevent re-triggering
            if (domRef.current) {
              observer.unobserve(domRef.current);
            }
          }
        });
      },
      {
        threshold,
        rootMargin
      }
    );

    const currentTarget = domRef.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [threshold, rootMargin]);

  return (
    <div
      ref={domRef}
      id={id}
      className={`w-full transition-all duration-700 ease-out will-change-[opacity,transform] motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:translate-y-0 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-8'
      } ${delayClass} ${className}`}
    >
      {children}
    </div>
  );
};
