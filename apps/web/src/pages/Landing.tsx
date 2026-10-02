import Lenis from 'lenis';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Copyright, Logo } from '@/components/AppShell';
import { Colophon, Fingerprint, Inheritance, Journal, LinkLocks } from '@/components/landing/chapters';
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from '@/components/motion/gsap';
import { Seal } from '@/components/motion/Seal';
import { buttonClass } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&';

/** Défilement doux, synchronisé avec ScrollTrigger, seulement sur cette page. */
function useSmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.09 });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);
}

/**
 * Accueil : le titre se déchiffre ligne par ligne, le grand sceau tourne au
 * rythme du défilement, puis quatre chapitres montrent ce que fait SafeShare
 * au lieu de l'énumérer.
 */
export default function Landing() {
  const { me } = useAuth();
  const hero = useRef<HTMLElement>(null);
  useSmoothScroll();

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const tl = gsap.timeline();
      tl.from('[data-rule]', { scaleX: 0, transformOrigin: 'left', duration: 1.2, ease: 'expo.inOut' })
        .to('[data-line]', { duration: 1.1, stagger: 0.25, ease: 'none', scrambleText: { text: '{original}', chars: LETTERS, revealDelay: 0.3, speed: 0.8 } }, 0)
        .from('[data-fade]', { autoAlpha: 0, y: 14, duration: 0.9, stagger: 0.08 }, 0.9)
        .from('[data-seal]', { scale: 0.6, rotation: -90, autoAlpha: 0, duration: 1.4, ease: 'expo.out' }, 0.3);
      // Le sceau tourne avec le défilement, et s'éloigne à mesure que la page descend.
      gsap.to('[data-seal]', { rotation: 220, yPercent: 30, ease: 'none', scrollTrigger: { trigger: hero.current, start: 'top top', end: 'bottom top', scrub: true } });
    },
    { scope: hero },
  );

  return (
    <div className="overflow-x-clip">
      <header ref={hero} className="relative mx-auto flex min-h-svh max-w-7xl flex-col px-5 pt-5 sm:px-8">
        <nav className="flex items-center justify-between gap-4">
          <Logo />
          <div data-fade className="flex items-center gap-5 font-mono text-[12px] tracking-[0.06em] uppercase">
            {me ? (
              <Link to="/drive" className="u-link">
                Mon coffre →
              </Link>
            ) : (
              <>
                <Link to="/connexion" className="u-link text-muted hover:text-fg">
                  Connexion
                </Link>
                <Link to="/inscription" className="u-link">
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </nav>
        <span data-rule className="mt-5 block h-px bg-line-strong" />
        <div data-fade className="flex justify-between py-2 font-mono text-[10px] tracking-[0.16em] text-faint uppercase">
          <span>Partage de fichiers</span>
          <span className="hidden sm:inline">Dossiers · Droits · Liens · Journal</span>
          <span>Démonstration</span>
        </div>

        <div className="relative flex flex-1 flex-col justify-center py-14">
          <h1 className="display relative z-10 text-[15vw] leading-[0.86] uppercase sm:text-[11vw] xl:text-[9.5rem]">
            <span data-line className="block">
              Vos fichiers,
            </span>
            <span data-line className="block text-seal">
              sous scellés.
            </span>
          </h1>
          <div data-seal className="pointer-events-none absolute top-1/2 right-0 hidden -translate-y-1/2 opacity-90 md:block">
            <Seal size={340} label="SAFESHARE · SCELLÉ · SHA-256 · " />
          </div>
        </div>

        <div className="grid gap-8 border-t border-line-strong py-8 sm:grid-cols-12">
          <p data-fade className="max-w-md text-lg leading-relaxed text-muted sm:col-span-7">
            Rangez vos documents, décidez qui peut les voir ou les modifier, envoyez des liens qui expirent tout seuls. Chaque accès laisse une trace.
          </p>
          <div data-fade className="flex flex-wrap items-center gap-5 sm:col-span-5 sm:justify-end">
            <Link to={me ? '/drive' : '/connexion?demo=1'} className={buttonClass('primary', 'lg')}>
              {me ? 'Ouvrir mon coffre' : 'Essayer la démo'}
            </Link>
            {!me && (
              <Link to="/inscription" className="u-link font-mono text-[12px] tracking-[0.06em] uppercase">
                Créer un compte
              </Link>
            )}
          </div>
        </div>
      </header>

      <LinkLocks />
      <Inheritance />
      <Fingerprint />
      <Journal />

      <Link to={me ? '/drive' : '/connexion?demo=1'} className="group relative isolate block overflow-hidden border-t border-line-strong">
        <span aria-hidden className="absolute inset-0 -z-10 origin-left scale-x-0 bg-seal transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-x-100" />
        <span className="mx-auto flex max-w-7xl items-baseline justify-between gap-6 px-5 py-14 transition-colors duration-500 group-hover:text-ink sm:px-8 lg:py-20">
          <span className="display text-5xl uppercase sm:text-7xl lg:text-8xl">{me ? 'Mon coffre' : 'Ouvrir la démo'}</span>
          <span className="display text-5xl transition-transform duration-700 group-hover:translate-x-3 sm:text-7xl">→</span>
        </span>
      </Link>

      <Colophon />

      <footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 border-t border-line px-5 py-6 sm:px-8">
        <Copyright />
        <p className="font-mono text-[10px] tracking-[0.08em] text-faint uppercase">Personnes et fichiers fictifs</p>
      </footer>
    </div>
  );
}
