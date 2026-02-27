'use client';

import { useEffectEvent, useLayoutEffect, useState } from 'react';

import { cn } from '@/lib/utils';

function useScrollPosition(): number {
  const [scrollPosition, setScrollPosition] = useState(0);

  const handleScroll = useEffectEvent(() => {
    setScrollPosition(window.scrollY);
  });

  useLayoutEffect(() => {
    handleScroll();
    document.addEventListener('scroll', handleScroll);
    return () => {
      document.removeEventListener('scroll', handleScroll);
    };
  }, []);
  return scrollPosition;
}

export type ParallaxBackgroundGridProps = {
  className?: string;
};

/**
 * A parallax background grid with Forerunner-style cyan tinting.
 */
export const ParallaxBackgroundGrid: React.FC<ParallaxBackgroundGridProps> = ({
  className,
}) => {
  const scrollPosition = useScrollPosition();
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 h-full overflow-hidden',
        className,
      )}
    >
      {/* Grid pattern layer */}
      <div
        className='text-primary/30 dark:text-primary/20 fade-in-on-mount absolute inset-0 h-[200%] w-full'
        style={{
          backgroundImage: 'url(/graph-paper.svg)',
          transform: `translateY(${scrollPosition * 0.1}px)`,
          willChange: 'transform',
        }}
      />
      {/* Subtle vignette overlay */}
      <div
        className='to-background/50 absolute inset-0 bg-gradient-to-b from-transparent via-transparent'
        style={{ pointerEvents: 'none' }}
      />
    </div>
  );
};
