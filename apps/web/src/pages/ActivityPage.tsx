import { Stagger } from '@/components/motion/Stagger';
import { EmptyState, ErrorNote, PageHeader, Spinner } from '@/components/ui/primitives';
import { ACTION_LABEL, cx, formatDateTime } from '@/lib/format';
import type { ActivityEntry } from '@/lib/types';
import { useApi } from '@/lib/use-api';

/** Code court de chaque action, comme dans un journal système. */
const CODE: Record<string, string> = {
  upload: 'IMPORT',
  download: 'DL',
  'folder.create': 'MKDIR',
  rename: 'RENAME',
  move: 'MOVE',
  delete: 'DELETE',
  'share.grant': 'GRANT',
  'share.update': 'CHMOD',
  'share.revoke': 'REVOKE',
  'link.create': 'LINK+',
  'link.revoke': 'LINK−',
  'link.download': 'DL·ANON',
  'link.password_failed': 'AUTH✕',
};

/** Actions qui méritent l'attention : accès anonymes et tentatives échouées. */
const ALERT = new Set(['link.password_failed']);
const ANONYMOUS = new Set(['link.download', 'link.password_failed']);

const dayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Le journal présenté comme une sortie de terminal, regroupée par jour. */
export default function ActivityPage() {
  const log = useApi<ActivityEntry[]>('/activity?limit=150');

  const days: { day: string; entries: ActivityEntry[] }[] = [];
  for (const e of log.data ?? []) {
    const day = dayFmt.format(new Date(e.createdAt));
    if (days[days.length - 1]?.day !== day) days.push({ day, entries: [] });
    days[days.length - 1].entries.push(e);
  }
  const alerts = log.data?.filter((e) => ALERT.has(e.action)).length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        path="~/journal"
        title="Journal"
        subtitle={
          log.data
            ? `${log.data.length} entrées. Imports, téléchargements, partages, liens — y compris par des personnes sans compte.${alerts ? ` ${alerts} tentative${alerts > 1 ? 's' : ''} de mot de passe échouée${alerts > 1 ? 's' : ''}.` : ''}`
            : undefined
        }
      />
      {log.error && <ErrorNote>{log.error}</ErrorNote>}
      {log.loading && !log.data && <Spinner />}
      {log.data?.length === 0 && <EmptyState title="Journal vide." text="Il se remplira dès vos premiers imports." />}

      {days.map(({ day, entries }) => (
        <section key={day}>
          <h2 className="mb-2 font-mono text-[11px] tracking-[0.14em] text-faint uppercase">— {day}</h2>
          <Stagger as="ol" watch={entries.length} className="border-t border-line font-mono text-[12.5px]">
            {entries.map((e) => {
              const alert = ALERT.has(e.action);
              const anonymous = ANONYMOUS.has(e.action);
              return (
                <li key={e.id} data-reveal className={cx('grid grid-cols-[4.5rem_5.5rem_1fr] gap-x-3 border-b border-line/60 px-1 py-2 sm:grid-cols-[5rem_6.5rem_1fr_auto]', alert && 'bg-seal/10')}>
                  <time dateTime={e.createdAt} title={formatDateTime(e.createdAt)} className="text-faint">
                    {timeFmt.format(new Date(e.createdAt))}
                  </time>
                  <span className={cx('font-semibold', alert ? 'text-seal' : anonymous ? 'text-fg' : 'text-muted')}>{CODE[e.action] ?? e.action}</span>
                  <span className="min-w-0 font-sans text-[13.5px]">
                    {!anonymous && <span className="text-fg">{e.actor?.name ?? 'Utilisateur supprimé'} </span>}
                    <span className="text-muted">{ACTION_LABEL[e.action] ?? e.action}</span> <span className="text-fg">« {e.targetName} »</span>
                    {e.details && <span className="text-faint"> · {e.details}</span>}
                  </span>
                  {e.ip && <span className="hidden text-faint sm:block">{e.ip}</span>}
                </li>
              );
            })}
          </Stagger>
        </section>
      ))}
    </div>
  );
}
