import { useRef } from 'react';
import { gsap, HEX, prefersReducedMotion, useGSAP } from './gsap';

/**
 * Texte qui se « déchiffre » : des caractères aléatoires se stabilisent un à
 * un jusqu'au texte final. Sert aux empreintes SHA-256 et aux titres.
 * `onView` attend que l'élément entre à l'écran.
 *
 * Le texte animé vit dans un élément que React ne gère pas (GSAP réécrit son
 * contenu) ; le vrai texte reste lisible par les lecteurs d'écran.
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
  const shown = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = shown.current;
      if (!el) return;
      if (prefersReducedMotion()) {
        el.textContent = text;
        return;
      }
      // ScrambleText anime « vers » un texte : on part d'un élément vide.
      el.textContent = '';
      gsap.to(el, {
        scrambleText: { text, chars, revealDelay: duration * 0.25, speed: 0.7 },
        duration,
        delay,
        ease: 'none',
        scrollTrigger: onView ? { trigger: el, start: 'top 90%', once: true } : undefined,
      });
    },
    { scope: ref, dependencies: [text] },
  );

  return (
    <Tag ref={ref as never} className={className}>
      <span className="sr-only">{text}</span>
      <span ref={shown} aria-hidden />
    </Tag>
  );
}
