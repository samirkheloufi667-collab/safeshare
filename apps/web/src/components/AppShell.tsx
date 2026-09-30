import { Activity, HardDrive, Link2, LogOut, Menu, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { Spinner } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { cx, formatBytes } from '@/lib/format';

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cx('flex items-center gap-2.5', className)} aria-label="SafeShare, accueil">
      <img src="/favicon.svg" alt="" className="size-8" />
      <span className="font-display text-lg font-bold tracking-tight">
        Safe<span className="text-gold">Share</span>
      </span>
    </Link>
  );
}

const NAV = [
  { to: '/drive', label: 'Mes fichiers', icon: HardDrive },
  { to: '/partages', label: 'Partagés avec moi', icon: Users },
  { to: '/liens', label: 'Liens de partage', icon: Link2 },
  { to: '/activite', label: 'Activité', icon: Activity },
];

/** Cadre de l'application connectée : barre latérale sur ordinateur, tiroir sur mobile. */
export function AppShell() {
  const { status, me, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  if (status === 'loading') return <Spinner />;
  if (!me) return <Navigate to={`/connexion?next=${encodeURIComponent(location.pathname)}`} replace />;

  const ratio = Math.min(1, me.usedBytes / me.quotaBytes);
  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Logo className="px-2 pt-1" />
      <nav className="flex flex-col gap-1" aria-label="Navigation principale">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-gold-soft text-gold' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            <Icon className="size-4" /> {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface-2/60 p-4">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-muted">Stockage</span>
            <span className="font-mono text-faint">{Math.round(ratio * 100)} %</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className={cx('h-full rounded-full', ratio > 0.9 ? 'bg-danger' : 'bg-gold')} style={{ width: `${Math.max(ratio * 100, 1.5)}%` }} />
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">
            {formatBytes(me.usedBytes)} sur {formatBytes(me.quotaBytes)} · {me.fileCount} fichier(s)
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl px-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 font-display text-sm font-bold text-gold">
            {me.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{me.name}</p>
            <p className="truncate text-xs text-muted">{me.email}</p>
          </div>
          <button type="button" onClick={logout} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Se déconnecter" title="Se déconnecter">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-svh">
      <aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-r border-line bg-surface lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} aria-label="Fermer le menu" />
          <aside className="relative h-full w-72 max-w-[85vw] border-r border-line bg-surface">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-4 right-3 rounded-lg p-2 text-muted hover:text-fg" aria-label="Fermer le menu">
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-ink/85 px-4 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-fg hover:bg-surface-2" aria-label="Ouvrir le menu">
            <Menu className="size-5" />
          </button>
          <Logo />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
