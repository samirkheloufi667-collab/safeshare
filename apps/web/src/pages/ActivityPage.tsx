import { Activity, Download, FolderPlus, KeyRound, Link2, Link2Off, MoveRight, Pencil, ShieldAlert, Trash2, Upload, UserMinus, UserPlus } from 'lucide-react';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '@/components/ui/primitives';
import { ACTION_LABEL, cx, formatDateTime, timeAgo } from '@/lib/format';
import type { ActivityEntry } from '@/lib/types';
import { useApi } from '@/lib/use-api';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  upload: Upload,
  download: Download,
  'folder.create': FolderPlus,
  rename: Pencil,
  move: MoveRight,
  delete: Trash2,
  'share.grant': UserPlus,
  'share.update': KeyRound,
  'share.revoke': UserMinus,
  'link.create': Link2,
  'link.revoke': Link2Off,
  'link.download': Download,
  'link.password_failed': ShieldAlert,
};

/** Actions qui méritent l'attention : accès anonymes et tentatives échouées. */
const ALERT = new Set(['link.password_failed']);
const ANONYMOUS = new Set(['link.download', 'link.password_failed']);

export default function ActivityPage() {
  const log = useApi<ActivityEntry[]>('/activity?limit=150');
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Activité" subtitle="Tout ce qui touche vos fichiers : imports, téléchargements, partages, liens — y compris par des personnes sans compte." />
      {log.error && <ErrorNote>{log.error}</ErrorNote>}
      {log.loading && !log.data && <Spinner />}
      {log.data?.length === 0 && <EmptyState icon={<Activity className="size-5" />} title="Aucune activité" text="Le journal se remplira dès vos premiers imports." />}
      {log.data && log.data.length > 0 && (
        <ol className="relative flex flex-col gap-1 before:absolute before:top-3 before:bottom-3 before:left-[19px] before:w-px before:bg-line">
          {log.data.map((e) => {
            const Icon = ICONS[e.action] ?? Activity;
            const alert = ALERT.has(e.action);
            const anonymous = ANONYMOUS.has(e.action);
            return (
              <li key={e.id} className="relative flex gap-4 rounded-xl px-1 py-2.5">
                <span
                  className={cx(
                    'relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl border',
                    alert ? 'border-danger/30 bg-danger/10 text-danger' : anonymous ? 'border-gold/30 bg-gold-soft text-gold' : 'border-line bg-surface-2 text-muted',
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm">
                    {!anonymous && <strong className="font-semibold">{e.actor?.name ?? 'Utilisateur supprimé'} </strong>}
                    <span className="text-muted">{ACTION_LABEL[e.action] ?? e.action}</span> <span className="font-medium">« {e.targetName} »</span>
                  </p>
                  <p className="mt-0.5 text-xs text-faint">
                    <time dateTime={e.createdAt} title={formatDateTime(e.createdAt)}>
                      {timeAgo(e.createdAt)}
                    </time>
                    {e.details && ` · ${e.details}`}
                    {e.ip && <span className="font-mono"> · {e.ip}</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
