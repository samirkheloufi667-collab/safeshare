import { useRef } from 'react';
import { gsap, prefersReducedMotion, useGSAP } from './gsap';

/**
 * Fait entrer les enfants marqués [data-reveal] l'un après l'autre.
 * `watch` relance l'animation quand la liste change (chargement des données).
 */
export function Stagger({ children, className, watch, as: Component = 'div' }: { children: React.ReactNode; className?: string; watch?: unknown; as?: 'div' | 'ul' | 'ol' }) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return;
      const items = ref.current.querySelectorAll('[data-reveal]');
      if (items.length) gsap.from(items, { opacity: 0, x: -10, duration: 0.6, stagger: 0.03, clearProps: 'all' });
    },
    { scope: ref, dependencies: [watch] },
  );
  return (
    <Component ref={ref as never} className={className}>
      {children}
    </Component>
  );
}
