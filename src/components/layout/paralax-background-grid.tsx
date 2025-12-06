'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

function useScrollPosition(): number {
  const [scrollPosition, setScrollPosition] = useState(0);
  useEffect(() => {
    const abortController = new AbortController();
    document.addEventListener(
      'scroll',
      () => {
        setScrollPosition(window.scrollY);
      },
      abortController,
    );
    setScrollPosition(window.scrollY);
    return () => abortController.abort();
  }, []);
  return scrollPosition;
}

export type ParallaxBackgroundGridProps = {
  className?: string;
};

export const ParallaxBackgroundGrid: React.FC<ParallaxBackgroundGridProps> = ({
  className,
}) => {
  const scrollPosition = useScrollPosition();
  return (
    <div
      className={cn('absolute inset-0 -z-10 h-full opacity-50', className)}
      style={{
        backgroundImage: 'url(/graph-paper.svg)',
        // backgroundColor: '#141845',
        transform: `translateY(${scrollPosition * 0.1}px)`,
        willChange: 'transform',
      }}
    />
  );
};
