'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
  /** 0–5 stagger delay class */
  delay?: 0 | 1 | 2 | 3 | 4 | 5;
  /** Root margin for earlier trigger */
  rootMargin?: string;
};

/**
 * Dribbble-style: content fades/slides up as it enters the viewport.
 */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  rootMargin = '0px 0px -8% 0px',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      el.classList.add('is-visible');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        }
      },
      { root: null, rootMargin, threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  const delayCls =
    delay === 1
      ? 'bi-reveal-delay-1'
      : delay === 2
        ? 'bi-reveal-delay-2'
        : delay === 3
          ? 'bi-reveal-delay-3'
          : delay === 4
            ? 'bi-reveal-delay-4'
            : delay === 5
              ? 'bi-reveal-delay-5'
              : '';

  return (
    <div ref={ref} className={cn('bi-reveal', delayCls, className)}>
      {children}
    </div>
  );
}
