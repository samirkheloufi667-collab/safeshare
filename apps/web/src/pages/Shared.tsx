import { Download, LogOut, Users } from 'lucide-react';
import { Link } from 'react-router';
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
    <div className="flex flex-col gap-6">
      <PageHeader title="Partagés avec moi" subtitle="Les dossiers et fichiers que d’autres personnes vous ont ouverts." />
      {shared.error && <ErrorNote>{shared.error}</ErrorNote>}
      {shared.loading && !shared.data && <Spinner />}
      {shared.data?.length === 0 && (
        <EmptyState icon={<Users className="size-5" />} title="Rien pour l’instant" text="Quand quelqu’un vous partage un dossier ou un fichier, il apparaît ici." />
      )}
      {shared.data && shared.data.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {shared.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {s.folder ? (
                <Link to={`/drive/${s.folder.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:text-gold">
                  <FolderMark size={36} shared />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{s.folder.name}</span>
                    <span className="block text-xs text-muted">
                      {s.folder.itemCount} élément(s) · par {s.grantedBy} · {timeAgo(s.sharedAt)}
                    </span>
                  </span>
                </Link>
              ) : (
                s.file && (
                  <button type="button" onClick={() => downloadFile(s.file!.id).catch((e) => toast('error', errorMessage(e)))} className="flex min-w-0 flex-1 items-center gap-3 text-left hover:text-gold">
                    <FileMark mime={s.file.mimeType} name={s.file.name} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{s.file.name}</span>
                      <span className="block text-xs text-muted">
                        {formatBytes(s.file.size)} · par {s.grantedBy} · {timeAgo(s.sharedAt)}
                      </span>
                    </span>
                    <Download className="size-4 shrink-0 text-muted" />
                  </button>
                )
              )}
              <Badge color="var(--color-gold)">{ROLE_LABEL[s.role]}</Badge>
              <button type="button" onClick={() => leave(s)} className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Quitter ce partage" title="Quitter ce partage">
                <LogOut className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
