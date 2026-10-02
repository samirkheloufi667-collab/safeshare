import { cx, formatBytes } from '@/lib/format';

export interface UploadJob {
  id: number;
  label: string;
  bytes: number;
  progress: number;
  status: 'sending' | 'done' | 'error';
  error?: string;
}

/** Barre de progression en caractères, comme une sortie de terminal. */
function TextBar({ value, status }: { value: number; status: UploadJob['status'] }) {
  const cells = 28;
  const full = Math.round(value * cells);
  return (
    <span className="font-mono text-[11px] tracking-[-0.05em]" aria-hidden>
      <span className={status === 'error' ? 'text-seal' : 'text-fg'}>{'█'.repeat(full)}</span>
      <span className="text-line-strong">{'░'.repeat(cells - full)}</span>
    </span>
  );
}

/** Suivi des envois en cours, en bas à droite de l'écran. */
export function UploadTray({ jobs, onDismiss }: { jobs: UploadJob[]; onDismiss: () => void }) {
  if (jobs.length === 0) return null;
  const running = jobs.some((j) => j.status === 'sending');
  return (
    <div className="fixed right-4 bottom-4 z-30 w-[min(380px,calc(100vw-2rem))] border border-line-strong bg-surface-2" aria-live="polite">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="font-mono text-[11px] tracking-[0.12em] uppercase">{running ? 'Import et scellement…' : 'Imports terminés'}</p>
        {!running && (
          <button type="button" onClick={onDismiss} className="font-mono text-[11px] text-muted hover:text-fg" aria-label="Fermer">
            ✕
          </button>
        )}
      </div>
      <ul className="max-h-60 divide-y divide-line overflow-y-auto">
        {jobs.map((j) => {
          const value = j.status === 'sending' ? j.progress : 1;
          return (
            <li key={j.id} className="px-4 py-3">
              <div className="flex items-baseline gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{j.label}</span>
                <span className="font-mono text-[11px] text-muted">{formatBytes(j.bytes)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <TextBar value={value} status={j.status} />
                <span className={cx('font-mono text-[11px]', j.status === 'error' ? 'text-seal' : j.status === 'done' ? 'text-fg' : 'text-muted')}>
                  {j.status === 'done' ? 'SCELLÉ' : j.status === 'error' ? 'ÉCHEC' : `${Math.round(value * 100)} %`}
                </span>
              </div>
              {j.error && <p className="mt-1.5 text-xs text-seal">{j.error}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
