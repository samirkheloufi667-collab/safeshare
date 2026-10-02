import { Link } from 'react-router';
import { Stagger } from '@/components/motion/Stagger';
import { Badge, EmptyState, ErrorNote, FileMark, FolderMark, PageHeader, Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { api, downloadFile, errorMessage } from '@/lib/api';
import { formatBytes, ROLE_LABEL, timeAgo } from '@/lib/format';
import type { SharedWithMe } from '@/lib/types';
import { useApi } from '@/lib/use-api';

export default function Shared() {
  const toast = useToast();
  const shared = useApi<SharedWithMe[]>('/shared');

  async function leave(s: SharedWithMe) {
    try {
      await api(`/shares/${s.id}`, { method: 'DELETE' });
      toast('success', 'Vous avez quitté ce partage');
      void shared.reload();
    } catch (e) {
      toast('error', errorMessage(e));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader path="~/partages" title="Partagés avec moi" subtitle="Ce que d’autres personnes vous ont ouvert, avec les droits qu’elles vous ont donnés." />
      {shared.error && <ErrorNote>{shared.error}</ErrorNote>}
      {shared.loading && !shared.data && <Spinner />}
      {shared.data?.length === 0 && <EmptyState title="Rien pour l’instant." text="Quand quelqu’un vous partage un dossier ou un fichier, il apparaît ici." />}
      {shared.data && shared.data.length > 0 && (
        <Stagger as="ul" watch={shared.data.length} className="border-t border-line-strong">
          {shared.data.map((s, i) => (
            <li key={s.id} data-reveal className="group flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-2 py-3 transition-colors hover:bg-surface-2">
              <span className="w-8 font-mono text-[11px] text-faint">{String(i + 1).padStart(3, '0')}</span>
              {s.folder ? (
                <Link to={`/drive/${s.folder.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <FolderMark size={30} shared />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] group-hover:underline">{s.folder.name}/</span>
                    <span className="block font-mono text-[11px] text-muted">
                      {s.folder.itemCount} élément(s) · de {s.grantedBy} · {timeAgo(s.sharedAt)}
                    </span>
                  </span>
                </Link>
              ) : (
                s.file && (
                  <button type="button" onClick={() => downloadFile(s.file!.id).catch((e) => toast('error', errorMessage(e)))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <FileMark mime={s.file.mimeType} name={s.file.name} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] group-hover:underline">{s.file.name}</span>
                      <span className="block font-mono text-[11px] text-muted">
                        {formatBytes(s.file.size)} · de {s.grantedBy} · {timeAgo(s.sharedAt)} · cliquer pour télécharger
                      </span>
                    </span>
                  </button>
                )
              )}
              <Badge color={s.role === 'EDITOR' ? 'var(--color-fg)' : 'var(--color-muted)'}>{ROLE_LABEL[s.role]}</Badge>
              <button type="button" onClick={() => leave(s)} className="u-link font-mono text-[11px] tracking-[0.08em] text-muted uppercase hover:text-seal" title="Quitter ce partage">
                Quitter
              </button>
            </li>
          ))}
        </Stagger>
      )}
    </div>
  );
}
