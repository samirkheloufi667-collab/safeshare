import { useId, useRef } from 'react';
import { cx } from '@/lib/format';
import { gsap, prefersReducedMotion, useGSAP } from './gsap';

/**
 * Le sceau de SafeShare : un disque de cire, un texte qui court sur son
 * pourtour. `stamp` le fait tomber sur la page comme un tampon (écrasement,
 * léger rebond, onde d'encre) ; `spin` le fait tourner lentement.
 */
export function Seal({
  size = 120,
  label = 'SAFESHARE · SCELLÉ · SHA-256 · ',
  stamp = false,
  spin = false,
  className,
}: {
  size?: number;
  label?: string;
  stamp?: boolean;
  spin?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      if (stamp) {
        gsap
          .timeline()
          .from('[data-disc]', { scale: 2.2, rotation: -40, opacity: 0, duration: 0.45, ease: 'power4.in', transformOrigin: '50% 50%' })
          .to('[data-disc]', { scale: 0.94, duration: 0.08, ease: 'power1.out', transformOrigin: '50% 50%' })
          .to('[data-disc]', { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
          .fromTo('[data-ripple]', { scale: 0.9, opacity: 0.7 }, { scale: 1.7, opacity: 0, duration: 0.8, ease: 'expo.out', transformOrigin: '50% 50%' }, '<');
      }
      if (spin) gsap.to('[data-ring]', { rotation: 360, duration: 40, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });
    },
    { scope: ref, dependencies: [stamp, spin] },
  );

  return (
    <div ref={ref} className={cx('relative shrink-0', className)} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 120 120" className="absolute inset-0 overflow-visible">
        <circle data-ripple cx="60" cy="60" r="54" fill="none" stroke="var(--color-seal)" strokeWidth="1" opacity="0" />
        <g data-disc>
          {/* Bord irrégulier de la cire : un cercle légèrement déformé. */}
          <path
            d="M60 4c9 0 13 4 21 7s14 3 19 10 4 12 8 19 7 12 6 20-6 12-8 19-3 14-9 19-12 4-19 8-11 7-18 7-12-4-19-7-14-3-19-10-4-12-8-19-7-12-6-20 6-12 8-19 3-14 9-19 12-4 19-8 11-7 17-7z"
            fill="var(--color-seal)"
          />
          <circle cx="60" cy="60" r="41" fill="none" stroke="var(--color-ink)" strokeOpacity=".55" strokeWidth=".8" />
          <circle cx="60" cy="60" r="27" fill="none" stroke="var(--color-ink)" strokeOpacity=".55" strokeWidth=".8" />
          <g data-ring>
            <defs>
              <path id={`ring-${id}`} d="M60 60m-34 0a34 34 0 1 1 68 0a34 34 0 1 1-68 0" />
            </defs>
            <text fontFamily="var(--font-mono)" fontSize="7.4" fontWeight="700" letterSpacing="1.6" fill="var(--color-ink)">
              <textPath href={`#ring-${id}`}>{label.repeat(2)}</textPath>
            </text>
          </g>
          <path d="M51 60h18M60 51v18" stroke="var(--color-ink)" strokeWidth="3" />
        </g>
      </svg>
    </div>
  );
}
