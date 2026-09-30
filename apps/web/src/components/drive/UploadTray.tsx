import { CircleCheck, CircleX, UploadCloud, X } from 'lucide-react';
import { cx, formatBytes } from '@/lib/format';

export interface UploadJob {
  id: number;
  label: string;
  bytes: number;
  progress: number;
  status: 'sending' | 'done' | 'error';
  error?: string;
}

/** Suivi des envois en cours, en bas à droite de l'écran. */
export function UploadTray({ jobs, onDismiss }: { jobs: UploadJob[]; onDismiss: () => void }) {
  if (jobs.length === 0) return null;
  const running = jobs.some((j) => j.status === 'sending');
  return (
    <div className="fixed right-4 bottom-4 z-30 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line-strong bg-surface-2 shadow-2xl shadow-black/60" aria-live="polite">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <UploadCloud className="size-4 text-gold" /> {running ? 'Envoi en cours…' : 'Envois terminés'}
        </p>
        {!running && (
          <button type="button" onClick={onDismiss} className="rounded-md p-1 text-muted hover:text-fg" aria-label="Fermer">
            <X className="size-4" />
          </button>
        )}
      </div>
      <ul className="max-h-60 divide-y divide-line overflow-y-auto">
        {jobs.map((j) => (
          <li key={j.id} className="px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{j.label}</span>
              <span className="font-mono text-xs text-muted">{formatBytes(j.bytes)}</span>
              {j.status === 'done' && <CircleCheck className="size-4 text-ok" />}
              {j.status === 'error' && <CircleX className="size-4 text-danger" />}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
              <div
                className={cx('h-full rounded-full transition-[width] duration-200', j.status === 'error' ? 'bg-danger' : j.status === 'done' ? 'bg-ok' : 'bg-gold')}
                style={{ width: `${Math.round((j.status === 'sending' ? j.progress : 1) * 100)}%` }}
              />
            </div>
            {j.error && <p className="mt-1.5 text-xs text-danger">{j.error}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
