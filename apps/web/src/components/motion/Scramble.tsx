import { useRef } from 'react';
import { gsap, HEX, prefersReducedMotion, useGSAP } from './gsap';

/**
 * Texte qui se « déchiffre » : des caractères aléatoires se stabilisent un à
 * un jusqu'au texte final. Sert aux empreintes SHA-256 et aux titres.
 * `onView` attend que l'élément entre à l'écran.
 */
export function Scramble({
  text,
  chars = HEX,
  duration = 1.2,
  delay = 0,
  onView = false,
  className,
  as: Tag = 'span',
}: {
  text: string;
  chars?: string;
  duration?: number;
  delay?: number;
  onView?: boolean;
  className?: string;
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3';
}) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      gsap.fromTo(
        el,
        { scrambleText: { text: ' ', chars } },
        {
          scrambleText: { text, chars, revealDelay: duration * 0.25, speed: 0.7 },
          duration,
          delay,
          ease: 'none',
          scrollTrigger: onView ? { trigger: el, start: 'top 90%', once: true } : undefined,
        },
      );
    },
    { scope: ref, dependencies: [text] },
  );
  return (
    <Tag ref={ref as never} className={className} aria-label={text}>
      {text}
    </Tag>
  );
}
