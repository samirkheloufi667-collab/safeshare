import { useEffect, useRef, useState } from 'react';
import { gsap, HEX, prefersReducedMotion, ScrollTrigger, useGSAP } from '@/components/motion/gsap';
import { cx } from '@/lib/format';

function Kicker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">
      <span className="text-seal">{n}</span> — {children}
    </p>
  );
}

/* ------------------------------------------------------------------ 01 */

const LOCKS = [
  { title: 'Il expire.', text: 'Une heure, un jour, un mois : passé ce délai, le lien ne mène plus nulle part. Sans que vous y pensiez.' },
  { title: 'Il se mérite.', text: 'Un mot de passe, transmis par un autre canal. Chaque essai raté est inscrit dans votre journal, et les essais sont limités.' },
  { title: 'Il s’épuise.', text: 'Trois téléchargements, pas un de plus. Au troisième, le sceau se rompt tout seul.' },
];

/**
 * Chapitre 1, épinglé et piloté par le défilement : un lien de partage et ses
 * trois verrous. Le compte à rebours défile, les points du mot de passe se
 * remplissent, les téléchargements montent jusqu'à la limite, puis le lien
 * est barré.
 */
export function LinkLocks() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = root.current!;
      const clock = el.querySelector<HTMLElement>('[data-clock]')!;
      const count = el.querySelector<HTMLElement>('[data-count]')!;
      const steps = gsap.utils.toArray<HTMLElement>('[data-step]', el);
      const fmt = (s: number) => [s / 3600, (s % 3600) / 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, '0')).join(':');

      if (prefersReducedMotion()) return;
      // Même histoire sur grand et petit écran : épinglée et pilotée par le
      // défilement sur ordinateur, jouée d'un trait à l'entrée sur mobile.
      const build = (desktop: boolean) => {
        const state = { seconds: 86_400, downloads: 0 };
        if (desktop) gsap.set(steps.slice(1), { autoAlpha: 0.15 });
        const tl = gsap.timeline({
          defaults: { ease: desktop ? 'none' : 'power1.inOut' },
          scrollTrigger: desktop
            ? { trigger: el, start: 'top top', end: '+=2400', pin: true, scrub: 0.6 }
            : { trigger: el.querySelector('[data-card]'), start: 'top 75%', once: true },
        });
        tl.to(state, { seconds: 0, duration: 2, onUpdate: () => (clock.textContent = fmt(state.seconds)) })
          .to('[data-lock="0"]', { color: 'var(--color-seal)', duration: 0.1 }, '<1.8')
          .to(desktop ? steps[1] : {}, { autoAlpha: 1, duration: 0.3 })
          .to('[data-dot]', { opacity: 1, stagger: 0.12, duration: 0.05 }, '<')
          .to('[data-lock="1"]', { color: 'var(--color-seal)', duration: 0.1 })
          .to(desktop ? steps[2] : {}, { autoAlpha: 1, duration: 0.3 })
          .to(state, { downloads: 3, duration: 1.2, onUpdate: () => (count.textContent = String(Math.round(state.downloads))) }, '<')
          .to('[data-lock="2"]', { color: 'var(--color-seal)', duration: 0.1 })
          .to('[data-strike]', { scaleX: 1, duration: 0.5, ease: 'power2.inOut' })
          .to('[data-broken]', { autoAlpha: 1, y: 0, duration: 0.3 }, '<0.2')
          .to({}, { duration: 0.4 });
        if (!desktop) tl.timeScale(1.4);
      };
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px)', () => build(true));
      mm.add('(max-width: 1023px)', () => build(false));
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="border-t border-line-strong lg:flex lg:h-svh lg:items-center">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:py-0">
        <div className="lg:col-span-5">
          <Kicker n="01">Un lien, trois verrous</Kicker>
          <ol className="mt-8 flex flex-col gap-8">
            {LOCKS.map((l, i) => (
              <li key={l.title} data-step className="border-l border-line-strong pl-5">
                <p className="font-mono text-[11px] text-faint">verrou {i + 1}/3</p>
                <h3 className="display mt-2 text-3xl">{l.title}</h3>
                <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted">{l.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="self-center lg:col-span-7">
          <div data-card className="border border-line-strong bg-surface p-6 sm:p-8">
            <p className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">Lien public · contrat-signé.pdf</p>
            <p className="relative mt-4 inline-block font-mono text-lg break-all text-fg sm:text-2xl">
              safeshare.app/l/7f3a…c91e
              <span data-strike aria-hidden className="absolute inset-x-0 top-1/2 h-[3px] origin-left scale-x-0 bg-seal" />
            </p>
            <dl className="mt-8 grid grid-cols-3 border-t border-line font-mono">
              <div className="border-r border-line pt-4 pr-4">
                <dt data-lock="0" className="text-[10px] tracking-[0.12em] text-muted uppercase">
                  Expire dans
                </dt>
                <dd data-clock className="mt-2 text-xl tabular-nums sm:text-3xl">
                  24:00:00
                </dd>
              </div>
              <div className="border-r border-line px-4 pt-4">
                <dt data-lock="1" className="text-[10px] tracking-[0.12em] text-muted uppercase">
                  Mot de passe
                </dt>
                <dd className="mt-3 flex gap-1.5">
                  {Array.from({ length: 8 }, (_, i) => (
                    <span key={i} data-dot className="size-2.5 rounded-full bg-fg opacity-15 sm:size-3" />
                  ))}
                </dd>
              </div>
              <div className="pt-4 pl-4">
                <dt data-lock="2" className="text-[10px] tracking-[0.12em] text-muted uppercase">
                  Téléchargés
                </dt>
                <dd className="mt-2 text-xl tabular-nums sm:text-3xl">
                  <span data-count>0</span>
                  <span className="text-faint">/3</span>
                </dd>
              </div>
            </dl>
          </div>
          <p data-broken className="invisible mt-5 translate-y-2 font-mono text-[13px] text-seal">
            ● sceau rompu — le lien ne fonctionne plus, pour personne.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 02 */

const TREE: { line: string; name: string; inherited?: boolean; root?: boolean }[] = [
  { line: '', name: 'Refonte site 2027/', root: true },
  { line: '├─ ', name: 'Maquettes/', inherited: true },
  { line: '│  ├─ ', name: 'accueil-v3.fig', inherited: true },
  { line: '│  └─ ', name: 'mobile/', inherited: true },
  { line: '│     └─ ', name: 'menu.png', inherited: true },
  { line: '├─ ', name: 'Textes/', inherited: true },
  { line: '│  └─ ', name: 'tarifs.md', inherited: true },
  { line: '└─ ', name: 'devis-signé.pdf', inherited: true },
];

/** Chapitre 2 : un partage posé sur un dossier descend dans toute l'arborescence. */
export function Inheritance() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        gsap.set('[data-inh]', { opacity: 1 });
        return;
      }
      gsap
        .timeline({ scrollTrigger: { trigger: '[data-tree]', start: 'top 70%', end: 'bottom 45%', scrub: 0.5 } })
        .from('[data-grant]', { opacity: 0, x: -12, duration: 0.6 })
        .to('[data-node]', { color: 'var(--color-fg)', stagger: 0.35, duration: 0.3 }, '<0.3')
        .to('[data-inh]', { opacity: 1, stagger: 0.35, duration: 0.3 }, '<');
    },
    { scope: root },
  );

  return (
    <section ref={root} className="border-t border-line-strong">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:py-36">
        <div className="lg:col-span-5">
          <Kicker n="02">Les droits descendent</Kicker>
          <h2 className="display mt-6 text-4xl leading-[0.95] sm:text-5xl">Partagez un dossier, pas cent fichiers.</h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
            Thomas reçoit « peut modifier » sur un dossier : tout ce qu’il contient suit, à n’importe quelle profondeur. Il ne voit rien de ce qui se trouve au-dessus. Les fichiers qu’il importe restent à vous.
          </p>
        </div>
        <div className="lg:col-span-7" data-tree>
          <div className="border border-line-strong bg-surface p-5 font-mono text-[13px] leading-[2] sm:p-8 sm:text-[15px]">
            <p className="text-faint">$ tree ~/Refonte\ site\ 2027</p>
            {TREE.map((t) => (
              <p key={t.name} className="flex flex-wrap items-baseline whitespace-pre">
                <span className="text-faint">{t.line}</span>
                <span data-node={t.root ? undefined : ''} className={t.root ? 'text-fg' : 'text-faint'}>
                  {t.name}
                </span>
                {t.root && (
                  <span data-grant className="ml-4 text-seal">
                    ← thomas : peut modifier
                  </span>
                )}
                {t.inherited && (
                  <span data-inh className="ml-4 text-[11px] text-muted opacity-0">
                    ↳ hérité
                  </span>
                )}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 03 */

async function sha256(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Chapitre 3, interactif : le visiteur tape, l'empreinte SHA-256 est
 * recalculée pour de vrai dans son navigateur. Une seule lettre changée
 * et elle ne ressemble plus à rien de connu.
 */
export function Fingerprint() {
  const [text, setText] = useState('Contrat signé le 2 octobre — 4 200 €');
  const [hash, setHash] = useState('');
  const out = useRef<HTMLParagraphElement>(null);
  const previous = useRef('');

  useEffect(() => {
    let cancelled = false;
    void sha256(text).then((h) => !cancelled && setHash(h));
    return () => {
      cancelled = true;
    };
  }, [text]);

  useEffect(() => {
    if (!hash || !out.current) return;
    const first = !previous.current;
    const changed = [...hash].filter((c, i) => c !== previous.current[i]).length;
    previous.current = hash;
    if (prefersReducedMotion()) {
      out.current.textContent = hash;
      return;
    }
    gsap.to(out.current, { scrambleText: { text: hash, chars: HEX, speed: 1 }, duration: 0.5, ease: 'none', overwrite: true });
    const counter = document.getElementById('hash-diff');
    if (counter) counter.textContent = !first && changed ? `${changed}/64 caractères ont changé` : '';
  }, [hash]);

  return (
    <section className="border-t border-line-strong">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-36">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Kicker n="03">Une empreinte, pas une promesse</Kicker>
          </div>
          <h2 className="display text-4xl leading-[0.95] sm:text-5xl lg:col-span-7">Chaque fichier reçoit une empreinte SHA-256 à son arrivée.</h2>
        </div>
        <div className="mt-14 border border-line-strong bg-surface lg:ml-[41.66%]">
          <label htmlFor="fp-input" className="block border-b border-line px-5 pt-4 font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
            Modifiez une seule lettre
          </label>
          <input
            id="fp-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={120}
            spellCheck={false}
            className="w-full bg-transparent px-5 pt-2 pb-4 text-lg text-fg outline-none sm:text-xl"
          />
          <div className="border-t border-line px-5 py-4">
            <p className="flex justify-between font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
              sha-256 <span id="hash-diff" className="text-seal normal-case" />
            </p>
            <p ref={out} className="mt-2 font-mono text-[13px] leading-relaxed break-all text-fg sm:text-[15px]" aria-live="polite" />
          </div>
        </div>
        <p className="mt-5 max-w-md text-[14px] leading-relaxed text-muted lg:ml-[41.66%]">
          Calculée ici même, dans votre navigateur. SafeShare fait la même chose pour chaque import : comparez-la après téléchargement, et vous savez si le fichier a été touché.
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 04 */

const LOG = [
  { t: '09:12:04', code: 'IMPORT', text: 'Léa a importé « devis-signé.pdf »' },
  { t: '09:12:31', code: 'LINK+', text: 'Léa a créé un lien vers « devis-signé.pdf » · 24 h · 3 tél.' },
  { t: '10:47:02', code: 'AUTH✕', text: 'Mot de passe erroné sur un lien vers « devis-signé.pdf » · 82.64.x.x', alert: true },
  { t: '10:47:19', code: 'DL·ANON', text: 'Téléchargement anonyme de « devis-signé.pdf » · 82.64.x.x' },
  { t: '14:03:55', code: 'GRANT', text: 'Léa a partagé « Refonte site 2027 » avec Thomas (modification)' },
  { t: '14:20:11', code: 'IMPORT', text: 'Thomas a importé « accueil-v3.fig » dans le dossier de Léa' },
];

/** Chapitre 4 : le journal s'imprime ligne par ligne à l'entrée dans l'écran. */
export function Journal() {
  const root = useRef<HTMLElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const lines = gsap.utils.toArray<HTMLElement>('[data-log]');
      const tl = gsap.timeline({ scrollTrigger: { trigger: '[data-terminal]', start: 'top 70%', once: true } });
      lines.forEach((line) => {
        const text = line.querySelector<HTMLElement>('[data-text]')!;
        const full = text.textContent ?? '';
        tl.set(line, { autoAlpha: 1 }).fromTo(text, { textContent: '' }, { duration: full.length * 0.012, ease: 'none', scrambleText: { text: full, chars: ' ', speed: 1 } });
      });
      gsap.set(lines, { autoAlpha: 0 });
      ScrollTrigger.refresh();
    },
    { scope: root },
  );

  return (
    <section ref={root} className="border-t border-line-strong">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:py-36">
        <div className="lg:col-span-5">
          <Kicker n="04">Le journal n’oublie rien</Kicker>
          <h2 className="display mt-6 text-4xl leading-[0.95] sm:text-5xl">Qui, quoi, quand — même sans compte.</h2>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
            Imports, partages, liens, téléchargements anonymes, mots de passe ratés : tout est inscrit avec l’heure et l’adresse. Les essais de mot de passe sont limités, puis bloqués quelques minutes.
          </p>
        </div>
        <div data-terminal className="border border-line-strong bg-surface p-5 font-mono text-[12px] leading-relaxed sm:p-6 sm:text-[13px] lg:col-span-7">
          <p className="mb-3 text-faint">$ safeshare journal --aujourdhui</p>
          {LOG.map((l) => (
            <p key={l.t} data-log className={cx('grid grid-cols-[4.5rem_4.5rem_1fr] gap-x-3 py-1', l.alert && 'text-seal')}>
              <span className="text-faint">{l.t}</span>
              <span className={l.alert ? 'text-seal' : 'text-muted'}>{l.code}</span>
              <span data-text>{l.text}</span>
            </p>
          ))}
          <p className="caret mt-2 text-faint">$</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ colophon */

const COLOPHON = [
  ['Interface', 'React 19, Vite, Tailwind CSS 4, GSAP (ScrollTrigger, ScrambleText), Lenis, Motion'],
  ['API', 'Node.js, Express 5, Zod, Multer, Prisma, PostgreSQL'],
  ['Sécurité', 'Mots de passe hachés avec scrypt, session en cookie httpOnly, liens stockés sous forme d’empreinte, essais limités'],
  ['Qualité', 'Tests unitaires et de bout en bout (Jest, Supertest) sur une vraie base PostgreSQL'],
  ['Hébergement', 'Une image Docker : l’API sert aussi l’interface. Déployée sur Render.'],
];

export function Colophon() {
  return (
    <section className="border-t border-line-strong">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-24 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Kicker n="05">Colophon</Kicker>
          <p className="display mt-6 text-2xl leading-snug">
            Conçu et développé par{' '}
            <a href="https://samir-kheloufi.netlify.app" target="_blank" rel="noreferrer" className="u-link text-seal">
              Samir Kheloufi
            </a>
            .
          </p>
          <a href="https://github.com/samirkheloufi667-collab/safeshare" target="_blank" rel="noreferrer" className="u-link mt-5 inline-block font-mono text-[12px] text-muted hover:text-fg">
            → lire le code source
          </a>
        </div>
        <dl className="border-t border-line-strong lg:col-span-7">
          {COLOPHON.map(([k, v]) => (
            <div key={k} className="grid gap-1 border-b border-line py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
              <dt className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">{k}</dt>
              <dd className="text-[14px] leading-relaxed">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
