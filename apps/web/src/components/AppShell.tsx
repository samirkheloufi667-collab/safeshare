import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { Spinner } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { cx, formatBytes } from '@/lib/format';

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2.5', className)} aria-label="SafeShare, accueil">
      <img src="/favicon.svg" alt="" className="size-6" />
      <span className="display text-[17px] lowercase">safeshare</span>
    </Link>
  );
}

const NAV = [
  { to: '/drive', label: 'Mes fichiers', path: '~/' },
  { to: '/partages', label: 'Partagés avec moi', path: '~/partages' },
  { to: '/liens', label: 'Liens publics', path: '~/liens' },
  { to: '/activite', label: 'Journal', path: '~/journal' },
];

/** Jauge de stockage en caractères : chaque bloc vaut 1/24 du quota. */
function TextGauge({ ratio }: { ratio: number }) {
  const cells = 24;
  const full = Math.round(ratio * cells);
  return (
    <span className="font-mono text-[12px] tracking-[-0.05em]" aria-hidden>
      <span className={ratio > 0.9 ? 'text-seal' : 'text-fg'}>{'█'.repeat(full)}</span>
      <span className="text-line-strong">{'░'.repeat(cells - full)}</span>
    </span>
  );
}

export function Copyright({ className }: { className?: string }) {
  return <p className={cx('font-mono text-[10px] tracking-[0.08em] text-faint uppercase', className)}>© {new Date().getFullYear()} Samir Kheloufi — tous droits réservés</p>;
}

/**
 * Cadre de l'application : un explorateur. Les rubriques à gauche, numérotées
 * comme des tiroirs d'archive ; un tiroir plein écran sur mobile.
 */
export function AppShell() {
  const { status, me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  if (status === 'loading') return <Spinner />;
  if (!me) return <Navigate to={`/connexion?next=${encodeURIComponent(location.pathname)}`} replace />;

  const ratio = Math.min(1, me.usedBytes / me.quotaBytes);
  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b border-line px-5">
        <Logo />
      </div>
      <nav className="flex flex-col py-4" aria-label="Navigation principale">
        {NAV.map(({ to, label }, i) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cx('group relative flex items-baseline gap-3 px-5 py-2.5 text-[14px] transition-colors', isActive ? 'text-fg' : 'text-muted hover:text-fg')
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <motion.span layoutId="nav-mark" className="absolute inset-y-1 left-0 w-[2px] bg-seal" transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} />}
                <span className="font-mono text-[10px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                <span className="transition-transform duration-300 group-hover:translate-x-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto border-t border-line px-5 py-5">
        <p className="flex items-baseline justify-between font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
          Stockage <span>{Math.round(ratio * 100)} %</span>
        </p>
        <div className="mt-2 overflow-hidden">
          <TextGauge ratio={ratio} />
        </div>
        <p className="mt-1 font-mono text-[11px] text-muted">
          {formatBytes(me.usedBytes)} / {formatBytes(me.quotaBytes)} · {me.fileCount} fichier{me.fileCount > 1 ? 's' : ''}
        </p>
      </div>
      <div className="border-t border-line px-5 py-4">
        <p className="truncate text-sm">{me.name}</p>
        <p className="truncate font-mono text-[11px] text-muted">{me.email}</p>
        <button type="button" onClick={logout} className="u-link mt-3 font-mono text-[11px] tracking-[0.1em] text-muted uppercase hover:text-seal">
          Se déconnecter
        </button>
      </div>
    </div>
  );

  const current = NAV.find((n) => location.pathname.startsWith(n.to));

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-label="Fermer le menu" />
            <motion.aside
              className="relative h-full w-72 max-w-[85vw] border-r border-line bg-surface"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {sidebar}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-ink/90 px-4 backdrop-blur lg:hidden">
          <Logo />
          <button type="button" onClick={() => setOpen(true)} className="font-mono text-[11px] tracking-[0.14em] uppercase" aria-label="Ouvrir le menu">
            Menu
          </button>
        </header>
        <div className="hidden h-14 items-center justify-between border-b border-line px-8 font-mono text-[12px] text-faint lg:flex">
          <span>
            {me.email.split('@')[0]}@safeshare:<span className="text-muted">{current?.path ?? '~'}</span>
            <span className="caret text-fg" />
          </span>
          <span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
          <Outlet />
        </main>
        <footer className="border-t border-line px-4 py-4 sm:px-8">
          <Copyright />
        </footer>
      </div>
    </div>
  );
}
